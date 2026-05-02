"""Testes unitários para scripts/lib/artifact.py."""

import pytest

from lib.artifact import normalize_artifact


# ---------------------------------------------------------------------------
# Estrutura básica — campos garantidos mesmo com dict vazio
# ---------------------------------------------------------------------------

def test_normalize_artifact_dict_vazio_preenche_obrigatorios():
    resultado = normalize_artifact({})
    assert "conteudo_pedagogico" in resultado
    assert "anonimizacao" in resultado
    assert "validacao_humana" in resultado
    assert "metadados_processamento" in resultado


def test_normalize_artifact_objetivo_pedagogico_garantido():
    """normalize_artifact deve garantir objetivo_pedagogico mesmo quando ausente."""
    resultado = normalize_artifact({"conteudo_pedagogico": {}})
    assert "objetivo_pedagogico" in resultado["conteudo_pedagogico"]
    assert resultado["conteudo_pedagogico"]["objetivo_pedagogico"] is None


def test_normalize_artifact_validacao_humana_forcada():
    resultado = normalize_artifact({"validacao_humana": {"necessaria": False, "status": "validado"}})
    assert resultado["validacao_humana"]["necessaria"] is True
    assert resultado["validacao_humana"]["status"] == "pendente"
    assert resultado["validacao_humana"]["responsavel"] is None


def test_normalize_artifact_anonimizacao_aplicada_forcada():
    resultado = normalize_artifact({})
    assert resultado["anonimizacao"]["aplicada"] is True


def test_normalize_artifact_metadados_status_forcado():
    resultado = normalize_artifact({"metadados_processamento": {"status": "processado"}})
    assert resultado["metadados_processamento"]["status"] == "pendente_revisao"


def test_normalize_artifact_pipeline_versao_default():
    resultado = normalize_artifact({})
    assert resultado["metadados_processamento"]["pipeline_versao"] == "apda-local-0.3"


def test_normalize_artifact_pipeline_versao_customizada():
    resultado = normalize_artifact({}, pipeline_versao="apda-local-1.0")
    assert resultado["metadados_processamento"]["pipeline_versao"] == "apda-local-1.0"


# ---------------------------------------------------------------------------
# conteudo_pedagogico — arrays normalizados
# ---------------------------------------------------------------------------

def test_normalize_artifact_arrays_pedagogicos_viram_listas():
    artifact = {
        "conteudo_pedagogico": {
            "barreiras_identificadas": "não é uma lista",
            "estrategias_pedagogicas": None,
            "recursos_acessibilidade": 42,
        }
    }
    resultado = normalize_artifact(artifact)
    cp = resultado["conteudo_pedagogico"]
    assert cp["barreiras_identificadas"] == []
    assert cp["estrategias_pedagogicas"] == []
    assert cp["recursos_acessibilidade"] == []


def test_normalize_artifact_arrays_limitados_a_6_itens():
    artifact = {
        "conteudo_pedagogico": {
            "barreiras_identificadas": [f"item{i}" for i in range(10)],
        }
    }
    resultado = normalize_artifact(artifact)
    assert len(resultado["conteudo_pedagogico"]["barreiras_identificadas"]) == 6


def test_normalize_artifact_itens_de_array_viram_strings():
    artifact = {
        "conteudo_pedagogico": {
            "barreiras_identificadas": [1, 2, True],
        }
    }
    resultado = normalize_artifact(artifact)
    assert resultado["conteudo_pedagogico"]["barreiras_identificadas"] == ["1", "2", "True"]


# ---------------------------------------------------------------------------
# anonimizacao — filtro de labels
# ---------------------------------------------------------------------------

def test_normalize_artifact_labels_validos_mantidos():
    artifact = {"anonimizacao": {"itens_mascarados": ["private_person", "private_email"]}}
    resultado = normalize_artifact(artifact)
    assert "private_person" in resultado["anonimizacao"]["itens_mascarados"]
    assert "private_email" in resultado["anonimizacao"]["itens_mascarados"]


def test_normalize_artifact_labels_invalidos_removidos():
    artifact = {"anonimizacao": {"itens_mascarados": ["cpf_inventado", "label_ficticia"]}}
    resultado = normalize_artifact(artifact)
    # Labels inválidos são removidos; fallback para private_person
    assert resultado["anonimizacao"]["itens_mascarados"] == ["private_person"]


def test_normalize_artifact_labels_regex_validos():
    """Labels produzidos pelo regex-anon devem ser aceitos."""
    artifact = {
        "anonimizacao": {
            "itens_mascarados": ["cpf", "telefone", "data", "cep", "nome_estudante", "email"]
        }
    }
    resultado = normalize_artifact(artifact)
    mascarados = resultado["anonimizacao"]["itens_mascarados"]
    assert "cpf" in mascarados
    assert "telefone" in mascarados
    assert "nome_estudante" in mascarados


def test_normalize_artifact_labels_duplicados_deduplicados():
    artifact = {
        "anonimizacao": {
            "itens_mascarados": ["private_person", "private_person", "private_email"]
        }
    }
    resultado = normalize_artifact(artifact)
    mascarados = resultado["anonimizacao"]["itens_mascarados"]
    assert mascarados.count("private_person") == 1


def test_normalize_artifact_labels_vazios_fallback_para_private_person():
    artifact = {"anonimizacao": {"itens_mascarados": []}}
    resultado = normalize_artifact(artifact)
    assert resultado["anonimizacao"]["itens_mascarados"] == ["private_person"]


def test_normalize_artifact_risco_default():
    resultado = normalize_artifact({})
    assert resultado["anonimizacao"]["risco_reidentificacao"] == "nao_avaliado"


# ---------------------------------------------------------------------------
# origem — conversão de campos de segmento
# ---------------------------------------------------------------------------

def test_normalize_artifact_segmento_indice_string_vira_int():
    artifact = {"origem": {"segmento_indice": "3", "segmento_total": "10"}}
    resultado = normalize_artifact(artifact)
    assert resultado["origem"]["segmento_indice"] == 3
    assert resultado["origem"]["segmento_total"] == 10


def test_normalize_artifact_segmento_invalido_vira_none():
    artifact = {"origem": {"segmento_indice": "não_é_número"}}
    resultado = normalize_artifact(artifact)
    assert resultado["origem"]["segmento_indice"] is None


def test_normalize_artifact_sem_origem_nao_cria_campo():
    """normalize_artifact não deve criar 'origem' quando ausente."""
    resultado = normalize_artifact({})
    assert "origem" not in resultado


# ---------------------------------------------------------------------------
# Campos extras / inventados — não devem ser removidos
# ---------------------------------------------------------------------------

def test_normalize_artifact_campos_extras_preservados():
    artifact = {"campo_inventado": "valor", "outro_campo": 123}
    resultado = normalize_artifact(artifact)
    assert resultado["campo_inventado"] == "valor"
    assert resultado["outro_campo"] == 123
