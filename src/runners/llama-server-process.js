import { spawn } from "node:child_process";
import { URL } from "node:url";
import { checkLlamaServer } from "../detectors/llama-server.js";

function parsePort(baseUrl) {
  try {
    const url = new URL(baseUrl);
    if (url.port) return url.port;
    return url.protocol === "https:" ? "443" : "80";
  } catch {
    return "8091";
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function buildLlamaServerArgs({ modelPath, baseUrl, ngl = 99 }) {
  return ["-m", modelPath, "--port", parsePort(baseUrl), "-ngl", String(ngl)];
}

export function formatLlamaServerCommand(binary, args) {
  return [binary, ...args.map((arg) => (/\s|[()]/.test(arg) ? `"${arg}"` : arg))].join(" ");
}

export async function startLlamaServer({ binary, modelPath, baseUrl, ngl = 99, cwd }) {
  const args = buildLlamaServerArgs({ modelPath, baseUrl, ngl });
  const child = spawn(binary, args, {
    cwd,
    env: process.env,
    stdio: ["ignore", "pipe", "pipe"],
  });

  const logs = [];
  const pushLog = (chunk) => {
    const text = String(chunk);
    logs.push(text);
    if (logs.length > 80) logs.shift();
  };
  child.stdout.on("data", pushLog);
  child.stderr.on("data", pushLog);

  let exitCode = null;
  child.on("close", (code) => {
    exitCode = code;
  });

  for (let attempt = 0; attempt < 90; attempt += 1) {
    if (exitCode !== null) {
      throw new Error(`llama-server encerrou antes de ficar pronto (code=${exitCode}).\n${logs.join("").slice(-3000)}`);
    }
    const status = await checkLlamaServer(baseUrl);
    if (status.ok) {
      return {
        child,
        command: formatLlamaServerCommand(binary, args),
        stop: async () => stopLlamaServer(child),
      };
    }
    await sleep(1000);
  }

  await stopLlamaServer(child);
  throw new Error(`llama-server nao respondeu em ${baseUrl} dentro do tempo limite.\n${logs.join("").slice(-3000)}`);
}

export async function stopLlamaServer(child) {
  if (!child || child.killed || child.exitCode !== null) return;
  child.kill("SIGINT");
  for (let attempt = 0; attempt < 10; attempt += 1) {
    if (child.exitCode !== null) return;
    await sleep(300);
  }
  if (child.exitCode === null) child.kill("SIGTERM");
}
