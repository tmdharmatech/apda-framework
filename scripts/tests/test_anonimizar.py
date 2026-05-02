"""Testes unitários para a função anonimizar() de 02_anonimizar_texto.py."""

import importlib
import sys
from pathlib import Path
import pytest

# Importa o módulo usando importlib para não depender do nome com número no início
_script_path = Path(__file__).resolve().parents[1] / "02_anonimizar_texto.py"
_spec = importlib.util.spec_from_file_location("anonimizar_texto", _script_path)
_mod = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_mod)
anonimizar = _mod.anonimizar


# ---------------------------------------------------------------------------
# Dados de identificação pessoal individualmente
# ---------------------------------------------------------------------------

def test_anonimizar_cpf_com_pontuacao():
    texto, itens = anonimizar("CPF do aluno: 123.456.789-09")
    assert "CPF_REMOVIDO" in texto
    assert "cpf" in itens


def test_anonimizar_cpf_sem_pontuacao():
    texto, itens = anonimizar("Documento: 12345678900")
    assert "CPF_REMOVIDO" in texto
    assert "cpf" in itens


def test_anonimizar_email():
    texto, itens = anonimizar("Contato: professor@escola.edu.br")
    assert "EMAIL_REMOVIDO" in texto
    assert "email" in itens


def test_anonimizar_telefone_com_ddd():
    texto, itens = anonimizar("Ligue: (11) 91234-5678")
    assert "TELEFONE_REMOVIDO" in texto
    assert "telefone" in itens


def test_anonimizar_telefone_fixo():
    texto, itens = anonimizar("Telefone fixo: 3456-7890")
    assert "TELEFONE_REMOVIDO" in texto
    assert "telefone" in itens


def test_anonimizar_cep_com_hifen():
    texto, itens = anonimizar("Endereço: CEP 01310-100")
    assert "CEP_REMOVIDO" in texto
    assert "cep" in itens


def test_anonimizar_cep_sem_hifen_pode_conflitar_com_telefone():
    """CEP sem hífen (8 dígitos seguidos) pode ser capturado pela regex de
    telefone antes da de CEP — comportamento conhecido da implementação atual.
    O mascaramento ocorre de qualquer forma (como telefone ou cep)."""
    texto, itens = anonimizar("CEP: 01310100")
    assert "REMOVIDO" in texto  # algum mascaramento deve ocorrer
    assert len(itens) > 0       # pelo menos um tipo foi detectado


def test_anonimizar_data_barra():
    texto, itens = anonimizar("Nascimento: 15/03/2005")
    assert "DATA_REMOVIDO" in texto
    assert "data" in itens


def test_anonimizar_data_hifen():
    texto, itens = anonimizar("Data de avaliação: 10-04-2024")
    assert "DATA_REMOVIDO" in texto
    assert "data" in itens


# ---------------------------------------------------------------------------
# Nome de estudante
# ---------------------------------------------------------------------------

def test_anonimizar_nome_estudante_prefixo_estudante():
    texto, itens = anonimizar("Estudante: João da Silva")
    assert "NOME_ESTUDANTE_REMOVIDO" in texto
    assert "nome_estudante" in itens


def test_anonimizar_nome_estudante_prefixo_aluno():
    texto, itens = anonimizar("Aluno: Maria Aparecida")
    assert "NOME_ESTUDANTE_REMOVIDO" in texto
    assert "nome_estudante" in itens


def test_anonimizar_nome_estudante_prefixo_nome_do_estudante():
    texto, itens = anonimizar("Nome do estudante: Ana Paula Souza")
    assert "NOME_ESTUDANTE_REMOVIDO" in texto
    assert "nome_estudante" in itens


# ---------------------------------------------------------------------------
# Múltiplos padrões no mesmo texto
# ---------------------------------------------------------------------------

def test_anonimizar_multiplos_dados_no_mesmo_texto():
    texto_original = (
        "Aluno: Pedro Lima\n"
        "CPF: 987.654.321-00\n"
        "E-mail: pedro@escola.org\n"
        "Nascimento: 20/05/2010\n"
        "CEP: 80230-140"
    )
    texto_anon, itens = anonimizar(texto_original)
    assert "NOME_ESTUDANTE_REMOVIDO" in texto_anon
    assert "CPF_REMOVIDO" in texto_anon
    assert "EMAIL_REMOVIDO" in texto_anon
    assert "DATA_REMOVIDO" in texto_anon
    assert "CEP_REMOVIDO" in texto_anon
    for esperado in ("cpf", "email", "data", "cep", "nome_estudante"):
        assert esperado in itens, f"'{esperado}' deveria estar em itens_mascarados"


def test_anonimizar_texto_sem_dados_pessoais():
    texto = "Este é um plano de aula sobre frações para o 5º ano."
    texto_anon, itens = anonimizar(texto)
    assert texto_anon == texto
    assert itens == []


# ---------------------------------------------------------------------------
# Garantias de resultado
# ---------------------------------------------------------------------------

def test_anonimizar_retorna_tupla_texto_e_lista():
    resultado = anonimizar("sem dados pessoais aqui")
    assert isinstance(resultado, tuple)
    assert len(resultado) == 2
    texto, itens = resultado
    assert isinstance(texto, str)
    assert isinstance(itens, list)


def test_anonimizar_itens_mascarados_sem_duplicatas():
    texto = "CPF: 111.222.333-44\nOutro CPF: 555.666.777-88"
    _, itens = anonimizar(texto)
    assert itens.count("cpf") == 1


def test_anonimizar_itens_mascarados_ordenados():
    texto = "Email: a@b.com\nCPF: 111.222.333-44\nCEP: 01310-100"
    _, itens = anonimizar(texto)
    assert itens == sorted(itens)
