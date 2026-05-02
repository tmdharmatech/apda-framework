from __future__ import annotations

import argparse
import importlib.util
import json
import re
import time
from collections import Counter
from datetime import datetime
from pathlib import Path
from typing import Iterable

from lib.paths import BASE, SAIDA, LOGS

DEFAULT_MODEL_DIR = BASE / "modelos" / "openai-privacy-filter"

REGEX_FALLBACKS = {
    "private_email": r"\b[\w\.-]+@[\w\.-]+\.\w+\b",
    "private_phone": r"\b(?:\(?\d{2}\)?\s?)?(?:9\s?)?\d{4}[-\s]?\d{4}\b",
    "account_number": r"\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b",
    "private_date": r"\b\d{1,2}[/-]\d{1,2}[/-]\d{2,4}\b",
    "private_address": r"\b\d{5}-?\d{3}\b",
}

PLACEHOLDERS = {
    "private_person": "[PRIVATE_PERSON]",
    "private_address": "[PRIVATE_ADDRESS]",
    "private_email": "[PRIVATE_EMAIL]",
    "private_phone": "[PRIVATE_PHONE]",
    "private_url": "[PRIVATE_URL]",
    "private_date": "[PRIVATE_DATE]",
    "account_number": "[ACCOUNT_NUMBER]",
    "secret": "[SECRET]",
}


def load_token_classifier(model_dir: Path):
    if importlib.util.find_spec("torch") is None:
        raise SystemExit(
            "Dependencia Python ausente: torch. "
            "O Privacy Filter usa transformers.pipeline com backend PyTorch. "
            "Instale com: .venv/bin/pip install -r requirements.txt"
        )

    from transformers import pipeline

    return pipeline("token-classification", model=str(model_dir), device=-1)


def iter_chunks(text: str, chunk_chars: int) -> Iterable[tuple[int, str]]:
    if chunk_chars <= 0 or len(text) <= chunk_chars:
        yield 0, text
        return

    start = 0
    while start < len(text):
        end = min(len(text), start + chunk_chars)
        if end < len(text):
            boundary = text.rfind("\n", start, end)
            if boundary > start + chunk_chars // 2:
                end = boundary + 1
        yield start, text[start:end]
        start = end


def normalize_spans(raw_spans: list[dict], offset: int, threshold: float) -> list[dict]:
    spans = []
    for item in raw_spans:
        score = float(item.get("score", 0.0))
        label = item.get("entity_group") or item.get("entity")
        start = item.get("start")
        end = item.get("end")

        if not label or start is None or end is None or score < threshold:
            continue

        label = label.replace("B-", "").replace("I-", "").replace("E-", "").replace("S-", "")
        if label not in PLACEHOLDERS:
            continue

        spans.append(
            {
                "start": offset + int(start),
                "end": offset + int(end),
                "label": label,
                "score": score,
            }
        )
    return spans


def merge_spans(spans: list[dict], text: str) -> list[dict]:
    if not spans:
        return []

    spans = sorted(spans, key=lambda s: (s["start"], s["end"]))
    merged = [spans[0].copy()]

    for span in spans[1:]:
        current = merged[-1]
        gap = text[current["end"] : span["start"]]
        adjacent_same_label = (
            span["label"] == current["label"]
            and span["start"] <= current["end"] + 3
            and re.fullmatch(r"[\s\.\-_/]*", gap or "")
        )

        if span["start"] <= current["end"] or adjacent_same_label:
            current["end"] = max(current["end"], span["end"])
            current["score"] = max(current["score"], span["score"])
            if span["label"] != current["label"]:
                current["label"] = "private_person"
            continue

        merged.append(span.copy())

    return merged


def apply_spans(text: str, spans: list[dict]) -> str:
    if not spans:
        return text

    output = []
    cursor = 0
    for span in spans:
        start = max(cursor, span["start"])
        end = max(start, span["end"])
        output.append(text[cursor:start])
        output.append(PLACEHOLDERS[span["label"]])
        cursor = end
    output.append(text[cursor:])
    return "".join(output)


def private_person_memory(spans: list[dict], text: str) -> list[str]:
    phrases = set()
    for span in spans:
        if span["label"] != "private_person":
            continue

        phrase = re.sub(r"\s+", " ", text[span["start"] : span["end"]]).strip(" :;,.")
        tokens = re.findall(r"[A-ZÁÉÍÓÚÂÊÔÃÕÇ][A-Za-zÁÉÍÓÚÂÊÔÃÕÇáéíóúâêôãõç]+", phrase)
        if len(tokens) < 2:
            continue

        phrases.add(" ".join(tokens))
        phrases.add(tokens[0])
        for size in range(2, len(tokens) + 1):
            phrases.add(" ".join(tokens[:size]))

    return sorted(phrases, key=len, reverse=True)


def propagate_private_persons(masked: str, phrases: list[str]) -> tuple[str, int]:
    output = masked
    replacements = 0
    for phrase in phrases:
        pattern = r"\b" + re.escape(phrase) + r"\b"
        output, count = re.subn(pattern, PLACEHOLDERS["private_person"], output)
        replacements += count
    return output, replacements


def apply_regex_fallbacks(text: str) -> tuple[str, list[str]]:
    labels = []
    output = text
    for label, pattern in REGEX_FALLBACKS.items():
        output, count = re.subn(pattern, PLACEHOLDERS[label], output)
        if count:
            labels.append(label)
    return output, labels


def anonymize_text(classifier, text: str, threshold: float, chunk_chars: int) -> tuple[str, dict]:
    started = time.perf_counter()
    spans = []

    for offset, chunk in iter_chunks(text, chunk_chars):
        raw = classifier(chunk, aggregation_strategy="simple")
        spans.extend(normalize_spans(raw, offset, threshold))

    spans = merge_spans(spans, text)
    person_phrases = private_person_memory(spans, text)
    masked = apply_spans(text, spans)
    masked, propagated_persons = propagate_private_persons(masked, person_phrases)
    masked, fallback_labels = apply_regex_fallbacks(masked)

    counts = Counter(span["label"] for span in spans)
    if propagated_persons:
        counts["private_person"] += propagated_persons
    for label in fallback_labels:
        counts[label] += 1

    return masked, {
        "elapsed_seconds": round(time.perf_counter() - started, 3),
        "input_chars": len(text),
        "output_chars": len(masked),
        "span_count": len(spans),
        "propagated_private_person_replacements": propagated_persons,
        "private_person_memory": person_phrases,
        "labels": dict(sorted(counts.items())),
        "threshold": threshold,
        "chunk_chars": chunk_chars,
    }


def resolve_inputs(args: argparse.Namespace) -> list[Path]:
    if args.input:
        return [Path(args.input).resolve()]
    return sorted(SAIDA.glob("*.texto_extraido.txt"))


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Anonimiza textos extraidos usando OpenAI Privacy Filter local."
    )
    parser.add_argument("--input", help="Arquivo .texto_extraido.txt especifico.")
    parser.add_argument("--output", help="Arquivo de saida. Usado apenas com --input.")
    parser.add_argument("--model-dir", default=str(DEFAULT_MODEL_DIR))
    parser.add_argument("--threshold", type=float, default=0.5)
    parser.add_argument("--chunk-chars", type=int, default=12000)
    args = parser.parse_args()

    model_dir = Path(args.model_dir).resolve()
    if not model_dir.exists():
        raise SystemExit(f"Modelo nao encontrado: {model_dir}")

    LOGS.mkdir(exist_ok=True)
    print(f"[INFO] carregando Privacy Filter: {model_dir}")
    classifier = load_token_classifier(model_dir)

    resultados = []
    for input_path in resolve_inputs(args):
        text = input_path.read_text(encoding="utf-8")
        masked, metrics = anonymize_text(classifier, text, args.threshold, args.chunk_chars)

        if args.output:
            output_path = Path(args.output).resolve()
        else:
            output_path = input_path.with_name(
                input_path.name.replace(".texto_extraido.txt", ".opf_anonimizado.txt")
            )

        output_path.write_text(masked, encoding="utf-8")
        metadata_path = output_path.with_suffix(output_path.suffix + ".metadata.json")
        metadata_path.write_text(
            json.dumps(
                {
                    "data": datetime.now().isoformat(),
                    "modelo": "openai/privacy-filter",
                    "modelo_local": str(model_dir),
                    "entrada": str(input_path),
                    "saida": str(output_path),
                    **metrics,
                },
                ensure_ascii=False,
                indent=2,
            ),
            encoding="utf-8",
        )

        resultados.append({"entrada": input_path.name, "saida": output_path.name, **metrics})
        print(
            f"[OK] {input_path.name} -> {output_path.name} | "
            f"spans={metrics['span_count']} labels={metrics['labels']} "
            f"tempo={metrics['elapsed_seconds']}s"
        )

    log_path = LOGS / "privacy_filter_anonimizacao.json"
    log_path.write_text(
        json.dumps(
            {
                "data": datetime.now().isoformat(),
                "modelo": "openai/privacy-filter",
                "resultados": resultados,
            },
            ensure_ascii=False,
            indent=2,
        ),
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
