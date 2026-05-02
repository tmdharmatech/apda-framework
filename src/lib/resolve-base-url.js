/**
 * Resolução centralizada de baseUrl para o llama-server / LiteLLM.
 *
 * Cadeia de precedência:
 *   1. Argumento explícito passado pelo chamador (options.baseUrl / values["base-url"])
 *   2. Variável de ambiente APDA_LLAMA_BASE_URL
 *   3. Valor salvo em .apda/config.json (config.llamaBaseUrl)
 *   4. Default: http://127.0.0.1:8091
 */

const DEFAULT_LLAMA_URL = "http://127.0.0.1:8091";
const DEFAULT_LITELLM_URL = "http://127.0.0.1:4000";

/**
 * Resolve a URL base do llama-server a partir da cadeia de fallback padrão.
 *
 * @param {string|undefined} arg - Valor vindo de CLI (options.baseUrl ou values["base-url"])
 * @param {object} config - Objeto de configuração lido de .apda/config.json
 * @returns {string}
 */
export function resolveBaseUrl(arg, config = {}) {
  return (
    arg ??
    process.env.APDA_LLAMA_BASE_URL ??
    config.llamaBaseUrl ??
    DEFAULT_LLAMA_URL
  );
}

/**
 * Dado um baseUrl já resolvido e flags de litellm, determina a URL final e
 * a API key a usar — centralizando a lógica que estava duplicada nos scripts.
 *
 * @param {{ baseUrl?: string, litellm?: boolean, apiKey?: string }} options
 * @param {object} config - Objeto de configuração lido de .apda/config.json
 * @returns {{ url: string, apiKey: string|null, useLitellm: boolean }}
 */
export function resolveLlmEndpoint(options = {}, config = {}) {
  const rawUrl = resolveBaseUrl(options.baseUrl, config);
  const useLitellm =
    options.litellm ||
    process.env.APDA_LITELLM === "1" ||
    rawUrl.includes(":4000");

  if (useLitellm) {
    const url =
      rawUrl === DEFAULT_LLAMA_URL
        ? (process.env.APDA_LITELLM_URL ?? DEFAULT_LITELLM_URL)
        : rawUrl;
    const apiKey =
      options.apiKey ??
      process.env.LITELLM_MASTER_KEY ??
      null;
    return { url, apiKey, useLitellm: true };
  }

  return { url: rawUrl, apiKey: options.apiKey ?? null, useLitellm: false };
}

export { DEFAULT_LLAMA_URL, DEFAULT_LITELLM_URL };
