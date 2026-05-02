import { spawn } from "node:child_process";
import { existsSync, openSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { checkLlamaServer } from "./detectors/llama-server.js";
import { readConfig } from "./lib/config.js";
import { runCommand, commandExists } from "./lib/command.js";

const SERVICES = ["litellm", "metrics-exporter", "llama-3b", "llama-1b"];

function pidDir(root) {
  return path.join(root, ".apda", "pids");
}
function logDir(root) {
  return path.join(root, ".apda", "logs");
}
function infraDir(root) {
  return path.join(root, "infra");
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function isProcessAlive(pid) {
  try {
    process.kill(Number(pid), 0);
    return true;
  } catch {
    return false;
  }
}

async function readPid(root, name) {
  const pidFile = path.join(pidDir(root), `${name}.pid`);
  if (!existsSync(pidFile)) return null;
  try {
    const raw = await readFile(pidFile, "utf8");
    const pid = Number(raw.trim());
    return Number.isFinite(pid) ? pid : null;
  } catch {
    return null;
  }
}

async function writePid(root, name, pid) {
  const dir = pidDir(root);
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, `${name}.pid`), String(pid), "utf8");
}

async function clearPid(root, name) {
  await rm(path.join(pidDir(root), `${name}.pid`), { force: true });
}

async function isServiceRunning(root, name) {
  const pid = await readPid(root, name);
  return pid !== null && isProcessAlive(pid);
}

async function waitForPort(port, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/`, {
        signal: AbortSignal.timeout(1000),
      });
      if (res.ok || res.status < 500) return true;
    } catch {}
    await sleep(1000);
  }
  return false;
}

async function stackStatus(root, options = {}) {
  const config = await readConfig(root);
  const litellmPort = config.litellmPort ?? 4000;
  const prometheusPort = config.prometheusPort ?? 9090;
  const grafanaPort = config.grafanaPort ?? 3001;
  const metricsPort = 8000;

  const services = {};
  for (const name of SERVICES) {
    const pid = await readPid(root, name);
    services[name] = {
      pid,
      alive: pid !== null && isProcessAlive(pid),
    };
  }

  const endpoints = {
    litellm: { port: litellmPort, url: `http://localhost:${litellmPort}/v1` },
    prometheus: { port: prometheusPort, url: `http://localhost:${prometheusPort}` },
    grafana: { port: grafanaPort, url: `http://localhost:${grafanaPort}` },
    metrics: { port: metricsPort, url: `http://localhost:${metricsPort}/metrics` },
  };

  for (const [key, ep] of Object.entries(endpoints)) {
    try {
      const res = await fetch(ep.url, { signal: AbortSignal.timeout(1500) });
      ep.reachable = res.ok || res.status < 500;
    } catch {
      ep.reachable = false;
    }
  }

  const result = { services, endpoints };

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
    return result;
  }

  console.log("APDA Stack — Status\n");
  for (const [name, svc] of Object.entries(services)) {
    const icon = svc.alive ? "\x1b[32m●\x1b[0m" : "\x1b[31m○\x1b[0m";
    const pidLabel = svc.pid ? ` pid=${svc.pid}` : "";
    console.log(`  ${icon} ${name}${pidLabel}`);
  }
  console.log("");
  for (const [name, ep] of Object.entries(endpoints)) {
    const icon = ep.reachable ? "\x1b[32m●\x1b[0m" : "\x1b[31m○\x1b[0m";
    console.log(`  ${icon} ${name}  ${ep.url}`);
  }
  return result;
}

async function stackStart(root) {
  const startScript = path.join(infraDir(root), "start.sh");
  if (!existsSync(startScript)) {
    throw new Error(`Script de inicializacao nao encontrado: ${startScript}`);
  }

  console.log("Iniciando APDA Stack...\n");
  const child = spawn("bash", [startScript], {
    cwd: root,
    stdio: "inherit",
    env: process.env,
  });

  return new Promise((resolve, reject) => {
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`start.sh encerrou com codigo ${code}`));
    });
    child.on("error", reject);
  });
}

async function stackStop(root) {
  const stopScript = path.join(infraDir(root), "stop.sh");
  if (!existsSync(stopScript)) {
    throw new Error(`Script de encerramento nao encontrado: ${stopScript}`);
  }

  const child = spawn("bash", [stopScript], {
    cwd: root,
    stdio: "inherit",
    env: process.env,
  });

  return new Promise((resolve, reject) => {
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`stop.sh encerrou com codigo ${code}`));
    });
    child.on("error", reject);
  });
}

async function stackLogs(root, service) {
  const dir = logDir(root);
  const logFile = service
    ? path.join(dir, `${service}.log`)
    : path.join(dir, "litellm.log");

  if (!existsSync(logFile)) {
    console.log(`Log nao encontrado: ${logFile}`);
    return;
  }

  const content = await readFile(logFile, "utf8");
  const lines = content.split("\n");
  const tail = lines.slice(-50).join("\n");
  console.log(tail);
}

export async function runStackCommand(root, argv = []) {
  const subcommand = argv[0] ?? "status";
  const args = argv.slice(1);

  if (subcommand === "status") {
    const { values } = parseArgs({
      args,
      options: { json: { type: "boolean" } },
    });
    return stackStatus(root, { json: values.json });
  }

  if (subcommand === "start") return stackStart(root);
  if (subcommand === "stop") return stackStop(root);

  if (subcommand === "logs") {
    const service = args[0] ?? null;
    return stackLogs(root, service);
  }

  throw new Error(
    "Uso: apda stack <status|start|stop|logs [servico]>",
  );
}
