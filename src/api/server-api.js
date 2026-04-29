import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { readBody } from "../lib/http.js";
import { serverCommand, serverStart, serverStatus, serverStop } from "../server.js";

export async function handleServerStatus(root, _req, res) {
  const result = await serverStatus(root);
  res.json(result);
}

export async function handleServerStart(root, req, res) {
  const body = req.method === "POST" ? await readBody(req) : {};
  await serverStart(root, body);
  const result = await serverStatus(root);
  res.json(result);
}

export async function handleServerStop(root, _req, res) {
  await serverStop(root);
  const result = await serverStatus(root);
  res.json(result);
}

export async function handleServerCommand(root, _req, res) {
  try {
    const plan = await serverCommand(root);
    res.json({ command: plan.command, modelPath: plan.modelPath, baseUrl: plan.baseUrl });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
}

export async function handleServerLog(root, _req, res) {
  const logPath = `${root}/.apda/llama-server.log`;
  if (!existsSync(logPath)) {
    res.json({ lines: [] });
    return;
  }
  const raw = await readFile(logPath, "utf8");
  const lines = raw.split("\n").filter(Boolean).slice(-100);
  res.json({ lines });
}
