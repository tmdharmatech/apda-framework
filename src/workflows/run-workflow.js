import { existsSync } from "node:fs";
import { mkdir } from "node:fs/promises";
import path from "node:path";
import { EventEmitter } from "node:events";
import React from "react";
import { render } from "ink";
import { runCommand } from "../lib/command.js";
import { toAbsolute } from "../lib/paths.js";
import { detectPython } from "../detectors/python-env.js";
import { finishRunRecord, makeRunId, startRunRecord } from "../runs.js";
import { getWorkflow } from "./registry.js";
import { validateArtifactFile } from "../schema/validate.js";
import { WorkflowProgress } from "../ui/WorkflowProgress.js";

function relativeToRoot(root, filePath) {
  return path.relative(root, filePath) || filePath;
}

async function runPython(root, python, script, args, emitter, stepId) {
  if (emitter && stepId) emitter.emit("step:start", stepId);
  const result = await runCommand(python, [script, ...args], {
    cwd: root,
    stdio: "pipe",
  });
  if (!result.ok) {
    const details = [result.stderr, result.stdout].filter(Boolean).join("\n").trim();
    const message = details
      ? `Falha ao executar ${script}.\n${details}`
      : `Falha ao executar ${script}.`;
    if (emitter && stepId)
      emitter.emit("step:error", {
        step: stepId,
        message,
      });
    throw new Error(message);
  }
  if (emitter && stepId) emitter.emit("step:done", stepId);
}

function printPlannedStep(python, script, args) {
  console.log(`> ${python} ${script} ${args.join(" ")}`);
}

function requiresPython(workflow) {
  return workflow.steps.some(
    (step) =>
      step === "extract-text" ||
      step === "privacy-filter" ||
      step === "generate-artifact" ||
      step === "scan-segments" ||
      step === "generate-from-manifest",
  );
}

function baseNameForOutputs(filePath) {
  const name = path.basename(filePath, path.extname(filePath));
  return name
    .replace(/\.texto_extraido$/i, "")
    .replace(/\.texto_anonimizado$/i, "")
    .replace(/\.opf_anonimizado$/i, "")
    .replace(/\.apda$/i, "");
}

export async function runWorkflow(root, workflowId, inputFile, options = {}) {
  const workflow = getWorkflow(workflowId);
  if (!workflow) throw new Error(`Workflow desconhecido: ${workflowId}`);

  const inputPath = toAbsolute(root, inputFile);
  if (!existsSync(inputPath))
    throw new Error(`Arquivo de entrada nao encontrado: ${inputPath}`);
  const inputExtension = path.extname(inputPath).toLowerCase();
  if (!workflow.inputExtensions.includes(inputExtension)) {
    throw new Error(
      `Workflow ${workflow.id} nao aceita arquivos ${inputExtension || "sem extensao"}.`,
    );
  }

  await mkdir(path.join(root, "saida"), { recursive: true });
  const stem = baseNameForOutputs(inputPath);
  const extracted = path.join(root, "saida", `${stem}.texto_extraido.txt`);
  const anonymized = path.join(root, "saida", `${stem}.opf_anonimizado.txt`);
  const artifact = path.join(root, "saida", `${stem}.apda.json`);
  const manifest = path.join(root, "saida", `${stem}.segmentos.json`);
  let currentText = inputPath;
  let currentArtifact = inputPath;
  const outputs = {
    extracted: {
      path: extracted,
      relativePath: relativeToRoot(root, extracted),
    },
    anonymized: {
      path: anonymized,
      relativePath: relativeToRoot(root, anonymized),
    },
    artifact: { path: artifact, relativePath: relativeToRoot(root, artifact) },
    manifest: { path: manifest, relativePath: relativeToRoot(root, manifest) },
  };
  const startedRun =
    options.record === false
      ? null
      : await startRunRecord(root, {
          id: options.runId,
          workflowId: workflow.id,
          workflowName: workflow.name,
          inputPath,
          baseUrl:
            options.baseUrl ??
            process.env.APDA_LLAMA_BASE_URL ??
            "http://127.0.0.1:8091",
          dryRun: options.dryRun,
          outputs,
          steps: workflow.steps,
        });

  const emitter = new EventEmitter();
  const { unmount } = render(
    React.createElement(WorkflowProgress, {
      workflowName: workflow.name,
      inputFile: relativeToRoot(root, inputPath),
      steps: workflow.steps,
      emitter,
    }),
  );

  try {
    let python = null;
    if (requiresPython(workflow)) {
      python = await detectPython(root);
      if (!python.ok)
        throw new Error(
          "Python nao encontrado. Crie .venv ou instale python3.",
        );
      if (!python.scriptsOk)
        throw new Error("Scripts APDA obrigatorios nao encontrados.");
      if (!options.dryRun && !python.modulesOk) {
        const missing = python.modules
          .filter((item) => !item.ok)
          .map((item) => item.packageName)
          .join(", ");
        throw new Error(
          `Dependencias Python ausentes: ${missing}. Instale com: .venv/bin/pip install -r requirements.txt`,
        );
      }
    }

    if (workflow.steps.includes("extract-text")) {
      const args = ["--input", inputPath, "--output", extracted];
      if (options.dryRun) {
        printPlannedStep(python.command, "scripts/01_extrair_texto.py", args);
        emitter.emit("step:start", "extract-text");
        emitter.emit("step:done", "extract-text");
      } else {
        await runPython(
          root,
          python.command,
          "scripts/01_extrair_texto.py",
          args,
          emitter,
          "extract-text",
        );
        if (!existsSync(extracted))
          throw new Error(
            `Texto extraido esperado nao foi gerado: ${extracted}`,
          );
      }
      currentText = extracted;
    }

    if (workflow.steps.includes("privacy-filter")) {
      const args = ["--input", currentText, "--output", anonymized];
      if (options.dryRun) {
        printPlannedStep(
          python.command,
          "scripts/04_privacy_filter_anonimizar.py",
          args,
        );
        emitter.emit("step:start", "privacy-filter");
        emitter.emit("step:done", "privacy-filter");
      } else {
        await runPython(
          root,
          python.command,
          "scripts/04_privacy_filter_anonimizar.py",
          args,
          emitter,
          "privacy-filter",
        );
      }
      currentText = anonymized;
    }

    if (workflow.steps.includes("scan-segments")) {
      const args = [
        "--input",
        currentText,
        "--output",
        manifest,
        "--base-url",
        options.baseUrl ??
          process.env.APDA_LLAMA_BASE_URL ??
          "http://127.0.0.1:8091",
      ];
      if (options.dryRun) {
        emitter.emit("step:start", "scan-segments");
        printPlannedStep(python.command, "scripts/02_scan_segments.py", args);
        emitter.emit("step:done", "scan-segments");
      } else {
        await runPython(
          root,
          python.command,
          "scripts/02_scan_segments.py",
          args,
          emitter,
          "scan-segments",
        );
        if (!existsSync(manifest))
          throw new Error(`Manifesto de segmentos não gerado: ${manifest}`);
      }
    }

    if (workflow.steps.includes("generate-from-manifest")) {
      const args = [
        "--manifest",
        manifest,
        "--input",
        currentText,
        "--output-dir",
        path.join(root, "saida"),
        "--base-url",
        options.baseUrl ??
          process.env.APDA_LLAMA_BASE_URL ??
          "http://127.0.0.1:8091",
      ];
      if (options.dryRun) {
        emitter.emit("step:start", "generate-from-manifest");
        printPlannedStep(
          python.command,
          "scripts/07_gerar_de_manifesto.py",
          args,
        );
        emitter.emit("step:done", "generate-from-manifest");
      } else {
        await runPython(
          root,
          python.command,
          "scripts/07_gerar_de_manifesto.py",
          args,
          emitter,
          "generate-from-manifest",
        );
      }
    }

    if (workflow.steps.includes("generate-artifact")) {
      const baseUrl =
        options.baseUrl ??
        process.env.APDA_LLAMA_BASE_URL ??
        "http://127.0.0.1:8091";
      const useLitellm =
        options.litellm ||
        process.env.APDA_LITELLM === "1" ||
        baseUrl.includes(":4000");
      const args = [
        "--input",
        currentText,
        "--output",
        artifact,
        "--base-url",
        baseUrl,
      ];
      if (useLitellm) args.push("--litellm");
      if (options.dryRun) {
        printPlannedStep(
          python.command,
          "scripts/05_gerar_artefato_3b.py",
          args,
        );
        emitter.emit("step:start", "generate-artifact");
        emitter.emit("step:done", "generate-artifact");
      } else {
        await runPython(
          root,
          python.command,
          "scripts/05_gerar_artefato_3b.py",
          args,
          emitter,
          "generate-artifact",
        );
      }
      currentArtifact = artifact;
    }

    if (workflow.steps.includes("validate-schema")) {
      if (options.dryRun) {
        printPlannedStep("apda", "validate", [currentArtifact]);
        emitter.emit("step:start", "validate-schema");
        emitter.emit("step:done", "validate-schema");
        emitter.emit("workflow:done");
        await new Promise((r) => setTimeout(r, 120));
        unmount();
        if (startedRun) {
          await finishRunRecord(root, startedRun.id, {
            status: "dry-run",
            outputs: {
              ...outputs,
              artifact: {
                path: currentArtifact,
                relativePath: relativeToRoot(root, currentArtifact),
              },
            },
          });
        }
        return { artifact: currentArtifact, extracted, anonymized };
      }
      emitter.emit("step:start", "validate-schema");
      const result = await validateArtifactFile(root, currentArtifact);
      if (!result.ok) {
        emitter.emit("step:error", {
          step: "validate-schema",
          message: `Artefato nao passou na validacao: ${currentArtifact}`,
        });
        for (const error of result.errors) console.error(`- ${error}`);
        throw new Error(`Artefato nao passou na validacao: ${currentArtifact}`);
      }
      emitter.emit("step:done", "validate-schema");
    }

    emitter.emit("workflow:done");
    await new Promise((r) => setTimeout(r, 120));
    unmount();

    if (startedRun) {
      await finishRunRecord(root, startedRun.id, {
        status: options.dryRun ? "dry-run" : "ok",
        outputs: {
          ...outputs,
          artifact: {
            path: currentArtifact,
            relativePath: relativeToRoot(root, currentArtifact),
          },
        },
      });
    }

    return { artifact: currentArtifact, extracted, anonymized };
  } catch (error) {
    emitter.emit("workflow:error", error.message);
    await new Promise((r) => setTimeout(r, 120));
    unmount();

    if (startedRun) {
      await finishRunRecord(root, startedRun.id, {
        status: "error",
        outputs: {
          ...outputs,
          artifact: {
            path: currentArtifact,
            relativePath: relativeToRoot(root, currentArtifact),
          },
        },
        error: {
          message: error.message,
          stack: error.stack,
        },
      });
    }
    throw error;
  }
}
