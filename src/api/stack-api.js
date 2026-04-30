import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { readConfig } from "../lib/config.js";

const SERVICES = ["litellm", "metrics-exporter", "llama-3b", "llama-1b"];

function isProcessAlive(pid) {
  try {
    process.kill(Number(pid), 0);
    return true;
  } catch {
    return false;
  }
}

async function readPid(root, name) {
  const pidFile = path.join(root, ".apda", "pids", `${name}.pid`);
  if (!existsSync(pidFile)) return null;
  try {
    const raw = await readFile(pidFile, "utf8");
    const pid = Number(raw.trim());
    return Number.isFinite(pid) ? pid : null;
  } catch {
    return null;
  }
}

export async function handleStackStatus(root, req, res) {
  const config = await readConfig(root);
  const litellmPort = config.litellmPort ?? 4000;
  const prometheusPort = config.prometheusPort ?? 9090;
  const grafanaPort = config.grafanaPort ?? 3001;

  const services = {};
  for (const name of SERVICES) {
    const pid = await readPid(root, name);
    services[name] = { pid, alive: pid !== null && isProcessAlive(pid) };
  }

  const endpoints = {
    litellm: { port: litellmPort, url: `http://localhost:${litellmPort}/v1` },
    prometheus: { port: prometheusPort, url: `http://localhost:${prometheusPort}` },
    grafana: { port: grafanaPort, url: `http://localhost:${grafanaPort}` },
    metrics: { port: 8000, url: "http://localhost:8000/metrics" },
  };

  for (const [, ep] of Object.entries(endpoints)) {
    try {
      const r = await fetch(ep.url, { signal: AbortSignal.timeout(1500) });
      ep.reachable = r.ok || r.status < 500;
    } catch {
      ep.reachable = false;
    }
  }

  res.json({ services, endpoints });
}
