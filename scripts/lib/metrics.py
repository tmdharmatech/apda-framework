"""Envio de métricas ao exportador APDA.

Centraliza _push_metrics() que estava apenas em 05_gerar_artefato_3b.py,
deixando todos os scripts aptos a instrumentar sem código duplicado.
"""

from __future__ import annotations

import json
import urllib.request

from lib.config import resolve_metrics_url


def push_metrics(payload: dict) -> None:
    """Envia métricas ao exportador APDA via HTTP POST (fire-and-forget)."""
    url = resolve_metrics_url()
    try:
        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            url,
            data=data,
            headers={"Content-Type": "application/json"},
            method="POST",
        )
        urllib.request.urlopen(req, timeout=2)
    except Exception:
        pass
