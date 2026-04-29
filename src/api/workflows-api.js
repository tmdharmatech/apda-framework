import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { readBody } from "../lib/http.js";
import { getWorkflowsForFile, listWorkflows } from "../workflows/registry.js";
import { runWorkflow } from "../workflows/run-workflow.js";
import { makeRunId, readRunRecord } from "../runs.js";

export async function handleWorkflows(_root, req, res) {
  const url = new URL(req.url, "http://localhost");
  const file = url.searchParams.get("file");
  const workflows = file ? getWorkflowsForFile(file) : listWorkflows();
  res.json(workflows);
}

export async function handleRun(root, req, res) {
  const body = await readBody(req);
  const { file, workflow: workflowId, baseUrl, dryRun } = body;

  if (!file || !workflowId) {
    res.status(400).json({ error: "Campos obrigatorios: file, workflow." });
    return;
  }

  const runId = makeRunId();
  runWorkflow(root, workflowId, file, { baseUrl, dryRun, runId }).catch(() => {});
  res.status(202).json({ runId, status: "started", file, workflowId });
}

export async function handleRunWithId(root, req, res) {
  const body = await readBody(req);
  const { file, workflow: workflowId, baseUrl, dryRun } = body;

  if (!file || !workflowId) {
    res.status(400).json({ error: "Campos obrigatorios: file, workflow." });
    return;
  }

  let runId = null;
  const originalLog = console.log;
  const originalError = console.error;

  try {
    const result = await runWorkflow(root, workflowId, file, { baseUrl, dryRun });
    res.json({ status: "ok", ...result });
  } catch (error) {
    res.status(500).json({ status: "error", error: error.message });
  } finally {
    console.log = originalLog;
    console.error = originalError;
  }
}

export async function handleRunStream(root, req, res) {
  const url = new URL(req.url, "http://localhost");
  const runId = url.searchParams.get("runId");

  if (!runId) {
    res.status(400).json({ error: "Parametro runId obrigatorio." });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders();

  function send(event, data) {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  }

  let lastStatus = null;
  let notFoundRetries = 0;
  const MAX_NOT_FOUND_RETRIES = 15; // até 9s de espera pelo arquivo ser criado

  const interval = setInterval(async () => {
    try {
      const record = await readRunRecord(root, runId);
      if (!record) {
        notFoundRetries++;
        if (notFoundRetries >= MAX_NOT_FOUND_RETRIES) {
          send("error", { message: `Execucao nao encontrada: ${runId}` });
          clearInterval(interval);
          res.end();
        }
        return;
      }

      if (record.status !== lastStatus) {
        lastStatus = record.status;
        send("update", record);
      }

      if (record.status !== "running") {
        clearInterval(interval);
        res.end();
      }
    } catch {
      clearInterval(interval);
      res.end();
    }
  }, 600);

  req.on("close", () => clearInterval(interval));
}

export async function handleRunSync(root, req, res) {
  const body = await readBody(req);
  const { file, workflow: workflowId, baseUrl, dryRun } = body;

  if (!file || !workflowId) {
    res.status(400).json({ error: "Campos obrigatorios: file, workflow." });
    return;
  }

  try {
    const result = await runWorkflow(root, workflowId, file, { baseUrl, dryRun });
    res.json({ status: "ok", ...result });
  } catch (error) {
    res.status(500).json({ status: "error", error: error.message });
  }
}
