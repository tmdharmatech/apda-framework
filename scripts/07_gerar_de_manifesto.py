"""07_gerar_de_manifesto.py — Fase 2 do workflow de segmentação.

Lê o manifesto produzido por 02_scan_segments.py e o texto anonimizado e,
para cada segmento listado, chama o LLM para gerar um APDA JSON separado.

Saída esperada (um arquivo por tipo_artefato × segmento):
  saida/<stem>.seg<indice>.<tipo_artefato>.apda.json

Ao final, salva:
  saida/<stem>.manifesto_processado.json
"""

from __future__ import annotations

import argparse
import json
import re
import time
from datetime import datetime
from pathlib import Path

from lib.artifact import normalize_artifact
from lib.llm_client import extract_json, post_json
from lib.paths import SAIDA
from lib.config import resolve_base_url


# ---------------------------------------------------------------------------
# Prompts
# ---------------------------------------------------------------------------

SYSTEM_PROMPT = """\
Você transforma um trecho de registro pedagógico anonimizado em um artefato JSON estruturado.

REGRAS OBRIGATÓRIAS:
- Responda SOMENTE com JSON válido, sem markdown.
- Não invente nomes, documentos, datas, diagnósticos ou responsáveis.
- Preserve marcadores como [PRIVATE_PERSON] apenas quando forem pedagogicamente relevantes.
- Em anonimizacao.itens_mascarados, use somente categorias únicas.
- Limite cada array pedagógico a no máximo 6 itens.
- Use null quando a informação não estiver clara no trecho fornecido.
- validacao_humana.necessaria deve ser true e status deve ser "pendente".
- validacao_humana.responsavel deve ser null.
- O campo tipo_artefato deve ser exatamente o tipo solicitado.\
"""

USER_TEMPLATE = """\
Gere um artefato pedagógico digital aberto do tipo "{tipo_artefato}" a partir do trecho anonimizado abaixo.
Este trecho corresponde ao segmento {indice} de {total} do documento "{nome_arquivo}".
Seção de origem: {secao_origem}

O JSON deve seguir esta estrutura:
{{
  "tipo_artefato": "{tipo_artefato}",
  "origem": {{
    "nome_arquivo": "{nome_arquivo}",
    "formato_original": "{formato_original}",
    "pagina_ou_aba": {secao_origem_json},
    "segmento_indice": {indice},
    "segmento_total": {total}
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
    "itens_mascarados": ["private_person"],
    "risco_reidentificacao": "nao_avaliado"
  }},
  "metadados_processamento": {{
    "pipeline_versao": "apda-local-0.3-segmented",
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

Trecho anonimizado:
\"\"\"
{texto}
\"\"\"\
"""


# ---------------------------------------------------------------------------
# Segment text extraction
# ---------------------------------------------------------------------------


def extract_segment_text(full_text: str, segment: dict, max_chars: int) -> str:
    """Extrai o trecho do texto completo correspondente ao segmento.

    Usa posicao_aproximada.inicio_chars / fim_chars quando disponíveis;
    caso contrário, devolve o texto inteiro truncado a max_chars.
    """
    pos = segment.get("posicao_aproximada") or {}
    inicio = pos.get("inicio_chars")
    fim = pos.get("fim_chars")

    if isinstance(inicio, int) and isinstance(fim, int) and fim > inicio:
        trecho = full_text[inicio:fim]
    else:
        trecho = full_text

    return trecho[:max_chars]


# ---------------------------------------------------------------------------
# main
# ---------------------------------------------------------------------------


def main() -> None:
    parser = argparse.ArgumentParser(
        description=(
            "Fase 2 do workflow de segmentação: gera APDAs JSON a partir de um manifesto "
            "produzido por 02_scan_segments.py."
        )
    )
    parser.add_argument("--manifest", required=True, help="Caminho para o .segmentos.json.")
    parser.add_argument("--input", required=True, help="Texto anonimizado .opf_anonimizado.txt.")
    parser.add_argument("--output-dir", default=str(SAIDA), help="Diretório de saída.")
    parser.add_argument("--base-url", default=None, help="URL base do llama-server (padrão: APDA_LLAMA_BASE_URL ou http://127.0.0.1:8091)")
    parser.add_argument(
        "--max-chars-per-segment",
        type=int,
        default=12000,
        help="Máximo de caracteres por segmento enviado ao LLM.",
    )
    parser.add_argument("--max-tokens", type=int, default=1200)
    parser.add_argument("--temperature", type=float, default=0.1)
    args = parser.parse_args()

    base_url = resolve_base_url(args.base_url)
    manifest_path = Path(args.manifest).resolve()
    input_path = Path(args.input).resolve()
    output_dir = Path(args.output_dir).resolve()
    output_dir.mkdir(parents=True, exist_ok=True)

    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    full_text = input_path.read_text(encoding="utf-8")

    segments: list[dict] = manifest.get("segmentos", [])
    total_segments = len(segments)

    stem = input_path.name
    for suffix in (".opf_anonimizado.txt", ".txt"):
        if stem.endswith(suffix):
            stem = stem[: -len(suffix)]
            break

    resultado_segmentos: list[dict] = []
    total_artifacts = 0

    print(f"[INFO] manifesto: {manifest_path.name} | {total_segments} segmento(s)")
    print(f"[INFO] texto:     {input_path.name} ({len(full_text)} chars)")

    for segment in segments:
        indice = segment.get("indice", 0)
        tipos: list[str] = (
            segment.get("tipos_artefato") or segment.get("tipo_artefato") or []
        )
        if isinstance(tipos, str):
            tipos = [tipos]
        if not tipos:
            print(f"[AVISO] segmento {indice} sem tipos_artefato — ignorado")
            resultado_segmentos.append(
                {
                    "indice": indice,
                    "status": "ignorado",
                    "motivo": "sem tipos_artefato",
                    "artefatos": [],
                }
            )
            continue

        trecho = extract_segment_text(full_text, segment, args.max_chars_per_segment)
        artefatos_gerados: list[dict] = []

        for tipo_artefato in tipos:
            slug = re.sub(r"[^\w\-]", "_", tipo_artefato).lower()
            output_name = f"{stem}.seg{indice}.{slug}.apda.json"
            output_path = output_dir / output_name
            raw_path = output_path.with_suffix(output_path.suffix + ".raw.txt")

            print(
                f"  [→] seg{indice}/{total_segments} tipo={tipo_artefato} "
                f"({len(trecho)} chars) → {output_name}"
            )

            started = time.perf_counter()
            raw_content: str | None = None
            erro: str | None = None
            usage: dict = {}

            try:
                payload = {
                    "messages": [
                        {"role": "system", "content": SYSTEM_PROMPT},
                        {
                            "role": "user",
                            "content": USER_TEMPLATE.format(
                                tipo_artefato=tipo_artefato,
                                indice=indice,
                                total=total_segments,
                                nome_arquivo=input_path.name,
                                formato_original=input_path.suffix.lstrip(".") or "txt",
                                secao_origem=(
                                    segment.get("secao_origem")
                                    or segment.get("tipo_conteudo")
                                    or "desconhecida"
                                ),
                                secao_origem_json=json.dumps(
                                    segment.get("secao_origem")
                                    or segment.get("tipo_conteudo")
                                    or "desconhecida",
                                    ensure_ascii=False,
                                ),
                                data_processamento=datetime.now().isoformat(),
                                texto=trecho,
                            ),
                        },
                    ],
                    "temperature": args.temperature,
                    "max_tokens": args.max_tokens,
                    "response_format": {"type": "json_object"},
                }

                response = post_json(f"{base_url}/v1/chat/completions", payload)
                raw_str: str = response["choices"][0]["message"]["content"]
                raw_content = raw_str
                usage = response.get("usage", {})

                raw_path.write_text(raw_str, encoding="utf-8")

                artifact = normalize_artifact(
                    json.loads(extract_json(raw_str)),
                    pipeline_versao="apda-local-0.3-segmented",
                )

                origem = artifact.setdefault("origem", {})
                origem.setdefault("nome_arquivo", input_path.name)
                origem.setdefault("formato_original", input_path.suffix.lstrip(".") or "txt")
                origem["segmento_indice"] = indice
                origem["segmento_total"] = total_segments
                if "pagina_ou_aba" not in origem:
                    origem["pagina_ou_aba"] = (
                        segment.get("secao_origem")
                        or segment.get("tipo_conteudo")
                        or "desconhecida"
                    )
                artifact["tipo_artefato"] = tipo_artefato

                output_path.write_text(
                    json.dumps(artifact, ensure_ascii=False, indent=2), encoding="utf-8"
                )

                elapsed = round(time.perf_counter() - started, 3)
                print(f"  [OK] {output_name} | tempo={elapsed}s usage={usage}")
                total_artifacts += 1
                artefatos_gerados.append(
                    {
                        "tipo_artefato": tipo_artefato,
                        "arquivo": output_name,
                        "status": "ok",
                        "elapsed_seconds": elapsed,
                        "usage": usage,
                    }
                )

            except Exception as exc:
                elapsed = round(time.perf_counter() - started, 3)
                erro = str(exc)
                print(f"  [ERRO] seg{indice} tipo={tipo_artefato}: {erro}")

                if raw_content is not None:
                    raw_path.write_text(raw_content, encoding="utf-8")

                error_meta = output_path.with_suffix(output_path.suffix + ".error.json")
                error_meta.write_text(
                    json.dumps(
                        {
                            "data": datetime.now().isoformat(),
                            "segmento_indice": indice,
                            "tipo_artefato": tipo_artefato,
                            "entrada": str(input_path),
                            "saida_esperada": str(output_path),
                            "raw_saida": str(raw_path) if raw_content is not None else None,
                            "elapsed_seconds": elapsed,
                            "erro": erro,
                            "usage": usage,
                        },
                        ensure_ascii=False,
                        indent=2,
                    ),
                    encoding="utf-8",
                )

                artefatos_gerados.append(
                    {
                        "tipo_artefato": tipo_artefato,
                        "arquivo": output_name,
                        "status": "erro",
                        "elapsed_seconds": elapsed,
                        "erro": erro,
                    }
                )

        status_seg = (
            "ok"
            if all(a["status"] == "ok" for a in artefatos_gerados)
            else (
                "parcial"
                if any(a["status"] == "ok" for a in artefatos_gerados)
                else "erro"
            )
        )
        resultado_segmentos.append(
            {
                "indice": indice,
                "status": status_seg,
                "artefatos": artefatos_gerados,
            }
        )

    manifesto_processado = {
        "data_processamento": datetime.now().isoformat(),
        "pipeline_versao": "apda-local-0.3-segmented",
        "arquivo_entrada": input_path.name,
        "arquivo_manifesto": manifest_path.name,
        "total_segmentos": total_segments,
        "total_artefatos_gerados": total_artifacts,
        "segmentos": resultado_segmentos,
    }
    manifesto_out = output_dir / f"{stem}.manifesto_processado.json"
    manifesto_out.write_text(
        json.dumps(manifesto_processado, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(f"[INFO] manifesto processado salvo: {manifesto_out.name}")
    print(
        f"[OK] {total_segments} segmentos processados, {total_artifacts} artefatos gerados"
    )


if __name__ == "__main__":
    main()
