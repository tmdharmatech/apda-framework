"""
Benchmark: Llama-3.2-3B local vs Sabiá (Maritaca) via LiteLLM.
Roda o workflow xlsx-regex-anon em ambos e compara tempo + qualidade.
"""

import json
import subprocess
import sys
import time
from pathlib import Path

BASE = Path(__file__).resolve().parents[1]
SAIDA = BASE / "saida"
SCRIPTS = BASE / "scripts"

INPUT_XLSX = BASE / "entrada" / "Diario_de_Classe_AEE_2025_10_Estudantes_Ficticios_Escola_Professor_Ficticios.xlsx"
EXTRACT_SCRIPT = SCRIPTS / "01_extrair_texto.py"
ANON_SCRIPT = SCRIPTS / "02_anonimizar_texto.py"
GEN_SCRIPT = SCRIPTS / "05_gerar_artefato_3b.py"

PYTHON = sys.executable
LITELLM_URL = "http://localhost:4000"
LOCAL_URL = "http://localhost:8091"
API_KEY = "apda-master-key"

STEM = "Diario_de_Classe_AEE_2025_10_Estudantes_Ficticios_Escola_Professor_Ficticios"


def run_step(label, cmd):
    print(f"  [{label}] ", end="", flush=True)
    t0 = time.time()
    result = subprocess.run(cmd, capture_output=True, text=True, timeout=300)
    elapsed = time.time() - t0
    if result.returncode != 0:
        print(f"FALHA ({elapsed:.1f}s)")
        print(f"    stderr: {result.stderr[:500]}")
        return None, elapsed
    print(f"OK ({elapsed:.1f}s)")
    return True, elapsed


def validate_artifact(path):
    try:
        with open(path, encoding="utf-8") as f:
            data = json.load(f)
        campos = ["tipo_artefato", "origem", "conteudo_pedagogico"]
        presentes = [c for c in campos if c in data]
        return {
            "valido_json": True,
            "campos_obrigatorios": f"{len(presentes)}/{len(campos)}",
            "tipo_artefato": data.get("tipo_artefato", "?"),
            "tamanho_bytes": path.stat().st_size,
        }
    except Exception as e:
        return {"valido_json": False, "erro": str(e)}


def main():
    SAIDA.mkdir(exist_ok=True)

    extracted = SAIDA / f"{STEM}.texto_extraido.txt"
    anon_txt = SAIDA / f"{STEM}.bench_anonimizado.txt"

    print("=" * 70)
    print("BENCHMARK: Llama-3.2-3B-Q4 (local) vs Sabiá-3 (Maritaca)")
    print(f"Arquivo: {INPUT_XLSX.name}")
    print("Workflow: xlsx-regex-anon (extrair → regex-anon → gerar artefato)")
    print("=" * 70)

    # ── Etapa 1: Extrair texto (compartilhada)
    print("\n[1/3] Extrair texto do XLSX")
    if not extracted.exists():
        ok, t_ext = run_step("extract", [
            PYTHON, str(EXTRACT_SCRIPT),
            "--input", str(INPUT_XLSX),
            "--output", str(extracted),
        ])
        if not ok:
            print("ERRO: nao foi possivel extrair texto. Abortando.")
            return
    else:
        t_ext = 0
        print(f"  [extract] Reutilizando {extracted.name} existente")

    txt_size = extracted.stat().st_size
    print(f"  Texto extraido: {txt_size:,} bytes")

    # ── Etapa 2: Regex-anon (compartilhada)
    print("\n[2/3] Anonimizar (regex)")
    ok, t_anon = run_step("regex-anon", [
        PYTHON, str(ANON_SCRIPT),
        "--input", str(extracted),
        "--output", str(anon_txt),
    ])
    if not ok:
        print("ERRO: falha na anonimizacao. Abortando.")
        return

    anon_size = anon_txt.stat().st_size
    print(f"  Texto anonimizado: {anon_size:,} bytes")

    # ── Etapa 3: Gerar artefato — modelo A (local) vs modelo B (Sabiá)
    print("\n[3/3] Gerar artefato APDA")
    print("-" * 70)

    results = {}

    # ─── Modelo A: Llama local (direto, sem LiteLLM)
    out_local = SAIDA / f"{STEM}.bench_local.apda.json"
    print(f"\n  >>> MODELO A: Llama-3.2-3B-Instruct-Q4 (local @ {LOCAL_URL})")
    ok_a, t_local = run_step("gerar-local", [
        PYTHON, str(GEN_SCRIPT),
        "--input", str(anon_txt),
        "--output", str(out_local),
        "--base-url", LOCAL_URL,
    ])
    results["llama-3.2-3b-local"] = {
        "tempo_geracao_s": round(t_local, 2),
        "sucesso": ok_a is not None,
        "validacao": validate_artifact(out_local) if ok_a else None,
    }

    # ─── Modelo B: Sabiá via LiteLLM
    out_sabia = SAIDA / f"{STEM}.bench_sabia.apda.json"
    print(f"\n  >>> MODELO B: Sabiá-3 (Maritaca via LiteLLM @ {LITELLM_URL})")
    ok_b, t_sabia = run_step("gerar-sabia", [
        PYTHON, str(GEN_SCRIPT),
        "--input", str(anon_txt),
        "--output", str(out_sabia),
        "--base-url", LITELLM_URL,
        "--litellm",
        "--api-key", API_KEY,
        "--modelo", "sabia-professor",
    ])
    results["sabia-3-maritaca"] = {
        "tempo_geracao_s": round(t_sabia, 2),
        "sucesso": ok_b is not None,
        "validacao": validate_artifact(out_sabia) if ok_b else None,
    }

    # ── Resumo
    print("\n" + "=" * 70)
    print("RESULTADO DO BENCHMARK")
    print("=" * 70)
    print(f"\n{'Metrica':<30} {'Llama-3.2-3B':<20} {'Sabia-3':<20}")
    print("-" * 70)

    r_local = results["llama-3.2-3b-local"]
    r_sabia = results["sabia-3-maritaca"]

    print(f"{'Tempo geracao (s)':<30} {r_local['tempo_geracao_s']:<20} {r_sabia['tempo_geracao_s']:<20}")
    print(f"{'Sucesso':<30} {str(r_local['sucesso']):<20} {str(r_sabia['sucesso']):<20}")

    if r_local["validacao"]:
        v = r_local["validacao"]
        print(f"{'JSON valido (local)':<30} {str(v['valido_json']):<20} ", end="")
    else:
        print(f"{'JSON valido (local)':<30} {'N/A':<20} ", end="")

    if r_sabia["validacao"]:
        v = r_sabia["validacao"]
        print(f"{str(v['valido_json']):<20}")
    else:
        print(f"{'N/A':<20}")

    if r_local["validacao"] and r_local["validacao"]["valido_json"]:
        v = r_local["validacao"]
        print(f"{'Tipo artefato (local)':<30} {v['tipo_artefato']:<20} ", end="")
    else:
        print(f"{'Tipo artefato (local)':<30} {'—':<20} ", end="")

    if r_sabia["validacao"] and r_sabia["validacao"]["valido_json"]:
        v = r_sabia["validacao"]
        print(f"{v['tipo_artefato']:<20}")
    else:
        print(f"{'—':<20}")

    if r_local["validacao"] and r_local["validacao"].get("tamanho_bytes"):
        kb_l = r_local["validacao"]["tamanho_bytes"] / 1024
        print(f"{'Tamanho saida (KB)':<30} {kb_l:<20.1f} ", end="")
    else:
        print(f"{'Tamanho saida (KB)':<30} {'—':<20} ", end="")

    if r_sabia["validacao"] and r_sabia["validacao"].get("tamanho_bytes"):
        kb_s = r_sabia["validacao"]["tamanho_bytes"] / 1024
        print(f"{kb_s:<20.1f}")
    else:
        print(f"{'—':<20}")

    if r_local["sucesso"] and r_sabia["sucesso"]:
        speedup = r_local["tempo_geracao_s"] / max(r_sabia["tempo_geracao_s"], 0.01)
        if speedup > 1:
            print(f"\n  Sabia foi {speedup:.1f}x mais rapido que Llama local.")
        else:
            print(f"\n  Llama local foi {1/speedup:.1f}x mais rapido que Sabia.")

    print("-" * 70)

    bench_log = SAIDA / "benchmark_resultado.json"
    bench_log.write_text(json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"\nResultados salvos em: {bench_log}")


if __name__ == "__main__":
    main()
