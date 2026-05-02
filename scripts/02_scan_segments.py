from __future__ import annotations

import argparse
import json
import time
from datetime import datetime
from pathlib import Path

from lib.llm_client import extract_json, post_json
from lib.paths import SAIDA
from lib.config import resolve_base_url


SYSTEM_PROMPT = """Você é um analisador de documentos pedagógicos. Sua tarefa é identificar e segmentar unidades semânticas independentes dentro de um documento extraído.

REGRAS OBRIGATÓRIAS:
- Responda SOMENTE com JSON válido, sem markdown, sem explicações fora do JSON.
- Não invente informações. Use apenas o que está no texto.
- Cada segmento deve corresponder a uma unidade pedagógica coesa e independente (ex: registros de um único estudante, um único plano de atendimento, uma única atividade).
- Se o documento contiver apenas um artefato, retorne um único segmento.
- Campos não encontrados devem ser null, nunca inventados.
- O campo "tipo_artefato" deve ser um dos valores: "diario_aee", "estudo_de_caso", "plano_atendimento", "relatorio_pedagogico", "atividade_adaptada", "outro".
- O campo "confianca" deve ser: "alta", "media" ou "baixa".
- "trecho_identificador" deve ser uma citação literal curta (até 120 chars) do texto que identifica o início do segmento.
- "resumo_nao_identificavel" deve descrever o conteúdo SEM mencionar nomes, datas ou dados pessoais.
"""


USER_TEMPLATE = """Analise o documento abaixo e identifique todas as unidades semânticas pedagógicas independentes.

Retorne um JSON com esta estrutura:
{{
  "documento": {{
    "tipo_documento_inferido": "descricao geral do tipo de documento",
    "total_segmentos": <número inteiro>,
    "observacoes": "<observações gerais sobre a estrutura, ou null>"
  }},
  "segmentos": [
    {{
      "indice": 1,
      "secao_origem": "<nome da aba, seção ou bloco de origem, ou null>",
      "tipos_artefato": ["plano_atendimento"],
      "confianca": "alta",
      "trecho_identificador": "<citação literal curta do início do segmento>",
      "resumo_nao_identificavel": "<síntese pedagógica sem dados pessoais>",
      "posicao_aproximada": {{
        "inicio_chars": <int ou null>,
        "fim_chars": <int ou null>
      }}
    }}
  ]
}}

Texto do documento:
\"\"\"
{texto}
\"\"\"
"""


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Fase 1 de segmentação: identifica unidades semânticas no documento e gera manifesto de segmentos."
    )
    parser.add_argument(
        "--input",
        required=True,
        help="Arquivo de texto extraído (.texto_extraido.txt).",
    )
    parser.add_argument(
        "--output",
        default=None,
        help="Arquivo JSON de saída (default: saida/<stem>.segmentos.json).",
    )
    parser.add_argument("--base-url", default=None, help="URL base do llama-server (padrão: APDA_LLAMA_BASE_URL ou http://127.0.0.1:8091)")
    parser.add_argument("--max-chars", type=int, default=24000)
    parser.add_argument("--max-tokens", type=int, default=2000)
    parser.add_argument("--temperature", type=float, default=0.1)
    args = parser.parse_args()

    base_url = resolve_base_url(args.base_url)
    input_path = Path(args.input).resolve()

    if args.output is not None:
        output_path = Path(args.output).resolve()
    else:
        stem = input_path.name
        for suffix in (".texto_extraido.txt", ".texto_extraido", ".txt"):
            if stem.endswith(suffix):
                stem = stem[: -len(suffix)]
                break
        output_path = (SAIDA / stem).with_suffix(".segmentos.json")

    text = input_path.read_text(encoding="utf-8")[: args.max_chars]

    prompt = USER_TEMPLATE.format(texto=text)

    payload = {
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": prompt},
        ],
        "temperature": args.temperature,
        "max_tokens": args.max_tokens,
        "response_format": {"type": "json_object"},
    }

    started = time.perf_counter()
    response = post_json(f"{base_url}/v1/chat/completions", payload)
    elapsed = round(time.perf_counter() - started, 3)
    content = response["choices"][0]["message"]["content"]

    output_path.parent.mkdir(parents=True, exist_ok=True)
    raw_path = output_path.with_suffix(output_path.suffix + ".raw.txt")

    try:
        manifest = json.loads(extract_json(content))
    except Exception as exc:
        raw_path.write_text(content, encoding="utf-8")
        metadata_path = output_path.with_suffix(output_path.suffix + ".metadata.json")
        metadata_path.write_text(
            json.dumps(
                {
                    "data": datetime.now().isoformat(),
                    "modelo": response.get("model", "desconhecido"),
                    "servidor": base_url,
                    "entrada": str(input_path),
                    "saida": str(output_path),
                    "raw_saida": str(raw_path),
                    "elapsed_seconds": elapsed,
                    "erro": str(exc),
                    "usage": response.get("usage", {}),
                },
                ensure_ascii=False,
                indent=2,
            ),
            encoding="utf-8",
        )
        raise

    output_path.write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    n_segments = len(manifest.get("segmentos", []))
    usage = response.get("usage", {})

    metadata_path = output_path.with_suffix(output_path.suffix + ".metadata.json")
    metadata_path.write_text(
        json.dumps(
            {
                "data": datetime.now().isoformat(),
                "modelo": response.get("model", "desconhecido"),
                "servidor": base_url,
                "entrada": str(input_path),
                "saida": str(output_path),
                "elapsed_seconds": elapsed,
                "usage": usage,
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )

    print(f"[OK] {n_segments} segmentos identificados: {output_path}")


if __name__ == "__main__":
    main()
