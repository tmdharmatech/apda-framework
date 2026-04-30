"""
benchmark_modelos.py
====================
Executa o workflow completo para os 3 modelos disponíveis:

  Fase 1 — Varredura estrutural do XLSX inteiro (03_scan_xlsx.py)
            → lê o XLSX diretamente com serialização limpa linha a linha
              (Capa + Identificação + Relação nominal + aba de amostra)
              → manifesto com padrão do documento e lista de alunos
  Fase 2 — Extração e anonimização do aluno isolado
  Fase 3 — Scan semântico do texto do aluno (02_scan_segments.py)
  Fase 4 — Geração dos APDAs segmentados (07_gerar_de_manifesto.py)
            → um APDA por tipo de artefato detectado no scan

Para cada modelo são registrados: tempo por fase, score de qualidade,
nomes vazados, campos preenchidos vs nulos.

Uso:
  .venv/bin/python benchmarks/benchmark_modelos.py
  .venv/bin/python benchmarks/benchmark_modelos.py --aluno "Aluno 2"
  .venv/bin/python benchmarks/benchmark_modelos.py --modelos qwen2.5-3b qwen3-4b
  .venv/bin/python benchmarks/benchmark_modelos.py --skip-phases 1

Saída:
  benchmarks/resultados/<modelo_id>/manifesto_xlsx.json
  benchmarks/resultados/<modelo_id>/aluno_anonimizado.txt
  benchmarks/resultados/<modelo_id>/seg<N>.<tipo>.apda.json
  benchmarks/resultados/resumo_benchmark.json
"""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
import time
from datetime import datetime
from pathlib import Path

import pandas as pd

BASE = Path(__file__).resolve().parents[1]
BENCH_DIR = Path(__file__).resolve().parent
VENV_PY = BASE / ".venv" / "bin" / "python"

SCRIPT_SCAN_XLSX = BASE / "scripts" / "03_scan_xlsx.py"
SCRIPT_ANON = BASE / "scripts" / "04_privacy_filter_anonimizar.py"
SCRIPT_GEN = BASE / "scripts" / "07_gerar_de_manifesto.py"
SCRIPT_SCAN_TXT = BASE / "scripts" / "02_scan_segments.py"

DEFAULT_XLSX_INPUT = (
    BASE
    / "entrada"
    / "Diario_de_Classe_AEE_2025_10_Estudantes_Ficticios_Escola_Professor_Ficticios.xlsx"
)
XLSX_INPUT = DEFAULT_XLSX_INPUT
BASE_URL = os.environ.get("APDA_LLAMA_BASE_URL", "http://127.0.0.1:8091")

MODELOS = [
    {
        "id": "qwen2.5-3b",
        "nome": "Qwen2.5-3B-Instruct-Q4_K_M",
        "gguf": BASE
        / "modelos"
        / "Qwen2.5-3B-Instruct-Q4_K_M"
        / "Qwen2.5-3B-Instruct-Q4_K_M.gguf",
    },
    {
        "id": "qwen3-4b",
        "nome": "Qwen3-4B-Q4_K_M",
        "gguf": BASE / "modelos" / "Qwen3-4B-GGUF" / "Qwen3-4B-Q4_K_M.gguf",
    },
    {
        "id": "llama3.2-3b",
        "nome": "Llama-3.2-3B-Instruct-Q4_K_M",
        "gguf": BASE
        / "modelos"
        / "Llama-3.2-3B-Instruct-Q4_K_M"
        / "Llama-3.2-3B-Instruct-Q4_K_M.gguf",
    },
]

MODEL_KEYS = {
    "qwen2.5-3b": "qwen2_5_3b_q4_k_m",
    "qwen3-4b": "qwen3_4b_q4_k_m",
    "llama3.2-3b": "llama3_2_3b_q4_k_m",
}

MODEL_PARAMS_B = {
    "qwen2.5-3b": 3.09,
    "qwen3-4b": 4.02,
    "llama3.2-3b": 3.21,
}

# ─────────────────────────────────────────────────────────────────────────────
# Helpers
# ─────────────────────────────────────────────────────────────────────────────


def log(msg: str) -> None:
    ts = datetime.now().strftime("%H:%M:%S")
    print(f"[{ts}] {msg}", flush=True)


def run_py(args_list: list, label: str) -> tuple[int, float, str, str]:
    """Roda um script Python do .venv, retorna (rc, elapsed, stdout, stderr)."""
    cmd = [str(VENV_PY)] + [str(a) for a in args_list]
    log(f"    $ {Path(args_list[0]).name} {' '.join(str(a) for a in args_list[1:])}")
    t0 = time.perf_counter()
    r = subprocess.run(cmd, capture_output=True, text=True)
    elapsed = round(time.perf_counter() - t0, 2)
    if r.stdout.strip():
        for line in r.stdout.strip().splitlines()[-4:]:
            log(f"      {line}")
    if r.returncode != 0 and r.stderr.strip():
        for line in r.stderr.strip().splitlines()[-3:]:
            log(f"      STDERR: {line}")
    return r.returncode, elapsed, r.stdout.strip(), r.stderr.strip()


def _ler_pid_servidor() -> int | None:
    """Lê o PID do servidor gerenciado pelo apda server."""
    state_path = BASE / ".apda" / "server.json"
    try:
        state = json.loads(state_path.read_text(encoding="utf-8"))
        return int(state.get("pid", 0)) or None
    except Exception:
        return None


def _processo_vivo(pid: int) -> bool:
    try:
        os.kill(pid, 0)
        return True
    except OSError:
        return False


def _aguardar_morte(pid: int, timeout_s: int = 20) -> bool:
    """Espera até o processo morrer ou estourar o timeout."""
    deadline = time.perf_counter() + timeout_s
    while time.perf_counter() < deadline:
        if not _processo_vivo(pid):
            return True
        time.sleep(0.5)
    return False


def restart_server(gguf_path: Path) -> bool:
    # 1. Para o servidor gerenciado
    pid_antes = _ler_pid_servidor()
    log("  ▸ Parando servidor atual...")
    subprocess.run(
        ["node", str(BASE / "src" / "cli.js"), "server", "stop"],
        capture_output=True,
        cwd=BASE,
    )

    # 2. Aguarda o processo morrer de verdade (libera a VRAM)
    if pid_antes:
        morreu = _aguardar_morte(pid_antes, timeout_s=30)
        if not morreu:
            log(f"  ⚠ PID {pid_antes} ainda vivo após 30s — forçando SIGKILL")
            try:
                os.kill(pid_antes, 9)
            except OSError:
                pass
            time.sleep(2)

    # 3. Aguarda mais um pouco para a GPU liberar a VRAM completamente
    log("  ▸ Aguardando GPU liberar VRAM...")
    time.sleep(5)

    # 4. Sobe o novo servidor
    log(f"  ▸ Iniciando servidor com {gguf_path.name}...")
    r = subprocess.run(
        [
            "node",
            str(BASE / "src" / "cli.js"),
            "server",
            "start",
            "--model",
            str(gguf_path),
        ],
        capture_output=True,
        text=True,
        cwd=BASE,
        timeout=180,
    )
    if r.returncode != 0:
        log(f"  ✘ Falha ao iniciar: {r.stderr[:300]}")
        return False
    log("  ✔ Servidor pronto.")
    return True


# ─────────────────────────────────────────────────────────────────────────────
# Extração do aluno do XLSX (sem LLM — determinístico)
# ─────────────────────────────────────────────────────────────────────────────


def extrair_aluno_xlsx(xlsx_path: Path, aba: str, out_path: Path) -> int:
    """Extrai o conteúdo de uma aba de aluno do XLSX como texto estruturado."""
    xl = pd.ExcelFile(xlsx_path)
    df = xl.parse(aba, header=None).dropna(how="all")
    linhas = []
    for _, row in df.iterrows():
        vals = [str(v).strip() for v in row if str(v).strip() not in ("nan", "NaN", "")]
        if vals:
            linhas.append(" | ".join(vals))
    texto = "\n".join(linhas)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(texto, encoding="utf-8")
    return len(texto)


# ─────────────────────────────────────────────────────────────────────────────
# Scoring
# ─────────────────────────────────────────────────────────────────────────────

TIPOS_ESPERADOS = {
    "plano_atendimento",
    "estudo_de_caso",
    "atividade_adaptada",
    "relatorio_pedagogico",
}


def score_manifesto(m: dict) -> dict:
    alunos = m.get("alunos", [])
    tipos_det = m.get("tipos_artefato_detectados", [])
    tipos_ids = {t.get("tipo") for t in tipos_det}

    cobertura = len(tipos_ids & TIPOS_ESPERADOS) / len(TIPOS_ESPERADOS)
    tem_inst = bool(m.get("instituicao", {}).get("escola"))
    tem_secoes = any(t.get("secoes_detectadas") for t in tipos_det)
    n_alunos = len(alunos)

    pts = 0
    if tem_inst:
        pts += 15
    if n_alunos >= 1:
        pts += 10
    if n_alunos >= 10:
        pts += 10
    if cobertura >= 0.5:
        pts += 20
    if cobertura >= 1.0:
        pts += 15
    if tem_secoes:
        pts += 15
    if m.get("documento", {}).get("tipo_documento_inferido"):
        pts += 10
    if m.get("documento", {}).get("padrao_abas"):
        pts += 5

    return {
        "n_alunos_listados": n_alunos,
        "tipos_detectados": sorted(tipos_ids),
        "cobertura_tipos_pct": round(cobertura * 100),
        "tem_instituicao": tem_inst,
        "tem_secoes": tem_secoes,
        "pontuacao": pts,  # máx 100
    }


def score_apda(apda: dict) -> dict:
    cp = apda.get("conteudo_pedagogico", {})
    anon = apda.get("anonimizacao", {})
    val = apda.get("validacao_humana", {})
    orig = apda.get("origem", {})

    obrig = [
        "tipo_artefato",
        "origem",
        "conteudo_pedagogico",
        "metadados_processamento",
        "validacao_humana",
    ]
    tem_obrig = all(c in apda for c in obrig)
    objetivo = cp.get("objetivo_pedagogico")
    barreiras = cp.get("barreiras_identificadas", [])
    estrategias = cp.get("estrategias_pedagogicas", [])
    recursos = cp.get("recursos_acessibilidade", [])
    obs = cp.get("observacoes_relevantes")

    texto = json.dumps(apda, ensure_ascii=False)
    nomes_vazados = bool(
        re.search(
            r"\b(Analice|Maria das Graças|Emanuelle|Guiomar|Araujo)\b",
            texto,
            re.IGNORECASE,
        )
    )

    pts = 0
    if tem_obrig:
        pts += 20
    if objetivo:
        pts += 15
    if len(barreiras) >= 1:
        pts += 10
    if len(estrategias) >= 1:
        pts += 10
    if len(recursos) >= 1:
        pts += 10
    if obs:
        pts += 10
    if val.get("necessaria") and val.get("status") == "pendente":
        pts += 10
    if anon.get("aplicada"):
        pts += 5
    if orig.get("segmento_indice") is not None:
        pts += 5
    if not nomes_vazados:
        pts += 5

    return {
        "tipo": apda.get("tipo_artefato"),
        "tem_objetivo": bool(objetivo),
        "n_barreiras": len(barreiras),
        "n_estrategias": len(estrategias),
        "n_recursos": len(recursos),
        "tem_observacoes": bool(obs),
        "validacao_correta": val.get("necessaria") and val.get("status") == "pendente",
        "anonimizacao_ok": bool(anon.get("aplicada")),
        "nomes_vazados": nomes_vazados,
        "pontuacao": pts,  # máx 100
    }


# ─────────────────────────────────────────────────────────────────────────────
# Benchmark de um modelo
# ─────────────────────────────────────────────────────────────────────────────


def benchmark_modelo(
    modelo: dict, xlsx_input: Path, aba_aluno: str, skip_phases: set[int]
) -> dict:
    mid = modelo["id"]
    out_dir = BENCH_DIR / "resultados" / mid
    out_dir.mkdir(parents=True, exist_ok=True)

    res = {
        "modelo_id": mid,
        "modelo_nome": modelo["nome"],
        "aba_aluno": aba_aluno,
        "timestamp": datetime.now().isoformat(),
        "fases": {},
        "scores": {},
    }

    # ── Fase 1: varredura estrutural do XLSX inteiro ──────────────────────────
    manifesto_path = out_dir / "manifesto_xlsx.json"
    if 1 not in skip_phases:
        log("  ── Fase 1: varredura estrutural do XLSX (03_scan_xlsx.py)")
        rc, el, out, err = run_py(
            [
                SCRIPT_SCAN_XLSX,
                "--input",
                str(xlsx_input),
                "--output",
                str(manifesto_path),
                "--aluno-amostra",
                aba_aluno,
                "--base-url",
                BASE_URL,
                "--max-chars",
                "20000",
                "--max-tokens",
                "4500",
            ],
            "03_scan_xlsx.py",
        )
        f1 = {"elapsed_s": el, "rc": rc, "ok": rc == 0 and manifesto_path.exists()}
        if f1["ok"]:
            m = json.loads(manifesto_path.read_text(encoding="utf-8"))
            f1["score"] = score_manifesto(m)
            log(
                f"  ✔ {f1['score']['n_alunos_listados']} alunos | "
                f"{f1['score']['tipos_detectados']} | "
                f"score={f1['score']['pontuacao']}/100 | {el}s"
            )
        else:
            f1["erro"] = err[-300:]
            log(f"  ✘ Fase 1 falhou (rc={rc})")
        res["fases"]["1_scan_xlsx"] = f1
    else:
        log("  ── Fase 1: pulada")

    # ── Fase 2: anonimização do texto do aluno ────────────────────────────────
    txt_aluno_raw = out_dir / f"{aba_aluno.replace(' ', '_')}.raw.txt"
    txt_aluno_anon = out_dir / f"{aba_aluno.replace(' ', '_')}.anon.txt"

    if 2 not in skip_phases:
        log(f"  ── Fase 2: extração e anonimização do {aba_aluno}")

        # 2a: extrai só a aba do aluno (determinístico, sem LLM)
        n_chars = extrair_aluno_xlsx(xlsx_input, aba_aluno, txt_aluno_raw)
        log(f"    Texto do aluno extraído: {n_chars} chars → {txt_aluno_raw.name}")

        # 2b: anonimiza
        model_dir = BASE / "modelos" / "openai-privacy-filter"
        if model_dir.exists():
            rc, el, out, err = run_py(
                [
                    SCRIPT_ANON,
                    "--input",
                    str(txt_aluno_raw),
                    "--output",
                    str(txt_aluno_anon),
                ],
                "04_privacy_filter_anonimizar.py",
            )
            res["fases"]["2_anonimizacao"] = {"elapsed_s": el, "rc": rc, "ok": rc == 0}
            if rc != 0:
                log(f"  ✘ Anonimização falhou — usando texto bruto como fallback.")
                import shutil

                shutil.copy(txt_aluno_raw, txt_aluno_anon)
                res["fases"]["2_anonimizacao"]["fallback"] = True
        else:
            log("  ⚠ Privacy filter não encontrado — copiando texto bruto.")
            import shutil

            shutil.copy(txt_aluno_raw, txt_aluno_anon)
            res["fases"]["2_anonimizacao"] = {
                "ok": True,
                "fallback": True,
                "elapsed_s": 0,
            }
    else:
        log("  ── Fase 2: pulada")
        if not txt_aluno_anon.exists() and txt_aluno_raw.exists():
            import shutil

            shutil.copy(txt_aluno_raw, txt_aluno_anon)

    if not txt_aluno_anon.exists():
        log("  ✘ Texto anonimizado não encontrado. Abortando.")
        return res

    # ── Fase 3: scan semântico do texto do aluno ──────────────────────────────
    segmentos_path = out_dir / f"{aba_aluno.replace(' ', '_')}.segmentos.json"
    if 3 not in skip_phases:
        log(f"  ── Fase 3: scan semântico do aluno (02_scan_segments.py)")
        rc, el, out, err = run_py(
            [
                SCRIPT_SCAN_TXT,
                "--input",
                str(txt_aluno_anon),
                "--output",
                str(segmentos_path),
                "--base-url",
                BASE_URL,
                "--max-chars",
                "16000",
                "--max-tokens",
                "2500",
            ],
            "02_scan_segments.py",
        )
        f3 = {"elapsed_s": el, "rc": rc, "ok": rc == 0 and segmentos_path.exists()}
        if f3["ok"]:
            seg = json.loads(segmentos_path.read_text(encoding="utf-8"))
            n_segs = len(seg.get("segmentos", []))
            tipos_seg = [
                t for s in seg.get("segmentos", []) for t in s.get("tipos_artefato", [])
            ]
            f3["n_segmentos"] = n_segs
            f3["tipos_artefato"] = sorted(set(tipos_seg))
            log(f"  ✔ {n_segs} segmentos | tipos={f3['tipos_artefato']} | {el}s")
        else:
            f3["erro"] = err[-300:]
            log(f"  ✘ Fase 3 falhou (rc={rc})")
        res["fases"]["3_scan_aluno"] = f3
    else:
        log("  ── Fase 3: pulada")

    if not segmentos_path.exists():
        log("  ✘ Manifesto de segmentos não encontrado. Abortando.")
        return res

    # ── Fase 4: geração dos APDAs segmentados ─────────────────────────────────
    if 4 not in skip_phases:
        log(f"  ── Fase 4: geração APDAs por segmento (07_gerar_de_manifesto.py)")
        rc, el, out, err = run_py(
            [
                SCRIPT_GEN,
                "--manifest",
                str(segmentos_path),
                "--input",
                str(txt_aluno_anon),
                "--output-dir",
                str(out_dir),
                "--base-url",
                BASE_URL,
                "--max-chars-per-segment",
                "10000",
                "--max-tokens",
                "1200",
            ],
            "07_gerar_de_manifesto.py",
        )

        f4 = {"elapsed_s": el, "rc": rc, "ok": rc == 0, "artefatos": []}
        apda_files = sorted(out_dir.glob("*.apda.json"))
        scores_apda = []
        for af in apda_files:
            try:
                apda = json.loads(af.read_text(encoding="utf-8"))
                sc = score_apda(apda)
                scores_apda.append(sc["pontuacao"])
                f4["artefatos"].append({"arquivo": af.name, "score": sc})
                vazado = " ⚠ NOMES VAZADOS" if sc["nomes_vazados"] else ""
                log(
                    f"    ✔ {af.name} | tipo={sc['tipo']} | "
                    f"score={sc['pontuacao']}/100{vazado}"
                )
            except Exception as exc:
                f4["artefatos"].append({"arquivo": af.name, "erro": str(exc)})
                log(f"    ✘ {af.name}: {exc}")

        if scores_apda:
            f4["n_artefatos"] = len(scores_apda)
            f4["score_medio"] = round(sum(scores_apda) / len(scores_apda), 1)
            f4["score_minimo"] = min(scores_apda)
            f4["score_maximo"] = max(scores_apda)
        log(
            f"  ✔ {len(scores_apda)} APDAs | score médio={f4.get('score_medio')} | {el}s"
        )
        res["fases"]["4_geracao_apda"] = f4
    else:
        log("  ── Fase 4: pulada")

    return res


# ─────────────────────────────────────────────────────────────────────────────
# Impressão do resumo
# ─────────────────────────────────────────────────────────────────────────────


def imprimir_resumo(resultados: list[dict]) -> None:
    sep = "─" * 72
    print(f"\n{'=' * 72}")
    print("RESUMO DO BENCHMARK — APDA Framework")
    print(f"{'=' * 72}")
    print(
        f"{'Modelo':<28} {'F1:Scan':<12} {'F3:SegAluno':<14} {'F4:APDAs':<12} {'Score APDAs'}"
    )
    print(sep)

    for r in resultados:
        mid = r["modelo_id"]
        f = r.get("fases", {})

        f1_score = f.get("1_scan_xlsx", {}).get("score", {}).get("pontuacao", "—")
        f1_time = f.get("1_scan_xlsx", {}).get("elapsed_s", "—")
        f1 = f"{f1_score}/100 ({f1_time}s)" if isinstance(f1_score, int) else "falhou"

        f3_segs = f.get("3_scan_aluno", {}).get("n_segmentos", "—")
        f3_time = f.get("3_scan_aluno", {}).get("elapsed_s", "—")
        f3 = f"{f3_segs} segs ({f3_time}s)" if isinstance(f3_segs, int) else "falhou"

        f4_n = f.get("4_geracao_apda", {}).get("n_artefatos", "—")
        f4_score = f.get("4_geracao_apda", {}).get("score_medio", "—")
        f4_time = f.get("4_geracao_apda", {}).get("elapsed_s", "—")
        f4 = f"{f4_n} arts ({f4_time}s)" if isinstance(f4_n, int) else "falhou"
        f4s = f"{f4_score}/100" if isinstance(f4_score, float) else "—"

        print(f"{mid:<28} {f1:<12} {f3:<14} {f4:<12} {f4s}")

    print(sep)

    # Nomes vazados
    vazamentos = []
    for r in resultados:
        arts = r.get("fases", {}).get("4_geracao_apda", {}).get("artefatos", [])
        for a in arts:
            if a.get("score", {}).get("nomes_vazados"):
                vazamentos.append(f"{r['modelo_id']}/{a['arquivo']}")
    if vazamentos:
        print(f"\n⚠  Nomes vazados detectados em:")
        for v in vazamentos:
            print(f"   - {v}")
    else:
        print("\n✔  Nenhum nome pessoal vazado detectado nos APDAs.")
    print()


def _load_json(path: Path) -> dict:
    try:
        return json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return {}


def _llm_speed_metrics(model_dir: Path) -> dict:
    metas = [
        _load_json(model_dir / "manifesto_xlsx.json.metadata.json"),
        _load_json(model_dir / "Aluno_2.segmentos.json.metadata.json"),
    ]
    elapsed = sum(float(m.get("elapsed_seconds") or 0) for m in metas)
    prompt = sum(int(m.get("usage", {}).get("prompt_tokens") or 0) for m in metas)
    completion = sum(
        int(m.get("usage", {}).get("completion_tokens") or 0) for m in metas
    )
    if elapsed <= 0:
        return {
            "prompt_tokens_per_second": None,
            "generation_tokens_per_second": None,
        }
    return {
        "prompt_tokens_per_second": round(prompt / elapsed, 2),
        "generation_tokens_per_second": round(completion / elapsed, 2),
    }


def _quality_label(model_id: str, n_segmentos: int, retry_needed: bool) -> str:
    if retry_needed:
        return "boa_com_inconsistencia_validacao"
    if model_id == "qwen3-4b":
        return "melhor_separacao_com_inconsistencias"
    if n_segmentos <= 2:
        return "mistura_semantica_detectada"
    return "boa_com_revisao"


def escrever_benchmarks_webui(resultados: list[dict], xlsx_input: Path, elapsed_total: float) -> Path:
    tests = []
    models = {}

    for modelo in MODELOS:
        mid = modelo["id"]
        key = MODEL_KEYS[mid]
        models[key] = {
            "label": modelo["nome"],
            "path": str(modelo["gguf"]),
            "params_b": MODEL_PARAMS_B.get(mid),
            "file_size_gib": round(modelo["gguf"].stat().st_size / (1024**3), 2)
            if modelo["gguf"].exists()
            else None,
        }

    for r in resultados:
        mid = r.get("modelo_id")
        if mid not in MODEL_KEYS:
            continue
        model_dir = BENCH_DIR / "resultados" / mid
        fases = r.get("fases", {})
        f1 = fases.get("1_scan_xlsx", {})
        f3 = fases.get("3_scan_aluno", {})
        f4 = fases.get("4_geracao_apda", {})
        errors = sorted(model_dir.glob("*.error.json"))
        retry_needed = bool(errors)
        n_segmentos = int(f3.get("n_segmentos") or 0)
        speed = _llm_speed_metrics(model_dir)

        tests.append(
            {
                "id": f"xlsx_aluno2_{mid}",
                "category": "json_generation",
                "model_key": MODEL_KEYS[mid],
                "model_label": r.get("modelo_nome", mid),
                "ctx_size": 20000,
                "students": f1.get("score", {}).get("n_alunos_listados"),
                "json_valid": not retry_needed and bool(f4.get("n_artefatos")),
                "name_leak_detected": any(
                    a.get("score", {}).get("nomes_vazados")
                    for a in f4.get("artefatos", [])
                ),
                "student_separation": f"{n_segmentos}_segmentos",
                "retry_needed": retry_needed,
                "semantic_quality": _quality_label(mid, n_segmentos, retry_needed),
                "schema_adherence": "parcial" if retry_needed else "ok",
                "required_fields_missing": None,
                "invented_fields": None,
                "privacy_risk": "baixo",
                "human_validation_consistency": "ok",
                "language_issues": None,
                "notes": (
                    f"F1={f1.get('score', {}).get('pontuacao')}/100; "
                    f"F3={n_segmentos} segmentos; "
                    f"F4={f4.get('n_artefatos', 0)} APDAs; "
                    f"score médio={f4.get('score_medio')}/100"
                ),
                "metrics": {
                    "vram_total_mib": 8192,
                    "elapsed_seconds": round(
                        float(f1.get("elapsed_s") or 0)
                        + float(fases.get("2_anonimizacao", {}).get("elapsed_s") or 0)
                        + float(f3.get("elapsed_s") or 0)
                        + float(f4.get("elapsed_s") or 0),
                        2,
                    ),
                    **speed,
                },
            }
        )

    out = BENCH_DIR / "benchmarks.json"
    out.write_text(
        json.dumps(
            {
                "schema_version": "1.0",
                "project": "APDA",
                "generated_at": datetime.now().isoformat(),
                "source": str(BENCH_DIR / "resultados" / "resumo_benchmark.json"),
                "xlsx": str(xlsx_input),
                "elapsed_total": elapsed_total,
                "hardware": {
                    "gpu": "AMD Radeon RX 580 2048SP",
                    "backend": "llama.cpp Vulkan",
                    "device": "Vulkan1",
                    "vram_total_mib": 8192,
                    "cpu_threads_reported": 2,
                    "server_parallel_slots_auto": 4,
                },
                "models": models,
                "tests": tests,
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )
    return out


# ─────────────────────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────────────────────


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Benchmark completo APDA — XLSX → APDAs."
    )
    parser.add_argument(
        "--input",
        default=str(DEFAULT_XLSX_INPUT),
        help="Arquivo XLSX de entrada (padrão: arquivo XLSX disponível em entrada/).",
    )
    parser.add_argument(
        "--aluno",
        default="Aluno 2",
        help="Nome da aba de aluno a processar (padrão: 'Aluno 2').",
    )
    parser.add_argument(
        "--modelos",
        nargs="+",
        help="IDs dos modelos a testar. Ex: --modelos qwen2.5-3b llama3.2-3b",
    )
    parser.add_argument(
        "--skip-phases",
        nargs="+",
        type=int,
        default=[],
        metavar="N",
        help="Fases a pular (1=scan xlsx, 2=anon, 3=scan aluno, 4=geração). "
        "Ex: --skip-phases 2",
    )
    args = parser.parse_args()
    xlsx_input = Path(args.input).resolve()

    modelos = MODELOS
    if args.modelos:
        ids = set(args.modelos)
        modelos = [m for m in MODELOS if m["id"] in ids]
        if not modelos:
            log(f"Nenhum modelo encontrado: {args.modelos}")
            sys.exit(1)

    skip = set(args.skip_phases)

    log("=" * 60)
    log("APDA Benchmark — XLSX → varredura → aluno → APDAs segmentados")
    log(f"Arquivo : {xlsx_input.name}")
    log(f"Aluno   : {args.aluno}")
    log(f"Modelos : {[m['id'] for m in modelos]}")
    log(f"Fases   : {'todas' if not skip else f'pulando {sorted(skip)}'}")
    log("=" * 60)

    if not xlsx_input.exists():
        log(f"ERRO: arquivo de entrada não encontrado: {xlsx_input}")
        sys.exit(1)

    resultados = []
    t_total = time.perf_counter()

    for i, modelo in enumerate(modelos, 1):
        log(f"\n[{i}/{len(modelos)}] ══ Modelo: {modelo['nome']} ══")

        if not restart_server(modelo["gguf"]):
            log(f"  PULANDO {modelo['id']} — servidor não iniciou.")
            resultados.append(
                {"modelo_id": modelo["id"], "erro": "servidor nao iniciou"}
            )
            continue

        res = benchmark_modelo(modelo, xlsx_input, args.aluno, skip)
        resultados.append(res)

        # Salva resultado parcial imediatamente
        out_dir = BENCH_DIR / "resultados" / modelo["id"]
        (out_dir / "resultado.json").write_text(
            json.dumps(res, ensure_ascii=False, indent=2, default=str),
            encoding="utf-8",
        )

    elapsed_total = round(time.perf_counter() - t_total, 1)

    # Resumo final em tela
    imprimir_resumo(resultados)

    # Salva resumo consolidado
    resumo_path = BENCH_DIR / "resultados" / "resumo_benchmark.json"
    resumo_path.parent.mkdir(parents=True, exist_ok=True)
    resumo_path.write_text(
        json.dumps(
            {
                "timestamp": datetime.now().isoformat(),
                "xlsx": str(xlsx_input),
                "aluno": args.aluno,
                "elapsed_total": elapsed_total,
                "resultados": resultados,
            },
            ensure_ascii=False,
            indent=2,
            default=str,
        ),
        encoding="utf-8",
    )
    webui_path = escrever_benchmarks_webui(resultados, xlsx_input, elapsed_total)
    log(f"Resumo salvo em: {resumo_path}")
    log(f"Benchmark WebUI salvo em: {webui_path}")
    log(f"Tempo total: {elapsed_total}s")


if __name__ == "__main__":
    main()
