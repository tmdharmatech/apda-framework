export async function checkLlamaServer(baseUrl = "http://127.0.0.1:8091") {
  try {
    const response = await fetch(`${baseUrl.replace(/\/$/, "")}/v1/models`, {
      signal: AbortSignal.timeout(1500),
    });
    return { ok: response.ok, baseUrl, status: response.status };
  } catch (error) {
    return { ok: false, baseUrl, error: error.message };
  }
}
