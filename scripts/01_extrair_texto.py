from pathlib import Path
import sys
import json
import argparse
import fitz  # PyMuPDF
import docx
import pandas as pd
from datetime import datetime

from lib.paths import ENTRADA, SAIDA, LOGS

SAIDA.mkdir(exist_ok=True)
LOGS.mkdir(exist_ok=True)


def extrair_docx(caminho: Path) -> str:
    documento = docx.Document(caminho)
    textos = [p.text for p in documento.paragraphs if p.text.strip()]
    return "\n".join(textos)


def extrair_xlsx(caminho: Path) -> str:
    abas = pd.read_excel(caminho, sheet_name=None)
    partes = []
    for nome_aba, df in abas.items():
        partes.append(f"\n--- ABA: {nome_aba} ---\n")
        partes.append(df.fillna("").to_string(index=False))
    return "\n".join(partes)


def extrair_pdf(caminho: Path) -> str:
    doc = fitz.open(caminho)
    textos = []
    for i, pagina in enumerate(doc, start=1):
        texto = pagina.get_text()
        textos.append(f"\n--- PÁGINA {i} ---\n{texto}")
    return "\n".join(textos)


def extrair_texto(caminho: Path) -> str:
    ext = caminho.suffix.lower()

    if ext == ".docx":
        return extrair_docx(caminho)
    if ext in [".xlsx", ".xls"]:
        return extrair_xlsx(caminho)
    if ext == ".pdf":
        return extrair_pdf(caminho)

    raise ValueError(f"Formato ainda não suportado: {ext}")


def resolver_arquivos(input_path: str | None) -> list[Path]:
    if input_path:
        return [Path(input_path).resolve()]
    return list(ENTRADA.glob("*"))


def main():
    parser = argparse.ArgumentParser(description="Extrai texto de documentos APDA.")
    parser.add_argument("--input", help="Arquivo especifico para extrair.")
    parser.add_argument("--output", help="Arquivo .txt de saida. Usado apenas com --input.")
    args = parser.parse_args()

    arquivos = resolver_arquivos(args.input)
    resultados = []

    for arquivo in arquivos:
        if arquivo.is_dir():
            continue

        try:
            texto = extrair_texto(arquivo)
            if args.output:
                saida_txt = Path(args.output).resolve()
            else:
                saida_txt = SAIDA / f"{arquivo.stem}.texto_extraido.txt"
            saida_txt.parent.mkdir(exist_ok=True, parents=True)
            saida_txt.write_text(texto, encoding="utf-8")

            resultados.append({
                "arquivo": arquivo.name,
                "status": "ok",
                "caracteres_extraidos": len(texto),
                "saida": str(saida_txt)
            })

            print(f"[OK] {arquivo.name} -> {saida_txt.name}")

        except Exception as e:
            resultados.append({
                "arquivo": arquivo.name,
                "status": "erro",
                "erro": str(e)
            })
            print(f"[ERRO] {arquivo.name}: {e}")

    log_path = LOGS / "extracao_texto.json"
    log_path.write_text(
        json.dumps({
            "data": datetime.now().isoformat(),
            "resultados": resultados
        }, ensure_ascii=False, indent=2),
        encoding="utf-8"
    )


if __name__ == "__main__":
    main()
