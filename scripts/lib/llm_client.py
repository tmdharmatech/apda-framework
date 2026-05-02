"""Cliente HTTP unificado para chamadas ao LLM via OpenAI-compatible API.

Consolida post_json(), extract_json() e _repair_truncated_json() que
estavam duplicados em 02_scan_segments.py, 03_scan_xlsx.py,
05_gerar_artefato_3b.py e 07_gerar_de_manifesto.py.
"""

from __future__ import annotations

import json
import re
import urllib.request


def post_json(
    url: str,
    payload: dict,
    timeout: int = 300,
    api_key: str | None = None,
) -> dict:
    """Envia payload JSON via POST e retorna a resposta decodificada."""
    headers: dict[str, str] = {"Content-Type": "application/json"}
    if api_key:
        headers["Authorization"] = f"Bearer {api_key}"
    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(url, data=data, headers=headers, method="POST")
    with urllib.request.urlopen(req, timeout=timeout) as response:
        return json.loads(response.read().decode("utf-8"))


def _repair_truncated_json(text: str) -> str:
    """Tenta recuperar um JSON truncado pelo modelo.

    Estratégia: remove linhas do final até encontrar um ponto onde
    o JSON pode ser fechado de forma válida.
    """
    lines = text.rstrip().splitlines()

    for attempt in range(min(30, len(lines))):
        chunk = lines[: len(lines) - attempt]
        if not chunk:
            break
        last = chunk[-1].rstrip()
        if last.endswith(","):
            chunk[-1] = last[:-1]
        working = "\n".join(chunk)
        depth_curly = working.count("{") - working.count("}")
        depth_square = working.count("[") - working.count("]")
        if depth_curly < 0 or depth_square < 0:
            continue
        closing = "]" * depth_square + "}" * depth_curly
        candidate = working + closing
        try:
            json.loads(candidate)
            return candidate
        except json.JSONDecodeError:
            continue

    raise ValueError("Não foi possível reparar o JSON truncado.")


def extract_json(text: str) -> str:
    """Extrai o primeiro objeto JSON de uma resposta do LLM.

    Remove cercas de markdown, localiza o objeto e, se necessário,
    tenta reparar JSON truncado via _repair_truncated_json().
    """
    clean = text.strip()
    if clean.startswith("```"):
        clean = re.sub(r"^```(?:json)?", "", clean).strip()
        clean = re.sub(r"```$", "", clean).strip()
    start = clean.find("{")
    if start == -1:
        raise ValueError("A resposta não contém um objeto JSON.")
    candidate = clean[start:]
    end = candidate.rfind("}")
    if end != -1:
        try:
            json.loads(candidate[: end + 1])
            return candidate[: end + 1]
        except json.JSONDecodeError:
            pass
    return _repair_truncated_json(candidate)
