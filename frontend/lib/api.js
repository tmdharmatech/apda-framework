async function parseResponse(response) {
  const contentType = response.headers.get("content-type") ?? "";
  const body = contentType.includes("application/json")
    ? await response.json()
    : await response.text();

  if (!response.ok) {
    const message = typeof body === "object" && body?.error
      ? body.error
      : `HTTP ${response.status}`;
    const error = new Error(message);
    error.status = response.status;
    error.body = body;
    throw error;
  }

  return body;
}

export async function fetchJSON(url, options = {}) {
  const response = await fetch(url, {
    cache: "no-store",
    ...options,
    headers: {
      ...(options.body ? { "Content-Type": "application/json" } : {}),
      ...(options.headers ?? {}),
    },
  });
  return parseResponse(response);
}

export function getJSON(url, options = {}) {
  return fetchJSON(url, { method: "GET", ...options });
}

export function postJSON(url, payload, options = {}) {
  return fetchJSON(url, {
    method: "POST",
    ...options,
    body: JSON.stringify(payload ?? {}),
  });
}
