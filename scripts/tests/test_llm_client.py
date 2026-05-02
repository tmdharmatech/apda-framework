"""Testes unitários para scripts/lib/llm_client.py."""

import json
import pytest

from lib.llm_client import extract_json, _repair_truncated_json


# ---------------------------------------------------------------------------
# extract_json — casos de resposta limpa
# ---------------------------------------------------------------------------

def test_extract_json_objeto_simples():
    resposta = '{"chave": "valor"}'
    resultado = extract_json(resposta)
    assert json.loads(resultado) == {"chave": "valor"}


def test_extract_json_com_texto_antes_e_depois():
    resposta = 'Aqui está o resultado:\n{"chave": "valor"}\nObrigado.'
    resultado = extract_json(resposta)
    assert json.loads(resultado) == {"chave": "valor"}


def test_extract_json_com_cerca_markdown():
    resposta = "```json\n{\"chave\": \"valor\"}\n```"
    resultado = extract_json(resposta)
    assert json.loads(resultado) == {"chave": "valor"}


def test_extract_json_com_cerca_markdown_sem_linguagem():
    resposta = "```\n{\"chave\": \"valor\"}\n```"
    resultado = extract_json(resposta)
    assert json.loads(resultado) == {"chave": "valor"}


def test_extract_json_objeto_aninhado():
    payload = {
        "tipo_artefato": "diario_aee",
        "conteudo": {"objetivo": "teste", "itens": [1, 2, 3]},
    }
    resposta = f"Resultado:\n{json.dumps(payload)}"
    resultado = extract_json(resposta)
    assert json.loads(resultado) == payload


def test_extract_json_resposta_sem_json_lanca_erro():
    with pytest.raises(ValueError, match="não contém um objeto JSON"):
        extract_json("Esta resposta não tem nenhum objeto JSON.")


def test_extract_json_string_vazia_lanca_erro():
    with pytest.raises(ValueError):
        extract_json("")


# ---------------------------------------------------------------------------
# extract_json — reparo de JSON truncado
# ---------------------------------------------------------------------------

def test_extract_json_json_truncado_recuperavel():
    """JSON cortado no meio de um array deve ser reparado."""
    truncado = '{"tipo_artefato": "diario_aee", "itens": ["a", "b"'
    resultado = extract_json(truncado)
    parsed = json.loads(resultado)
    assert parsed["tipo_artefato"] == "diario_aee"


def test_extract_json_json_truncado_com_virgula_pendente():
    """JSON com vírgula pendente na última linha deve ser reparado."""
    truncado = '{"a": 1, "b": 2,'
    resultado = extract_json(truncado)
    parsed = json.loads(resultado)
    assert parsed["a"] == 1
    assert parsed["b"] == 2


# ---------------------------------------------------------------------------
# _repair_truncated_json — direto
# ---------------------------------------------------------------------------

def test_repair_fecha_chaves_abertas():
    """_repair_truncated_json opera removendo linhas — o JSON deve estar em múltiplas linhas."""
    truncado = '{\n  "tipo": "diario_aee",\n  "origem": {\n    "nome": "arq.txt"'
    reparado = _repair_truncated_json(truncado)
    parsed = json.loads(reparado)
    assert parsed["tipo"] == "diario_aee"


def test_repair_fecha_arrays_abertos():
    truncado = '{"itens": ["a", "b"'
    reparado = _repair_truncated_json(truncado)
    parsed = json.loads(reparado)
    assert parsed["itens"][0] == "a"


def test_repair_json_irreparavel_lanca_erro():
    with pytest.raises(ValueError, match="reparar"):
        _repair_truncated_json("isso não é JSON de jeito nenhum!!!")


def test_repair_json_valido_nao_modifica():
    valido = '{"chave": "valor"}'
    assert json.loads(_repair_truncated_json(valido)) == {"chave": "valor"}
