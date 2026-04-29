import React from "react";
import { render } from "ink";
import { DoctorView } from "./ui/DoctorView.js";
import { existsSync } from "node:fs";
import net from "node:net";
import { URL } from "node:url";
import { detectGpus } from "./detectors/gpu.js";
import { findInputFiles } from "./detectors/input-files.js";
import { findLlamaServerBinary } from "./detectors/llama-binary.js";
import { checkLlamaServer } from "./detectors/llama-server.js";
import { findModels } from "./detectors/models.js";
import { detectPython } from "./detectors/python-env.js";
import { readConfig } from "./lib/config.js";
import {
  buildLlamaServerArgs,
  formatLlamaServerCommand,
} from "./runners/llama-server-process.js";

export function parseEndpoint(baseUrl) {
  try {
    const url = new URL(baseUrl);
    return {
      host: url.hostname,
      port: Number(url.port || (url.protocol === "https:" ? 443 : 80)),
    };
  } catch {
    return { host: "127.0.0.1", port: 8091 };
  }
}

function checkTcp(host, port, timeout = 1000) {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host, port });
    const done = (status) => {
      socket.destroy();
      resolve(status);
    };
    socket.setTimeout(timeout);
    socket.once("connect", () => done({ listening: true }));
    socket.once("timeout", () => done({ listening: false, reason: "timeout" }));
    socket.once("error", (error) =>
      done({ listening: false, reason: error.code ?? error.message }),
    );
  });
}

export async function inspectEndpoint(baseUrl) {
  const endpoint = parseEndpoint(baseUrl);
  const [http, tcp] = await Promise.all([
    checkLlamaServer(baseUrl),
    checkTcp(endpoint.host, endpoint.port),
  ]);

  let status = "free";
  if (http.ok) status = "openai-compatible";
  else if (tcp.listening) status = "occupied";

  return { ...endpoint, baseUrl, status, http, tcp };
}

export function pickDefaultModel(config, models) {
  if (config.modelPath) {
    const configured = models.find((model) => model.path === config.modelPath);
    if (configured) return { ...configured, source: "config" };
    return {
      name: config.modelPath.split("/").pop(),
      path: config.modelPath,
      sizeLabel: existsSync(config.modelPath)
        ? "tamanho nao calculado"
        : "nao encontrado",
      source: "config-missing",
    };
  }
  if (models.length) return { ...models[0], source: "detected" };
  return null;
}

function buildActions(report) {
  const actions = [];
  if (!report.python.ok)
    actions.push("Instale Python ou crie um .venv no projeto.");
  if (report.python.ok && !report.python.modulesOk)
    actions.push(
      "Instale dependencias com: .venv/bin/pip install -r requirements.txt",
    );
  if (!report.llamaBinary.ok)
    actions.push(
      "Compile ou instale llama.cpp para disponibilizar o binario llama-server.",
    );
  if (!report.defaultModel)
    actions.push("Coloque um modelo .gguf em modelos/ ou models/.");
  if (report.endpoint.status === "occupied")
    actions.push(
      `A porta ${report.endpoint.port} esta ocupada, mas nao respondeu como API compativel; escolha outra URL ou encerre o processo.`,
    );
  if (report.endpoint.status === "free" && report.llamaCommand)
    actions.push(
      "O servidor nao esta ativo; o onboarding pode subi-lo automaticamente ou use o comando sugerido.",
    );
  if (!report.inputs.length)
    actions.push("Adicione arquivos suportados em entrada/.");
  return actions;
}

export async function buildDoctorReport(root) {
  const config = await readConfig(root);
  const baseUrl =
    process.env.APDA_LLAMA_BASE_URL ??
    config.llamaBaseUrl ??
    "http://127.0.0.1:8091";

  const [python, gpus, models, inputs, llamaBinary, endpoint] =
    await Promise.all([
      detectPython(root),
      detectGpus(),
      findModels(root),
      findInputFiles(root),
      findLlamaServerBinary(config),
      inspectEndpoint(baseUrl),
    ]);

  const defaultModel = pickDefaultModel(config, models);
  const ngl = config.ngl ?? 99;
  const llamaCommand =
    llamaBinary.ok && defaultModel?.path && existsSync(defaultModel.path)
      ? formatLlamaServerCommand(
          llamaBinary.path,
          buildLlamaServerArgs({ modelPath: defaultModel.path, baseUrl, ngl }),
        )
      : null;

  const report = {
    projectRoot: root,
    config: {
      exists: Object.keys(config).length > 0,
      path: `${root}/.apda/config.json`,
      values: config,
    },
    python,
    gpus,
    models,
    inputs,
    defaultModel,
    llamaBinary,
    endpoint,
    llamaCommand,
    actions: [],
  };
  report.actions = buildActions(report);
  return report;
}

export async function runDoctor(root, options = {}) {
  const report = await buildDoctorReport(root);
  if (options.json) {
    console.log(JSON.stringify(report, null, 2));
    return report;
  }
  const { waitUntilExit } = render(React.createElement(DoctorView, { report }));
  await waitUntilExit();
  return report;
}
