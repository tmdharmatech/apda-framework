import React from "react";
import { render } from "ink";
import { EventEmitter } from "node:events";
import { spawn } from "node:child_process";
import { existsSync, openSync } from "node:fs";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
import { findLlamaServerBinary } from "./detectors/llama-binary.js";
import { checkLlamaServer } from "./detectors/llama-server.js";
import { findModels } from "./detectors/models.js";
import { inspectEndpoint, pickDefaultModel } from "./doctor.js";
import { readConfig } from "./lib/config.js";
import { resolveBaseUrl } from "./lib/resolve-base-url.js";
import {
  buildLlamaServerArgs,
  formatLlamaServerCommand,
} from "./runners/llama-server-process.js";
import { ServerStartView } from "./ui/ServerStartView.js";

function serverStatePath(root) {
  return path.join(root, ".apda", "server.json");
}

function serverLogPath(root) {
  return path.join(root, ".apda", "llama-server.log");
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function readServerState(root) {
  const filePath = serverStatePath(root);
  if (!existsSync(filePath)) return null;
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch {
    return null;
  }
}

async function writeServerState(root, state) {
  await mkdir(path.join(root, ".apda"), { recursive: true });
  await writeFile(
    serverStatePath(root),
    `${JSON.stringify(state, null, 2)}\n`,
    "utf8",
  );
}

async function clearServerState(root) {
  await rm(serverStatePath(root), { force: true });
}

function isProcessAlive(pid) {
  if (!pid) return false;
  try {
    process.kill(Number(pid), 0);
    return true;
  } catch {
    return false;
  }
}

async function waitForServer(baseUrl, timeoutMs = 90000) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const status = await checkLlamaServer(baseUrl);
    if (status.ok) return true;
    await sleep(1000);
  }
  return false;
}

async function resolveServerPlan(root, values = {}) {
  const config = await readConfig(root);
  const models = await findModels(root);
  const modelPath = values.model ?? pickDefaultModel(config, models)?.path;
  const baseUrl = resolveBaseUrl(values["base-url"], config);
  const ngl = values.ngl ?? config.ngl ?? 99;
  const binary = await findLlamaServerBinary(config);

  if (!binary.ok) throw new Error("Binario llama-server nao encontrado.");
  if (!modelPath)
    throw new Error(
      "Modelo .gguf nao encontrado. Use --model ou configure pelo onboarding.",
    );
  if (!existsSync(modelPath))
    throw new Error(`Modelo .gguf nao encontrado: ${modelPath}`);

  const args = buildLlamaServerArgs({ modelPath, baseUrl, ngl });
  return {
    binary,
    modelPath,
    baseUrl,
    ngl,
    args,
    command: formatLlamaServerCommand(binary.path, args),
    logPath: serverLogPath(root),
    statePath: serverStatePath(root),
  };
}

async function serverStatus(root, options = {}) {
  const config = await readConfig(root);
  const baseUrl = resolveBaseUrl(options.baseUrl, config);
  const [state, endpoint] = await Promise.all([
    readServerState(root),
    inspectEndpoint(baseUrl),
  ]);
  const managed = state ? { ...state, alive: isProcessAlive(state.pid) } : null;
  const result = {
    baseUrl,
    endpoint,
    managed,
    statePath: serverStatePath(root),
    logPath: serverLogPath(root),
  };

  if (options.json) {
    console.log(JSON.stringify(result, null, 2));
    return result;
  }

  console.log("APDA server status\n");
  console.log(`Endpoint: ${baseUrl}`);
  console.log(`Porta ${endpoint.port}: ${endpoint.status}`);
  if (managed) {
    console.log(
      `Servidor gerenciado: pid=${managed.pid} alive=${managed.alive}`,
    );
    console.log(`Modelo: ${managed.modelPath}`);
    console.log(`Log: ${managed.logPath}`);
    if (!managed.alive)
      console.log("Estado local existe, mas o processo nao esta ativo.");
  } else {
    console.log("Servidor gerenciado: nenhum registro local.");
  }
  return result;
}

async function serverCommand(root, values = {}) {
  const plan = await resolveServerPlan(root, values);
  console.log(plan.command);
  return plan;
}

async function serverStart(root, values = {}) {
  const plan = await resolveServerPlan(root, values);
  const endpoint = await inspectEndpoint(plan.baseUrl);
  if (endpoint.status === "openai-compatible") {
    console.log(`llama-server ja esta ativo em ${plan.baseUrl}.`);
    return;
  }
  if (endpoint.status === "occupied") {
    throw new Error(
      `Porta ${endpoint.port} esta ocupada, mas nao respondeu como API compativel.`,
    );
  }

  await mkdir(path.join(root, ".apda"), { recursive: true });
  const out = openSync(plan.logPath, "a");
  const err = openSync(plan.logPath, "a");
  const child = spawn(plan.binary.path, plan.args, {
    cwd: root,
    detached: true,
    env: process.env,
    stdio: ["ignore", out, err],
  });
  child.unref();

  const state = {
    pid: child.pid,
    baseUrl: plan.baseUrl,
    modelPath: plan.modelPath,
    binary: plan.binary.path,
    args: plan.args,
    command: plan.command,
    logPath: plan.logPath,
    startedAt: new Date().toISOString(),
  };
  await writeServerState(root, state);
  const emitter = new EventEmitter();
  const { unmount } = render(
    React.createElement(ServerStartView, { baseUrl: plan.baseUrl, emitter }),
  );
  emitter.emit("server:spawned", child.pid);

  const ready = await waitForServer(plan.baseUrl);
  if (!ready) {
    emitter.emit(
      "server:error",
      `Não respondeu em ${plan.baseUrl}. Veja o log: ${plan.logPath}`,
    );
    unmount();
    throw new Error(
      `llama-server nao respondeu em ${plan.baseUrl}. Veja o log: ${plan.logPath}`,
    );
  }
  emitter.emit("server:ready");
  // Aguarda um frame para o componente renderizar o estado final antes de sair
  await new Promise((r) => setTimeout(r, 120));
  unmount();
}

async function serverStop(root) {
  const state = await readServerState(root);
  if (!state) {
    console.log("Nenhum servidor gerenciado registrado.");
    return;
  }
  if (!isProcessAlive(state.pid)) {
    console.log(`Processo registrado nao esta ativo: pid=${state.pid}`);
    await clearServerState(root);
    return;
  }

  process.kill(Number(state.pid), "SIGINT");
  for (let attempt = 0; attempt < 15; attempt += 1) {
    if (!isProcessAlive(state.pid)) {
      await clearServerState(root);
      console.log(`llama-server encerrado: pid=${state.pid}`);
      return;
    }
    await sleep(500);
  }

  process.kill(Number(state.pid), "SIGTERM");
  await sleep(1000);
  if (!isProcessAlive(state.pid)) {
    await clearServerState(root);
    console.log(`llama-server encerrado: pid=${state.pid}`);
    return;
  }
  throw new Error(`Nao foi possivel encerrar pid=${state.pid}.`);
}

export { serverStatus, serverStart, serverStop, serverCommand };

export async function runServerCommand(root, argv = []) {
  const subcommand = argv[0] ?? "status";
  const args = argv.slice(1);

  if (subcommand === "status") {
    const { values } = parseArgs({
      args,
      options: {
        json: { type: "boolean" },
        "base-url": { type: "string" },
      },
    });
    return serverStatus(root, {
      json: values.json,
      baseUrl: values["base-url"],
    });
  }

  if (subcommand === "command") {
    const { values } = parseArgs({
      args,
      options: {
        model: { type: "string" },
        "base-url": { type: "string" },
        ngl: { type: "string" },
      },
    });
    return serverCommand(root, values);
  }

  if (subcommand === "start") {
    const { values } = parseArgs({
      args,
      options: {
        model: { type: "string" },
        "base-url": { type: "string" },
        ngl: { type: "string" },
      },
    });
    return serverStart(root, values);
  }

  if (subcommand === "stop") return serverStop(root);

  throw new Error(`Uso: apda server <status|start|stop|command>`);
}
