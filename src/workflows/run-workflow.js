import { existsSync } from "node:fs";
import { mkdir, readdir, stat } from "node:fs/promises";
import path from "node:path";
import { EventEmitter } from "node:events";
import React from "react";
import { render } from "ink";
import { runCommand } from "../lib/command.js";
import { pushMetrics } from "../lib/metrics-client.js";
import { toAbsolute } from "../lib/paths.js";
import { resolveBaseUrl } from "../lib/resolve-base-url.js";
import { detectPython } from "../detectors/python-env.js";
import { finishRunRecord, startRunRecord } from "../runs.js";
import { getWorkflow } from "./registry.js";
import { STEP_REGISTRY } from "./step-registry.js";
import { validateArtifactFile, validateManifestFile } from "../schema/validate.js";
import { WorkflowProgress } from "../ui/WorkflowProgress.js";

function relativeToRoot(root, filePath) {
  return path.relative(root, filePath) || filePath;
}

function elapsedSeconds(startedAt) {
  return Number(((Date.now() - startedAt) / 1000).toFixed(3));
}

function normalizeMetricReason(error) {
  if (!error) return "erro";
  if (error.code) return String(error.code).slice(0, 80);
  if (error.name && error.name !== "Error") return error.name.slice(0, 80);
  return "erro";
}

async function pathSize(filePath) {
  if (!filePath) return 0;
  try {
    const info = await stat(filePath);
    if (info.isFile()) return info.size;
    if (!info.isDirectory()) return 0;

    const entries = await readdir(filePath, { withFileTypes: true });
    const sizes = await Promise.all(
      entries.map((entry) => pathSize(path.join(filePath, entry.name))),
    );
    return sizes.reduce((sum, size) => sum + size, 0);
  } catch {
    return 0;
  }
}

async function totalPathSize(paths = []) {
  const uniquePaths = [...new Set(paths.filter(Boolean))];
  const sizes = await Promise.all(uniquePaths.map((item) => pathSize(item)));
  return sizes.reduce((sum, size) => sum + size, 0);
}

function nativeStepInputPaths(stepId, ctx) {
  if (stepId === "validate-manifest") return [ctx.manifest];
  if (stepId === "validate-schema") return [ctx.currentArtifact];
  return [];
}

function nativeStepOutputPaths() {
  return [];
}

function stepInputPaths(stepId, stepDef, ctx) {
  return stepDef?.inputPaths
    ? stepDef.inputPaths(ctx)
    : nativeStepInputPaths(stepId, ctx);
}

function stepOutputPaths(stepId, stepDef, ctx) {
  return stepDef?.outputPaths
    ? stepDef.outputPaths(ctx)
    : nativeStepOutputPaths(stepId, ctx);
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
    if (emitter && stepId) emitter.emit("step:error", { step: stepId, message });
    throw new Error(message);
  }
  if (emitter && stepId) emitter.emit("step:done", stepId);
}

function printPlannedStep(python, script, args) {
  console.log(`> ${python} ${script} ${args.join(" ")}`);
}

function requiresPython(workflow) {
  return workflow.steps.some((step) => step in STEP_REGISTRY);
}

function baseNameForOutputs(filePath) {
  const name = path.basename(filePath, path.extname(filePath));
  return name
    .replace(/\.texto_extraido$/i, "")
    .replace(/\.texto_anonimizado$/i, "")
    .replace(/\.opf_anonimizado$/i, "")
    .replace(/\.apda$/i, "");
}

async function emitArtifactResultMetric(ctx, jsonValido, motivoInvalido = null) {
  await pushMetrics(
    {
      action: "resultado",
      resultado: {
        json_valido: jsonValido,
        motivo_invalido: motivoInvalido,
        campos_inventados: [],
        pii_detectado_saida: [],
        entidades_anonimizadas: [],
        tipo_artefato: "desconhecido",
      },
      municipio: ctx.municipio,
      workflow: ctx.workflowId,
      modelo: ctx.modelo,
      formato: ctx.inputFormat,
    },
    ctx.metrics,
  );
}

async function emitStepMetric(ctx, metric) {
  await pushMetrics(
    {
      action: "step",
      workflow: ctx.workflowId,
      step: metric.stepId,
      status: metric.status,
      formato: ctx.inputFormat,
      modelo: ctx.modelo,
      elapsed: metric.elapsed,
      input_bytes: metric.inputBytes,
      output_bytes: metric.outputBytes,
      error: metric.error,
    },
    ctx.metrics,
  );
}

async function emitPipelineMetric(ctx, metric) {
  await pushMetrics(
    {
      action: "pipeline",
      workflow: ctx.workflowId,
      status: metric.status,
      formato: ctx.inputFormat,
      modelo: ctx.modelo,
      elapsed: metric.elapsed,
      steps_executed: metric.stepsExecuted,
      error: metric.error,
    },
    ctx.metrics,
  );
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
  const outputDir = path.join(root, "saida");
  const extracted  = path.join(outputDir, `${stem}.texto_extraido.txt`);
  const anonymized = path.join(outputDir, `${stem}.opf_anonimizado.txt`);
  const regexOut   = path.join(outputDir, `${stem}.texto_anonimizado.txt`);
  const artifact   = path.join(outputDir, `${stem}.apda.json`);
  const manifest   = path.join(outputDir, `${stem}.segmentos.json`);

  // Resolve baseUrl e litellm uma única vez — usados por múltiplos steps.
  const baseUrl = resolveBaseUrl(options.baseUrl);
  const litellm =
    options.litellm || process.env.APDA_LITELLM === "1" || baseUrl.includes(":4000");
  const inputFormat = inputExtension.replace(/^\./, "") || "sem_extensao";
  const modelo =
    options.modelo || options.model || process.env.APDA_MODELO || "apda-local-3b";
  const municipio =
    options.municipio || process.env.APDA_MUNICIPIO || "desconhecido";

  const outputs = {
    extracted:  { path: extracted,  relativePath: relativeToRoot(root, extracted) },
    anonymized: { path: anonymized, relativePath: relativeToRoot(root, anonymized) },
    artifact:   { path: artifact,   relativePath: relativeToRoot(root, artifact) },
    manifest:   { path: manifest,   relativePath: relativeToRoot(root, manifest) },
  };

  const startedRun =
    options.record === false
      ? null
      : await startRunRecord(root, {
          id: options.runId,
          workflowId: workflow.id,
          workflowName: workflow.name,
          inputPath,
          baseUrl,
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

  // Contexto mutável compartilhado entre steps do pipeline.
  const ctx = {
    root,
    inputPath,
    stem,
    outputDir,
    extracted,
    anonymized,
    regexOut,
    artifact,
    manifest,
    baseUrl,
    litellm,
    modelo,
    municipio,
    workflowId: workflow.id,
    inputFormat,
    dryRun: Boolean(options.dryRun),
    metrics: {
      enabled: options.metrics !== false,
      metricsUrl: options.metricsUrl,
      timeoutMs: options.metricsTimeoutMs,
    },
    stepsExecuted: 0,
    workflowHasSchemaValidation: workflow.steps.includes("validate-schema"),
    currentText: inputPath,
    currentArtifact: inputPath,
  };

  const pipelineStartedAt = Date.now();

  try {
    let python = null;
    if (requiresPython(workflow)) {
      python = await detectPython(root);
      if (!python.ok)
        throw new Error("Python nao encontrado. Crie .venv ou instale python3.");
      if (!python.scriptsOk)
        throw new Error("Scripts APDA obrigatorios nao encontrados.");
      if (!options.dryRun) {
        if (!python.coreModulesOk) {
          const missing = python.coreModules
            .filter((item) => !item.ok)
            .map((item) => item.packageName)
            .join(", ");
          throw new Error(
            `Dependencias Python ausentes: ${missing}. Instale com: pip install -r requirements.txt`,
          );
        }
        const usesPrivacyFilter = workflow.steps.includes("privacy-filter");
        if (usesPrivacyFilter && !python.neuralModulesOk) {
          const missing = python.neuralModules
            .filter((item) => !item.ok)
            .map((item) => item.packageName)
            .join(", ");
          throw new Error(
            `Privacy Filter neural requer dependencias adicionais: ${missing}. Instale com: pip install -r requirements-neural.txt`,
          );
        }
      }
    }

    for (const stepId of workflow.steps) {
      const stepDef = STEP_REGISTRY[stepId];
      const inputPaths = stepInputPaths(stepId, stepDef, ctx);
      const outputPaths = stepOutputPaths(stepId, stepDef, ctx);
      const inputBytes = await totalPathSize(inputPaths);
      const outputBytesBefore = await totalPathSize(outputPaths);
      const outputDirBytesBefore = await pathSize(ctx.outputDir);
      const stepStartedAt = Date.now();
      let stepStatus = ctx.dryRun ? "dry-run" : "ok";
      let stepError = null;

      try {
        if (stepDef) {
        // Step Python: executado via subprocess
        const args = stepDef.argsFrom(ctx);
        if (options.dryRun) {
          printPlannedStep(python.command, stepDef.script, args);
          emitter.emit("step:start", stepId);
          emitter.emit("step:done", stepId);
        } else {
          await runPython(root, python.command, stepDef.script, args, emitter, stepId);
          if (stepDef.checkFile) {
            const check = stepDef.checkFile(ctx);
            if (!existsSync(check.path)) throw new Error(check.error);
          }
          if (stepDef.afterRun) stepDef.afterRun(ctx);
        }
        } else if (stepId === "validate-manifest") {
        // Step nativo JS: validação do manifesto de segmentos
        if (options.dryRun) {
          printPlannedStep("apda", "validate-manifest", [ctx.manifest]);
          emitter.emit("step:start", "validate-manifest");
          emitter.emit("step:done", "validate-manifest");
        } else {
          emitter.emit("step:start", "validate-manifest");
          const result = await validateManifestFile(root, ctx.manifest);
          if (!result.ok) {
            emitter.emit("step:error", {
              step: "validate-manifest",
              message: `Manifesto nao passou na validacao: ${ctx.manifest}`,
            });
            for (const error of result.errors) console.error(`- ${error}`);
            throw new Error(`Manifesto nao passou na validacao: ${ctx.manifest}`);
          }
          emitter.emit("step:done", "validate-manifest");
        }
        } else if (stepId === "validate-schema") {
        // Step nativo JS: validação de schema em processo
        if (options.dryRun) {
          printPlannedStep("apda", "validate", [ctx.currentArtifact]);
          emitter.emit("step:start", "validate-schema");
          emitter.emit("step:done", "validate-schema");
        } else {
          emitter.emit("step:start", "validate-schema");
          const result = await validateArtifactFile(root, ctx.currentArtifact);
          await emitArtifactResultMetric(
            ctx,
            result.ok,
            result.ok ? null : "schema_validation",
          );
          if (!result.ok) {
            emitter.emit("step:error", {
              step: "validate-schema",
              message: `Artefato nao passou na validacao: ${ctx.currentArtifact}`,
            });
            for (const error of result.errors) console.error(`- ${error}`);
            throw new Error(`Artefato nao passou na validacao: ${ctx.currentArtifact}`);
          }
          emitter.emit("step:done", "validate-schema");
        }
        } else {
        throw new Error(`Step desconhecido: ${stepId}`);
        }
      } catch (error) {
        stepStatus = "error";
        stepError = error;
      } finally {
        ctx.stepsExecuted += 1;
        const outputBytesAfter = await totalPathSize(outputPaths);
        const outputDirBytesAfter = await pathSize(ctx.outputDir);
        const directOutputDelta = Math.max(0, outputBytesAfter - outputBytesBefore);
        const outputDirDelta = Math.max(0, outputDirBytesAfter - outputDirBytesBefore);
        await emitStepMetric(ctx, {
          stepId,
          status: stepStatus,
          elapsed: elapsedSeconds(stepStartedAt),
          inputBytes,
          outputBytes: directOutputDelta || outputDirDelta,
          error: stepError ? normalizeMetricReason(stepError) : undefined,
        });

        if (
          stepId === "generate-artifact" &&
          stepStatus !== "dry-run" &&
          (stepError || !ctx.workflowHasSchemaValidation)
        ) {
          await emitArtifactResultMetric(
            ctx,
            !stepError,
            stepError ? normalizeMetricReason(stepError) : null,
          );
        }
      }

      if (stepError) throw stepError;
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
            path: ctx.currentArtifact,
            relativePath: relativeToRoot(root, ctx.currentArtifact),
          },
        },
      });
    }

    await emitPipelineMetric(ctx, {
      status: options.dryRun ? "dry-run" : "ok",
      elapsed: elapsedSeconds(pipelineStartedAt),
      stepsExecuted: ctx.stepsExecuted,
    });

    return { artifact: ctx.currentArtifact, extracted, anonymized };
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
            path: ctx.currentArtifact,
            relativePath: relativeToRoot(root, ctx.currentArtifact),
          },
        },
        error: {
          message: error.message,
          stack: error.stack,
        },
      });
    }
    await emitPipelineMetric(ctx, {
      status: "error",
      elapsed: elapsedSeconds(pipelineStartedAt),
      stepsExecuted: ctx.stepsExecuted,
      error: normalizeMetricReason(error),
    });
    throw error;
  }
}
