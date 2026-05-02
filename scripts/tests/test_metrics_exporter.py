"""Testes para o endpoint push do metrics_exporter."""

import json
from io import BytesIO

import pytest

pytest.importorskip("prometheus_client")

from metrics_exporter import _handle_push


def _push(payload):
    body = json.dumps(payload).encode("utf-8")
    return _handle_push(
        {
            "CONTENT_LENGTH": str(len(body)),
            "wsgi.input": BytesIO(body),
        }
    )


def test_handle_push_accepts_step_metric():
    output, status = _push(
        {
            "action": "step",
            "workflow": "validate-apda-json",
            "step": "validate-schema",
            "status": "ok",
            "formato": "json",
            "elapsed": 0.12,
            "input_bytes": 128,
            "output_bytes": 0,
        }
    )

    assert status == "200 OK"
    assert json.loads(output)["ok"] is True


def test_handle_push_accepts_pipeline_metric():
    output, status = _push(
        {
            "action": "pipeline",
            "workflow": "txt-fast-single",
            "status": "ok",
            "formato": "txt",
            "modelo": "apda-local-3b",
            "elapsed": 1.5,
            "steps_executed": 2,
        }
    )

    assert status == "200 OK"
    assert json.loads(output)["ok"] is True
