"""Configura o sys.path para que 'lib' seja importável a partir de scripts/."""

import sys
from pathlib import Path

# Adiciona scripts/ ao caminho de busca de módulos Python
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
