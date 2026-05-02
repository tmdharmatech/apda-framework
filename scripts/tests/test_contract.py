"""Teste de contrato: normalize_artifact() produz artefatos válidos segundo o JSON Schema.

Garante que o gerador Python e o schema JSON não divergem silenciosamente.
"""

import json
from pathlib import Path

import jsonschema
import pytest

from lib.artifact import normalize_artifact

SCHEMA_PATH = Path(__file__).resolve().parents[2] / "schemas" / "artefato_pedagogico.schema.json"


@pytest.fixture(scope="module")
def schema():
    return json.loads(SCHEMA_PATH.read_text(encoding="utf-8"))


def _artefato_minimo():
    """Artefato com apenas os campos obrigatórios pelo schema."""
    return {
        "tipo_artefato": "diario_aee",
        "origem": {
            "nome_arquivo": "aula01.txt",
            "formato_original": "txt",
        },
        "conteudo_pedagogico": {
            "objetivo_pedagogico": None,
        },
        "anonimizacao": {
            "aplicada": True,
            "itens_mascarados": ["private_person"],
            "risco_reidentificacao": "nao_avaliado",
        },
        "metadados_processamento": {
            "pipeline_versao": "apda-local-0.3",
            "data_processamento": "2026-05-01T00:00:00",
            "status": "pendente_revisao",
        },
        "validacao_humana": {
            "necessaria": True,
            "status": "pendente",
        },
    }


def _validar(schema, artifact):
    validator = jsonschema.Draft202012Validator(schema)
    errors = list(validator.iter_errors(artifact))
    return errors


# ---------------------------------------------------------------------------
# Contrato principal
# ---------------------------------------------------------------------------

def test_normalize_artifact_produz_artefato_valido_segundo_schema(schema):
    """normalize_artifact() em um artefato mínimo deve gerar um artefato que passa no schema."""
    artifact = normalize_artifact(_artefato_minimo())
    errors = _validar(schema, artifact)
    assert errors == [], (
        "normalize_artifact() produziu artefato inválido:\n"
        + "\n".join(f"  {e.json_path}: {e.message}" for e in errors)
    )


def test_artefato_minimo_sem_normalize_ja_e_valido(schema):
    """O artefato mínimo de referência deve ser válido por si só."""
    artifact = _artefato_minimo()
    errors = _validar(schema, artifact)
    assert errors == [], (
        "Artefato mínimo de referência inválido:\n"
        + "\n".join(f"  {e.json_path}: {e.message}" for e in errors)
    )


def test_normalize_artifact_com_todos_os_campos_opcionais(schema):
    """normalize_artifact() com campos opcionais preenchidos ainda deve ser válido."""
    artifact = _artefato_minimo()
    artifact["conteudo_pedagogico"] = {
        "objetivo_pedagogico": "Desenvolver leitura funcional.",
        "barreiras_identificadas": ["Dificuldade de atenção"],
        "estrategias_pedagogicas": ["Uso de pictogramas"],
        "recursos_acessibilidade": ["Lupa eletrônica"],
        "observacoes_relevantes": "Aluno com laudo TEA.",
    }
    artifact["anonimizacao"] = {
        "aplicada": True,
        "itens_mascarados": ["private_person"],
        "risco_reidentificacao": "baixo",
    }
    artifact["origem"]["segmento_indice"] = 1
    artifact["origem"]["segmento_total"] = 3
    artifact = normalize_artifact(artifact)
    errors = _validar(schema, artifact)
    assert errors == [], (
        "Artefato completo inválido após normalize:\n"
        + "\n".join(f"  {e.json_path}: {e.message}" for e in errors)
    )


def test_artefato_sem_campos_obrigatorios_e_invalido(schema):
    """Um dict vazio não deve passar na validação do schema."""
    errors = _validar(schema, {})
    # Schema exige: tipo_artefato, origem, conteudo_pedagogico,
    # anonimizacao, metadados_processamento, validacao_humana
    assert len(errors) > 0
    campos_com_required = [e for e in errors if e.validator == "required"]
    assert len(campos_com_required) > 0, "Esperado pelo menos um erro de campo obrigatório ausente"


def test_tipo_artefato_invalido_falha_no_schema(schema):
    artifact = _artefato_minimo()
    artifact["tipo_artefato"] = "tipo_inventado_inexistente"
    errors = _validar(schema, artifact)
    assert any(e.validator == "enum" for e in errors)
