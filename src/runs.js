import React from "react";
import { render } from "ink";
import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { RunsView } from "./ui/RunsView.js";

function runsDir(root) {
  return path.join(root, ".apda", "runs");
}

function runPath(root, id) {
  return path.join(runsDir(root), `${id}.json`);
}

export function makeRunId(date = new Date()) {
  const stamp = date
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}Z$/, "Z");
  const suffix = Math.random().toString(36).slice(2, 8);
  return `${stamp}-${suffix}`;
}

function relative(root, filePath) {
  if (!filePath) return null;
  return path.isAbsolute(filePath)
    ? path.relative(root, filePath) || filePath
    : filePath;
}

export async function startRunRecord(root, data) {
  const now = new Date();
  const id = data.id ?? makeRunId(now);
  const record = {
    id,
    status: "running",
    startedAt: now.toISOString(),
    finishedAt: null,
    elapsedMs: null,
    workflowId: data.workflowId,
    workflowName: data.workflowName,
    input: {
      path: data.inputPath,
      relativePath: relative(root, data.inputPath),
    },
    options: {
      baseUrl: data.baseUrl ?? null,
      dryRun: Boolean(data.dryRun),
    },
    outputs: data.outputs ?? {},
    steps: data.steps ?? [],
    error: null,
  };
  await mkdir(runsDir(root), { recursive: true });
  await writeFile(
    runPath(root, id),
    `${JSON.stringify(record, null, 2)}\n`,
    "utf8",
  );
  return record;
}

export async function finishRunRecord(root, id, patch) {
  const filePath = runPath(root, id);
  const current = JSON.parse(await readFile(filePath, "utf8"));
  const finishedAt = new Date();
  const startedAt = new Date(current.startedAt);
  const next = {
    ...current,
    ...patch,
    finishedAt: finishedAt.toISOString(),
    elapsedMs: finishedAt.getTime() - startedAt.getTime(),
  };
  await writeFile(filePath, `${JSON.stringify(next, null, 2)}\n`, "utf8");
  return next;
}

export async function listRunRecords(root) {
  const dir = runsDir(root);
  if (!existsSync(dir)) return [];
  const entries = await readdir(dir, { withFileTypes: true });
  const records = [];
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
    try {
      const record = JSON.parse(
        await readFile(path.join(dir, entry.name), "utf8"),
      );
      records.push(record);
    } catch {
      // Ignore malformed local history files.
    }
  }
  return records.sort((a, b) =>
    String(b.startedAt).localeCompare(String(a.startedAt)),
  );
}

export async function readRunRecord(root, id) {
  const filePath = runPath(root, id);
  if (!existsSync(filePath)) return null;
  return JSON.parse(await readFile(filePath, "utf8"));
}

export async function runRunsCommand(root, argv = []) {
  const subcommand = argv[0];

  if (!subcommand) {
    const records = await listRunRecords(root);
    const { waitUntilExit } = render(
      React.createElement(RunsView, { records }),
    );
    await waitUntilExit();
    return;
  }

  if (subcommand === "show") {
    const id = argv[1];
    if (!id) throw new Error("Uso: apda runs show <id>");
    const record = await readRunRecord(root, id);
    if (!record) throw new Error(`Execucao nao encontrada: ${id}`);
    console.log(JSON.stringify(record, null, 2));
    return;
  }

  throw new Error("Uso: apda runs [show <id>]");
}
