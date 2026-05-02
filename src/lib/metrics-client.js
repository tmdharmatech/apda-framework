const DEFAULT_METRICS_URL = "http://127.0.0.1:8000/push";
const DEFAULT_TIMEOUT_MS = 750;

export function resolveMetricsUrl(value) {
  return value || process.env.APDA_METRICS_URL || DEFAULT_METRICS_URL;
}

export async function pushMetrics(payload, options = {}) {
  if (options.enabled === false) return { ok: false, skipped: true };

  const url = resolveMetricsUrl(options.metricsUrl);
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(timeoutMs),
    });
    return { ok: response.ok, status: response.status };
  } catch {
    return { ok: false };
  }
}
