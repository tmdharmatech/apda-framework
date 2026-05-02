from __future__ import annotations

import argparse
import json
import time
from datetime import datetime
from pathlib import Path

from lib.artifact import normalize_artifact
from lib.llm_client import extract_json, post_json
from lib.paths import SAIDA
from lib.config import resolve_litellm


SYSTEM_PROMPT = """Voce transforma registros pedagogicos anonimizados em artefatos JSON.
Regras obrigatorias:
- Responda somente com JSON valido, sem markdown.
- Nao invente nomes, documentos, datas, diagnósticos ou responsaveis.
- Preserve marcadores como [PRIVATE_PERSON] apenas quando forem pedagogicamente necessarios.
- Em anonimizacao.itens_mascarados, use somente categorias unicas como "private_person" e "private_phone"; nunca repita placeholders.
- Limite cada array pedagogico a no maximo 6 itens.
- Use null quando a informacao nao estiver clara.
- validacao_humana.necessaria deve ser true e validacao_humana.status deve ser "pendente".
- validacao_humana.responsavel deve ser null.
"""


USER_TEMPLATE = """Gere um artefato pedagogico digital aberto a partir do texto anonimizado.

O JSON deve seguir esta estrutura:
{{
  "tipo_artefato": "estudo_de_caso|plano_atendimento|relatorio_pedagogico|diario_aee|atividade_adaptada|outro",
  "origem": {{
    "nome_arquivo": "{nome_arquivo}",
    "formato_original": "{formato_original}",
    "pagina_ou_aba": null
  }},
  "conteudo_pedagogico": {{
    "objetivo_pedagogico": null,
    "barreiras_identificadas": [],
    "estrategias_pedagogicas": [],
    "recursos_acessibilidade": [],
    "observacoes_relevantes": null
  }},
  "anonimizacao": {{
    "aplicada": true,
    "itens_mascarados": ["private_person", "private_phone"],
    "risco_reidentificacao": "nao_avaliado"
  }},
  "metadados_processamento": {{
    "pipeline_versao": "apda-local-0.2-opf",
    "data_processamento": "{data_processamento}",
    "status": "pendente_revisao",
    "confianca_extracao": "nao_calculada"
  }},
  "validacao_humana": {{
    "necessaria": true,
    "status": "pendente",
    "responsavel": null
  }}
}}

Texto anonimizado:
\"\"\"
{texto}
\"\"\"
"""


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Gera artefato JSON com Qwen2.5 3B via llama-server ou LiteLLM proxy."
    )
    parser.add_argument("--input", required=True, help="Texto anonimizado por Privacy Filter.")
    parser.add_argument("--output", required=True, help="Arquivo JSON de saida.")
    parser.add_argument("--base-url", default=None, help="URL base do llama-server (padrão: APDA_LLAMA_BASE_URL ou http://127.0.0.1:8091)")
    parser.add_argument("--max-chars", type=int, default=18000)
    parser.add_argument("--max-tokens", type=int, default=1200)
    parser.add_argument("--temperature", type=float, default=0.1)
    parser.add_argument(
        "--litellm",
        action="store_true",
        help="Roteia via LiteLLM proxy (porta 4000) em vez de llama-server direto.",
    )
    parser.add_argument("--api-key", default=None, help="API key para autenticacao no LiteLLM proxy.")
    parser.add_argument("--modelo", default=None, help="Nome logico do modelo no LiteLLM (ex: apda-local-3b).")
    parser.add_argument("--municipio", default="desconhecido", help="Municipio de origem.")
    args = parser.parse_args()

    base_url, api_key = resolve_litellm(args.base_url, args.api_key, args.litellm)
    modelo_label = args.modelo or "apda-local-3b"

    input_path = Path(args.input).resolve()
    output_path = Path(args.output).resolve()
    text = input_path.read_text(encoding="utf-8")[: args.max_chars]
    formato = input_path.suffix.lstrip(".") or "txt"

    prompt = USER_TEMPLATE.format(
        nome_arquivo=input_path.name,
        formato_original=formato,
        data_processamento=datetime.now().isoformat(),
        texto=text,
    )

    payload = {
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": prompt},
        ],
        "temperature": args.temperature,
        "max_tokens": args.max_tokens,
        "response_format": {"type": "json_object"},
    }

    if api_key:
        payload["model"] = modelo_label
        payload["metadata"] = {
            "workflow": "generate-apda-json",
            "municipio": args.municipio,
        }

    started = time.perf_counter()
    response = post_json(
        f"{base_url}/v1/chat/completions", payload, api_key=api_key,
    )

    elapsed = round(time.perf_counter() - started, 3)
    content = response["choices"][0]["message"]["content"]

    output_path.parent.mkdir(exist_ok=True)
    raw_path = output_path.with_suffix(output_path.suffix + ".raw.txt")
    raw_path.write_text(content, encoding="utf-8")

    try:
        artifact = normalize_artifact(
            json.loads(extract_json(content)),
            pipeline_versao="apda-local-0.2-opf",
        )
    except Exception as exc:
        metadata_path = output_path.with_suffix(output_path.suffix + ".metadata.json")
        metadata_path.write_text(
            json.dumps(
                {
                    "data": datetime.now().isoformat(),
                    "modelo": modelo_label,
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

    output_path.write_text(json.dumps(artifact, ensure_ascii=False, indent=2), encoding="utf-8")

    usage = response.get("usage", {})
    metadata_path = output_path.with_suffix(output_path.suffix + ".metadata.json")
    metadata_path.write_text(
        json.dumps(
            {
                "data": datetime.now().isoformat(),
                "modelo": modelo_label,
                "servidor": base_url,
                "entrada": str(input_path),
                "saida": str(output_path),
                "raw_saida": str(raw_path),
                "elapsed_seconds": elapsed,
                "usage": usage,
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )

    print(f"[OK] artefato gerado: {output_path}")
    print(f"[OK] tempo={elapsed}s modelo={modelo_label} usage={usage}")


if __name__ == "__main__":
    main()
