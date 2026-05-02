from __future__ import annotations

import json
from pathlib import Path


from lib.paths import BASE

BENCHMARKS = BASE / "benchmarks" / "benchmarks.json"


def fmt(value, suffix=""):
    if value is None:
        return "n/a"
    if isinstance(value, float):
        return f"{value:.2f}{suffix}"
    return f"{value}{suffix}"


def main():
    data = json.loads(BENCHMARKS.read_text(encoding="utf-8"))
    tests = data.get("tests", [])

    required = {
        "id",
        "category",
        "model_key",
        "model_label",
        "metrics",
    }
    quality_required = {
        "schema_adherence",
        "required_fields_missing",
        "invented_fields",
        "student_separation",
        "privacy_risk",
        "human_validation_consistency",
        "language_issues",
        "retry_needed",
    }

    errors = []
    for test in tests:
        missing = sorted(required - set(test))
        if missing:
            errors.append(f"{test.get('id', '<sem id>')}: campos ausentes: {', '.join(missing)}")
        if test.get("category", "").startswith("json_generation"):
            quality_missing = sorted(quality_required - set(test))
            if quality_missing:
                errors.append(
                    f"{test.get('id', '<sem id>')}: campos de qualidade ausentes: {', '.join(quality_missing)}"
                )
        metrics = test.get("metrics", {})
        for key in [
            "prompt_tokens_per_second",
            "generation_tokens_per_second",
            "elapsed_seconds",
            "vram_total_mib",
        ]:
            if key not in metrics:
                errors.append(f"{test.get('id', '<sem id>')}: metrica ausente: {key}")

    if errors:
        print("Benchmark JSON invalido:")
        for error in errors:
            print(f"- {error}")
        raise SystemExit(1)

    print(f"Arquivo: {BENCHMARKS}")
    print(f"Testes registrados: {len(tests)}")
    print()
    print("Resumo:")
    for test in tests:
        metrics = test["metrics"]
        print(
            "- {id}: {model}, ctx={ctx}, estudantes={students}, "
            "json={json_valid}, separacao={sep}, privacidade={privacy}, "
            "vram={vram}, tempo={elapsed}, gen={gen}".format(
                id=test["id"],
                model=test["model_label"],
                ctx=fmt(test.get("ctx_size")),
                students=test.get("students", "n/a"),
                json_valid=test.get("json_valid"),
                sep=test.get("student_separation", "n/a"),
                privacy=test.get("privacy_risk", "n/a"),
                vram=fmt(metrics.get("vram_total_mib"), " MiB"),
                elapsed=fmt(metrics.get("elapsed_seconds"), " s"),
                gen=fmt(metrics.get("generation_tokens_per_second"), " tok/s"),
            )
        )


if __name__ == "__main__":
    main()
