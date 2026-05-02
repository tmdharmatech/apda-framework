from pathlib import Path
import re
import json
from datetime import datetime

from lib.paths import SAIDA, LOGS


PADROES = {
    "email": r"\b[\w\.-]+@[\w\.-]+\.\w+\b",
    "telefone": r"\b(?:\(?\d{2}\)?\s?)?(?:9\s?)?\d{4}[-\s]?\d{4}\b",
    "cpf": r"\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b",
    "data": r"\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b",
    "cep": r"\b\d{5}-?\d{3}\b"
}


def anonimizar(texto: str):
    itens_mascarados = []

    texto_anon = texto

    for tipo, padrao in PADROES.items():
        matches = re.findall(padrao, texto_anon)
        if matches:
            itens_mascarados.append(tipo)
            texto_anon = re.sub(padrao, f"[{tipo.upper()}_REMOVIDO]", texto_anon)

    # Regra simples para nomes em campos comuns.
    texto_anon = re.sub(
        r"(?i)(nome do estudante|aluno|estudante)\s*[:\-]\s*[A-ZÁÉÍÓÚÂÊÔÃÕÇ][^\n,;]+",
        r"\1: [NOME_ESTUDANTE_REMOVIDO]",
        texto_anon
    )

    if "[NOME_ESTUDANTE_REMOVIDO]" in texto_anon:
        itens_mascarados.append("nome_estudante")

    return texto_anon, sorted(set(itens_mascarados))


def main():
    import argparse

    parser = argparse.ArgumentParser(description="Anonimizacao por regras (regex)")
    parser.add_argument("--input", help="Arquivo de texto a anonimizar")
    parser.add_argument("--output", help="Arquivo de saida anonimizado")
    args = parser.parse_args()

    if args.input and args.output:
        input_path = Path(args.input).resolve()
        output_path = Path(args.output).resolve()
        texto = input_path.read_text(encoding="utf-8")
        texto_anon, itens = anonimizar(texto)
        output_path.parent.mkdir(exist_ok=True)
        output_path.write_text(texto_anon, encoding="utf-8")
        print(f"[OK] {input_path.name} -> {output_path.name} | mascarados: {itens}")
        return

    arquivos = list(SAIDA.glob("*.texto_extraido.txt"))
    resultados = []

    for arquivo in arquivos:
        texto = arquivo.read_text(encoding="utf-8")
        texto_anon, itens = anonimizar(texto)

        saida_anon = SAIDA / arquivo.name.replace(".texto_extraido.txt", ".texto_anonimizado.txt")
        saida_anon.write_text(texto_anon, encoding="utf-8")

        resultados.append({
            "arquivo": arquivo.name,
            "saida": saida_anon.name,
            "itens_mascarados": itens
        })

        print(f"[OK] {arquivo.name} -> {saida_anon.name} | mascarados: {itens}")

    log_path = LOGS / "anonimizacao_regras.json"
    log_path.write_text(
        json.dumps({
            "data": datetime.now().isoformat(),
            "resultados": resultados
        }, ensure_ascii=False, indent=2),
        encoding="utf-8"
    )


if __name__ == "__main__":
    main()
