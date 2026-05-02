"""Constantes de caminhos compartilhadas por todos os scripts do pipeline APDA."""

from __future__ import annotations

from pathlib import Path

BASE = Path(__file__).resolve().parents[2]
ENTRADA = BASE / "entrada"
SAIDA = BASE / "saida"
LOGS = BASE / "logs"
