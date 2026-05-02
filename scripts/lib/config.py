"""Configuração centralizada do APDA Framework.

Fornece funções únicas para resolução de URLs e credenciais,
eliminando duplicação nos scripts individuais.

Cadeia de precedência para base URL:
  1. Argumento CLI explícito (--base-url)
  2. Variável de ambiente APDA_LLAMA_BASE_URL
  3. Default: http://127.0.0.1:8091

Cadeia de precedência para API key:
  1. Argumento CLI explícito (--api-key)
  2. Variável de ambiente LITELLM_MASTER_KEY
  3. None (sem autenticação)
"""

from __future__ import annotations

import os

DEFAULT_LLAMA_URL = "http://127.0.0.1:8091"
DEFAULT_LITELLM_URL = "http://127.0.0.1:4000"
DEFAULT_METRICS_URL = "http://127.0.0.1:8000/push"


def resolve_base_url(arg_url: str | None = None) -> str:
    """Resolve a URL base do llama-server com fallback chain completo."""
    return arg_url or os.environ.get("APDA_LLAMA_BASE_URL") or DEFAULT_LLAMA_URL


def resolve_api_key(arg_key: str | None = None) -> str | None:
    """Resolve a API key do LiteLLM proxy."""
    return arg_key or os.environ.get("LITELLM_MASTER_KEY") or None


def resolve_litellm(
    arg_url: str | None,
    arg_key: str | None,
    use_litellm_flag: bool = False,
) -> tuple[str, str | None]:
    """Determina (base_url, api_key) considerando o modo LiteLLM.

    Substitui _detect_base_url() que estava duplicado nos scripts geradores.
    Retorna (url, api_key).
    """
    raw_url = resolve_base_url(arg_url)
    use_litellm = (
        use_litellm_flag
        or os.environ.get("APDA_LITELLM") == "1"
        or ":4000" in raw_url
    )

    if use_litellm:
        litellm_url = (
            raw_url
            if raw_url != DEFAULT_LLAMA_URL
            else (os.environ.get("APDA_LITELLM_URL") or DEFAULT_LITELLM_URL)
        )
        api_key = resolve_api_key(arg_key)
        return litellm_url, api_key

    return raw_url, arg_key


def resolve_metrics_url() -> str:
    """Resolve a URL do exportador de métricas APDA."""
    return os.environ.get("APDA_METRICS_URL") or DEFAULT_METRICS_URL
