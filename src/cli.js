#!/usr/bin/env node
import { parseArgs } from "node:util";
import { detectGpus } from "./detectors/gpu.js";
import { findInputFiles } from "./detectors/input-files.js";
import { findModels } from "./detectors/models.js";
import { runDoctor } from "./doctor.js";
import { runOnboarding } from "./onboard.js";
import { runRunsCommand } from "./runs.js";
import { runServerCommand } from "./server.js";
import { getWorkflowsForFile, listWorkflows } from "./workflows/registry.js";
import { runWorkflow } from "./workflows/run-workflow.js";
import { validateArtifactFile } from "./schema/validate.js";
import { resolveProjectRoot } from "./lib/paths.js";
import React from "react";
import { render } from "ink";
import { GpuList, ModelList, InputList } from "./ui/ListViews.js";
import { HelpView } from "./ui/HelpView.js";
import { WorkflowList } from "./ui/WorkflowList.js";
import { startWebServer } from "./web.js";

const command = process.argv[2] ?? "onboard";
const argv = process.argv.slice(3);

async function main() {
  const root = resolveProjectRoot();

  if (command === "doctor") {
    const { values } = parseArgs({
      args: argv,
      options: { json: { type: "boolean" } },
    });
    return runDoctor(root, { json: values.json });
  }

  if (command === "server") return runServerCommand(root, argv);

  if (command === "runs") return runRunsCommand(root, argv);

  if (command === "list-gpus") {
    const gpus = await detectGpus();
    const { waitUntilExit } = render(React.createElement(GpuList, { gpus }));
    return waitUntilExit();
  }

  if (command === "list-models") {
    const models = await findModels(root);
    const { waitUntilExit } = render(
      React.createElement(ModelList, { models }),
    );
    return waitUntilExit();
  }

  if (command === "list-inputs") {
    const inputs = await findInputFiles(root);
    const { waitUntilExit } = render(
      React.createElement(InputList, { inputs }),
    );
    return waitUntilExit();
  }

  if (command === "workflows") {
    const { values } = parseArgs({
      args: argv,
      options: { file: { type: "string", short: "f" } },
      allowPositionals: true,
    });
    const workflows = values.file
      ? getWorkflowsForFile(values.file)
      : listWorkflows();
    const { waitUntilExit } = render(
      React.createElement(WorkflowList, { workflows }),
    );
    return waitUntilExit();
  }

  if (command === "validate") {
    const { values, positionals } = parseArgs({
      args: argv,
      options: { json: { type: "boolean" } },
      allowPositionals: true,
    });
    const file = positionals[0];
    if (!file) throw new Error("Uso: apda validate <arquivo.json> [--json]");
    const result = await validateArtifactFile(root, file);
    if (values.json) {
      console.log(JSON.stringify(result, null, 2));
      if (!result.ok) process.exitCode = 1;
      return;
    }
    if (result.ok) {
      console.log(`OK: ${result.file}`);
      return;
    }
    console.error(`ERRO: ${result.file}`);
    for (const error of result.errors) console.error(`- ${error}`);
    process.exitCode = 1;
    return;
  }

  if (command === "run") {
    const { values } = parseArgs({
      args: argv,
      options: {
        file: { type: "string", short: "f" },
        workflow: { type: "string", short: "w" },
        "base-url": { type: "string" },
        "dry-run": { type: "boolean" },
      },
    });
    if (!values.file || !values.workflow)
      throw new Error("Uso: apda run --file <entrada/arquivo> --workflow <id>");
    return runWorkflow(root, values.workflow, values.file, {
      baseUrl: values["base-url"],
      dryRun: values["dry-run"],
    });
  }

  if (command === "onboard") {
    const { values } = parseArgs({
      args: argv,
      options: { "dry-run": { type: "boolean" } },
    });
    return runOnboarding(root, { dryRun: values["dry-run"] });
  }

  if (command === "web") {
    const { values } = parseArgs({
      args: argv,
      options: {
        port: { type: "string" },
        "no-open": { type: "boolean" },
      },
    });
    const port = values.port ? Number(values.port) : 3000;
    return startWebServer(root, { port, open: !values["no-open"] });
  }

  const { waitUntilExit } = render(React.createElement(HelpView));
  return waitUntilExit();
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
