"""Normalização de artefatos pedagógicos APDA.

Consolida normalize_artifact() que estava duplicado (com variações)
em 05_gerar_artefato_3b.py e 07_gerar_de_manifesto.py.
"""

from __future__ import annotations

from datetime import datetime

# Labels reconhecidos pelo schema artefato_pedagogico.schema.json.
# Inclui labels do Privacy Filter neural (private_*) e do regex-anon
# (cpf, telefone, data, cep, nome_estudante, email).
_ALLOWED_LABELS = {
    "private_person",
    "private_address",
    "private_email",
    "private_phone",
    "private_url",
    "private_date",
    "account_number",
    "secret",
    "email",
    "cpf",
    "telefone",
    "data",
    "cep",
    "nome_estudante",
}


def normalize_artifact(
    artifact: dict,
    pipeline_versao: str = "apda-local-0.3",
) -> dict:
    """Normaliza e valida os campos obrigatórios de um artefato APDA.

    - Garante que arrays pedagógicos são listas de strings (máx. 6 itens).
    - Garante que objetivo_pedagogico está presente (pode ser null).
    - Filtra itens_mascarados para o conjunto de labels permitidos.
    - Força validacao_humana.necessaria=True e status="pendente".
    - Converte segmento_indice/segmento_total para int quando presentes em origem.
    """
    # --- conteudo_pedagogico ---
    content = artifact.setdefault("conteudo_pedagogico", {})
    content.setdefault("objetivo_pedagogico", None)
    for key in (
        "barreiras_identificadas",
        "estrategias_pedagogicas",
        "recursos_acessibilidade",
    ):
        value = content.get(key)
        if not isinstance(value, list):
            content[key] = []
        else:
            content[key] = [str(item) for item in value[:6]]

    # --- anonimizacao ---
    anon = artifact.setdefault("anonimizacao", {})
    anon["aplicada"] = True
    labels = anon.get("itens_mascarados")
    if not isinstance(labels, list):
        labels = []
    unique_labels: list[str] = []
    for label in labels:
        label = str(label).strip("[]").lower()
        if label in _ALLOWED_LABELS and label not in unique_labels:
            unique_labels.append(label)
    anon["itens_mascarados"] = unique_labels or ["private_person"]
    anon.setdefault("risco_reidentificacao", "nao_avaliado")

    # --- validacao_humana ---
    validation = artifact.setdefault("validacao_humana", {})
    validation["necessaria"] = True
    validation["status"] = "pendente"
    validation["responsavel"] = None

    # --- metadados_processamento ---
    metadata = artifact.setdefault("metadados_processamento", {})
    metadata.setdefault("pipeline_versao", pipeline_versao)
    metadata.setdefault("data_processamento", datetime.now().isoformat())
    metadata["status"] = "pendente_revisao"
    metadata.setdefault("confianca_extracao", "nao_calculada")

    # --- origem: normaliza campos de segmento quando presentes ---
    origem = artifact.get("origem")
    if isinstance(origem, dict):
        for field in ("segmento_indice", "segmento_total"):
            if field in origem and not isinstance(origem[field], (int, type(None))):
                try:
                    origem[field] = int(origem[field])
                except (ValueError, TypeError):
                    origem[field] = None

    return artifact
