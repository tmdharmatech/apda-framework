"""
03_scan_xlsx.py
===============
Fase 1 do workflow de segmentação XLSX:

  1. Lê o XLSX inteiro e serializa em texto estruturado:
       - Abas de metadados (Capa, Identificação, Relação nominal)
       - Amostra da primeira aba de aluno (estrutura/padrão)
       - Índice de todas as abas de aluno encontradas

  2. Envia ao LLM para que ele compreenda:
       - O padrão do documento (quais seções existem, quais tipos de artefato)
       - Quais alunos/registros estão presentes
       - Qual a estrutura interna de cada aba de aluno

  3. Produz um manifesto XLSX com:
       - Metadados institucionais
       - Lista de alunos com aba correspondente
       - Tipos de artefato pedagógico identificados no padrão
       - Campos detectados por tipo

Uso:
  python scripts/03_scan_xlsx.py --input entrada/arquivo.xlsx \\
    [--output saida/arquivo.manifesto_xlsx.json] \\
    [--aluno-amostra "Aluno 2"] \\
    [--base-url http://127.0.0.1:8091]
"""

from __future__ import annotations

import argparse
import json
import re
import time
from datetime import datetime
from pathlib import Path

import pandas as pd

from lib.llm_client import extract_json, post_json
from lib.paths import SAIDA
from lib.config import resolve_base_url

# ─────────────────────────────────────────────────────────────────────────────
# Prompts
# ─────────────────────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """Você é um analisador especializado em documentos pedagógicos municipais brasileiros.

Sua tarefa é examinar o conteúdo extraído de uma planilha XLSX e produzir um manifesto estruturado
que descreva com precisão:
  - os metadados institucionais do documento
  - quais alunos/estudantes estão registrados
  - quais tipos de artefatos pedagógicos existem em cada registro de aluno
  - a estrutura interna detectada (quais seções/campos estão presentes)

REGRAS OBRIGATÓRIAS:
- Responda SOMENTE com JSON válido, sem markdown, sem texto fora do JSON.
- Não invente informações. Use apenas o que está no texto fornecido.
- Campos não encontrados devem ser null, nunca inventados.
- tipos_artefato deve conter apenas valores do conjunto:
  ["diario_aee", "estudo_de_caso", "plano_atendimento", "relatorio_pedagogico", "atividade_adaptada", "outro"]
- confianca deve ser "alta", "media" ou "baixa".
- Para cada tipo de artefato identificado, liste os campos/seções detectados no padrão da aba."""

USER_TEMPLATE = """Analise o documento pedagógico abaixo extraído de uma planilha XLSX e produza o manifesto.

Retorne um JSON com esta estrutura exata:
{{
  "instituicao": {{
    "escola": null,
    "cod_inep": null,
    "professor_aee": null,
    "municipio": null,
    "ano": null,
    "observacoes": null
  }},
  "documento": {{
    "tipo_documento_inferido": null,
    "total_alunos_registrados": 0,
    "padrao_abas": null,
    "observacoes": null
  }},
  "tipos_artefato_detectados": [
    {{
      "tipo": "plano_atendimento",
      "confianca": "alta",
      "secoes_detectadas": [],
      "descricao": null
    }}
  ],
  "alunos": [
    {{
      "indice": 1,
      "aba_origem": null,
      "nome_anonimizado": null,
      "tipos_artefato": []
    }}
  ]
}}

IMPORTANTE:
- Em "alunos", liste apenas os primeiros 10 alunos encontrados na relação nominal como exemplos representativos.
- Use "total_alunos_registrados" no campo documento para indicar o total real.
- "nome_anonimizado": use SOMENTE o código da aba (ex: "Aluno 2"), nunca nome ou iniciais.
- "tipos_artefato" de cada aluno: use exatamente os mesmos tipos detectados no padrão da aba de amostra.
- "secoes_detectadas": lista CURTA (máx 8 itens) com os nomes das seções principais encontradas.
- Seja conciso: strings de no máximo 60 caracteres em todos os campos de texto.

Conteúdo do documento:
\"\"\"
{conteudo}
\"\"\"
"""

# ─────────────────────────────────────────────────────────────────────────────
# Extração do XLSX
# ─────────────────────────────────────────────────────────────────────────────


def _linhas_nao_vazias(df: pd.DataFrame) -> list[str]:
    linhas = []
    for _, row in df.iterrows():
        vals = [str(v).strip() for v in row if str(v).strip() not in ("nan", "NaN", "")]
        if vals:
            linhas.append(" | ".join(vals))
    return linhas


def serializar_xlsx(caminho: Path, aba_amostra: str | None) -> tuple[str, list[str]]:
    """Serializa o XLSX em texto estruturado para envio ao LLM.

    Retorna (texto_serializado, lista_de_abas_de_aluno).
    """
    xl = pd.ExcelFile(caminho)
    abas = xl.sheet_names

    abas_aluno = [a for a in abas if re.search(r"aluno", a, re.IGNORECASE)]

    partes = []
    partes.append(f"=== ARQUIVO: {caminho.name} ===")
    partes.append(f"Total de abas: {len(abas)}")
    partes.append(f"Abas de aluno detectadas: {len(abas_aluno)}")
    partes.append(f"Lista de abas: {', '.join(abas)}\n")

    for aba in abas:
        if re.search(r"aluno", aba, re.IGNORECASE):
            continue
        df = xl.parse(aba, header=None).dropna(how="all")
        linhas = _linhas_nao_vazias(df)
        if not linhas:
            continue
        partes.append(f"\n--- ABA: {aba} ---")
        limite = 15 if re.search(r"relação|nominal", aba, re.IGNORECASE) else 40
        partes.extend(linhas[:limite])
        if len(linhas) > limite:
            partes.append(f"... ({len(linhas) - limite} linhas adicionais não exibidas)")

    aba_para_amostra = aba_amostra or (abas_aluno[0] if abas_aluno else None)
    if aba_para_amostra and aba_para_amostra in abas:
        df_a = xl.parse(aba_para_amostra, header=None).dropna(how="all")
        linhas_a = _linhas_nao_vazias(df_a)
        partes.append(f"\n--- ABA DE AMOSTRA: {aba_para_amostra} (padrão estrutural) ---")
        partes.extend(linhas_a)

    partes.append(f"\n--- ÍNDICE DE ABAS DE ALUNO ---")
    for i, aba in enumerate(abas_aluno, 1):
        partes.append(f"{i}. {aba}")

    return "\n".join(partes), abas_aluno


# ─────────────────────────────────────────────────────────────────────────────
# Main
# ─────────────────────────────────────────────────────────────────────────────


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Varredura estrutural de XLSX pedagógico via LLM."
    )
    parser.add_argument("--input", required=True, help="Arquivo .xlsx de entrada.")
    parser.add_argument("--output", default=None, help="JSON de saída do manifesto.")
    parser.add_argument(
        "--aluno-amostra",
        default=None,
        help="Nome da aba de aluno a usar como amostra (ex: 'Aluno 2').",
    )
    parser.add_argument("--base-url", default=None, help="URL base do llama-server (padrão: APDA_LLAMA_BASE_URL ou http://127.0.0.1:8091)")
    parser.add_argument("--max-chars", type=int, default=20000)
    parser.add_argument("--max-tokens", type=int, default=3000)
    parser.add_argument("--temperature", type=float, default=0.1)
    args = parser.parse_args()

    base_url = resolve_base_url(args.base_url)
    input_path = Path(args.input).resolve()
    if not input_path.exists():
        raise SystemExit(f"Arquivo não encontrado: {input_path}")

    stem = input_path.stem
    for suf in (".texto_extraido", ".opf_anonimizado"):
        stem = stem.replace(suf, "")

    SAIDA.mkdir(exist_ok=True)
    output_path = (
        Path(args.output).resolve()
        if args.output
        else SAIDA / f"{stem}.manifesto_xlsx.json"
    )

    print(f"[INFO] Lendo {input_path.name}...")
    conteudo, abas_aluno = serializar_xlsx(input_path, args.aluno_amostra)
    conteudo_truncado = conteudo[: args.max_chars]
    print(
        f"[INFO] {len(abas_aluno)} abas de aluno | {len(conteudo)} chars → truncado a {len(conteudo_truncado)}"
    )

    prompt = USER_TEMPLATE.format(conteudo=conteudo_truncado)

    payload = {
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": prompt},
        ],
        "temperature": args.temperature,
        "max_tokens": args.max_tokens,
        "response_format": {"type": "json_object"},
    }

    print(f"[INFO] Chamando LLM ({base_url})...")
    t0 = time.perf_counter()
    response = post_json(f"{base_url}/v1/chat/completions", payload)
    elapsed = round(time.perf_counter() - t0, 3)

    raw_content = response["choices"][0]["message"]["content"]

    raw_path = output_path.with_suffix(".json.raw.txt")
    raw_path.write_text(raw_content, encoding="utf-8")

    try:
        manifesto = json.loads(extract_json(raw_content))
    except Exception as exc:
        metadata_path = output_path.with_suffix(".json.metadata.json")
        metadata_path.write_text(
            json.dumps(
                {
                    "data": datetime.now().isoformat(),
                    "entrada": str(input_path),
                    "saida": str(output_path),
                    "elapsed_seconds": elapsed,
                    "erro": str(exc),
                    "usage": response.get("usage", {}),
                },
                ensure_ascii=False,
                indent=2,
            ),
            encoding="utf-8",
        )
        raise SystemExit(
            f"[ERRO] Falha ao parsear JSON do manifesto: {exc}\nRaw salvo em: {raw_path}"
        )

    manifesto["_meta"] = {
        "pipeline_versao": "apda-local-0.3-xlsx-scan",
        "data_processamento": datetime.now().isoformat(),
        "arquivo_origem": str(input_path),
        "elapsed_seconds": elapsed,
        "abas_aluno_total": len(abas_aluno),
        "abas_aluno": abas_aluno,
        "usage": response.get("usage", {}),
    }

    output_path.write_text(
        json.dumps(manifesto, ensure_ascii=False, indent=2),
        encoding="utf-8",
    )

    n_alunos = len(manifesto.get("alunos", []))
    n_tipos = len(manifesto.get("tipos_artefato_detectados", []))
    print(f"[OK] manifesto gerado: {output_path}")
    print(f"[OK] {n_alunos} alunos | {n_tipos} tipos de artefato | {elapsed}s")

    metadata_path = output_path.with_suffix(".json.metadata.json")
    metadata_path.write_text(
        json.dumps(
            {
                "data": datetime.now().isoformat(),
                "modelo": response.get("model", "desconhecido"),
                "entrada": str(input_path),
                "saida": str(output_path),
                "elapsed_seconds": elapsed,
                "n_alunos": n_alunos,
                "n_tipos_artefato": n_tipos,
                "usage": response.get("usage", {}),
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
