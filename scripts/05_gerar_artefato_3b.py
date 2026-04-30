from __future__ import annotations

import argparse
import json
import os
import re
import time
import urllib.request
from datetime import datetime
from pathlib import Path


BASE = Path(__file__).resolve().parents[1]
SAIDA = BASE / "saida"

METRICS_PUSH_URL = os.environ.get("APDA_METRICS_URL", "http://127.0.0.1:8000/push")


def _push_metrics(payload: dict) -> None:
    """Envia métricas ao exportador APDA via HTTP POST (fire-and-forget)."""
    try:
        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            METRICS_PUSH_URL, data=data,
            headers={"Content-Type": "application/json"}, method="POST",
        )
        urllib.request.urlopen(req, timeout=2)
    except Exception:
        pass


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


def post_json(url: str, payload: dict, timeout: int = 300, api_key: str | None = None) -> dict:
    headers = {"Content-Type": "application/json"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers=headers, method="POST")
    with urllib.request.urlopen(req, timeout=timeout) as response:
        return json.loads(response.read().decode("utf-8"))


def extract_json(text: str) -> str:
    clean = text.strip()
    if clean.startswith("```"):
        clean = re.sub(r"^```(?:json)?", "", clean).strip()
        clean = re.sub(r"```$", "", clean).strip()
    start = clean.find("{")
    end = clean.rfind("}")
    if start == -1 or end == -1 or end < start:
        raise ValueError("A resposta nao contem um objeto JSON.")
    return clean[start : end + 1]


def normalize_artifact(artifact: dict) -> dict:
    content = artifact.setdefault("conteudo_pedagogico", {})
    for key in (
        "barreiras_identificadas",
        "estrategias_pedagogicas",
        "recursos_acessibilidade",
    ):
        value = content.get(key)
        if not isinstance(value, list):
            content[key] = []
            continue
        content[key] = [str(item) for item in value[:6]]

    anon = artifact.setdefault("anonimizacao", {})
    anon["aplicada"] = True
    labels = anon.get("itens_mascarados")
    if not isinstance(labels, list):
        labels = []
    allowed = {
        "private_person",
        "private_address",
        "private_email",
        "private_phone",
        "private_url",
        "private_date",
        "account_number",
        "secret",
    }
    unique_labels = []
    for label in labels:
        label = str(label).strip("[]").lower()
        if label in allowed and label not in unique_labels:
            unique_labels.append(label)
    anon["itens_mascarados"] = unique_labels or ["private_person"]
    anon.setdefault("risco_reidentificacao", "nao_avaliado")

    validation = artifact.setdefault("validacao_humana", {})
    validation["necessaria"] = True
    validation["status"] = "pendente"
    validation["responsavel"] = None

    metadata = artifact.setdefault("metadados_processamento", {})
    metadata.setdefault("pipeline_versao", "apda-local-0.2-opf")
    metadata.setdefault("data_processamento", datetime.now().isoformat())
    metadata["status"] = "pendente_revisao"
    metadata.setdefault("confianca_extracao", "nao_calculada")
    return artifact


def _detect_base_url(args) -> tuple[str, str | None]:
    """Returns (base_url, api_key). When --litellm is set or APDA_LITELLM=1,
    routes through the LiteLLM proxy; otherwise talks to llama-server directly."""
    use_litellm = args.litellm or os.environ.get("APDA_LITELLM") == "1"
    if use_litellm:
        base = args.base_url if args.base_url != "http://127.0.0.1:8091" else "http://127.0.0.1:4000"
        key = args.api_key or os.environ.get("LITELLM_MASTER_KEY", "apda-master-key")
        return base, key
    return args.base_url, args.api_key


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Gera artefato JSON com Qwen2.5 3B via llama-server ou LiteLLM proxy."
    )
    parser.add_argument("--input", required=True, help="Texto anonimizado por Privacy Filter.")
    parser.add_argument("--output", required=True, help="Arquivo JSON de saida.")
    parser.add_argument("--base-url", default="http://127.0.0.1:8091")
    parser.add_argument("--max-chars", type=int, default=18000)
    parser.add_argument("--max-tokens", type=int, default=1200)
    parser.add_argument("--temperature", type=float, default=0.1)
    parser.add_argument("--litellm", action="store_true",
                        help="Roteia via LiteLLM proxy (porta 4000) em vez de llama-server direto.")
    parser.add_argument("--api-key", default=None,
                        help="API key para autenticacao no LiteLLM proxy.")
    parser.add_argument("--modelo", default=None,
                        help="Nome logico do modelo no LiteLLM (ex: apda-local-3b).")
    parser.add_argument("--municipio", default="desconhecido",
                        help="Municipio de origem (para metricas).")
    args = parser.parse_args()

    base_url, api_key = _detect_base_url(args)
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

    resultado = {
        "json_valido": False,
        "motivo_invalido": None,
        "campos_inventados": [],
        "pii_detectado_saida": [],
        "entidades_anonimizadas": [],
        "tipo_artefato": "desconhecido",
    }

    started = time.perf_counter()
    try:
        response = post_json(
            f"{base_url}/v1/chat/completions", payload, api_key=api_key,
        )
    except Exception as exc:
        resultado["motivo_invalido"] = f"request_error: {type(exc).__name__}"
        _push_metrics({
            "action": "resultado",
            "resultado": resultado,
            "municipio": args.municipio,
            "workflow": "generate-apda-json",
            "modelo": modelo_label,
            "formato": formato,
        })
        raise

    elapsed = round(time.perf_counter() - started, 3)
    content = response["choices"][0]["message"]["content"]

    output_path.parent.mkdir(exist_ok=True)
    raw_path = output_path.with_suffix(output_path.suffix + ".raw.txt")
    raw_path.write_text(content, encoding="utf-8")

    try:
        artifact = normalize_artifact(json.loads(extract_json(content)))
        resultado["json_valido"] = True
        if artifact.get("tipo_artefato"):
            resultado["tipo_artefato"] = artifact["tipo_artefato"]
    except Exception as exc:
        resultado["motivo_invalido"] = f"json_decode_error: {str(exc)[:50]}"
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
        _push_metrics({
            "action": "resultado",
            "resultado": resultado,
            "municipio": args.municipio,
            "workflow": "generate-apda-json",
            "modelo": modelo_label,
            "formato": formato,
        })
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

    _push_metrics({
        "action": "resultado",
        "resultado": resultado,
        "municipio": args.municipio,
        "workflow": "generate-apda-json",
        "modelo": modelo_label,
        "formato": formato,
    })
    _push_metrics({
        "action": "tempo",
        "workflow": "generate-apda-json",
        "formato": formato,
        "modelo": modelo_label,
        "elapsed": elapsed,
    })

    print(f"[OK] artefato gerado: {output_path}")
    print(f"[OK] tempo={elapsed}s modelo={modelo_label} usage={usage}")


if __name__ == "__main__":
    main()
