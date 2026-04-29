/**
 * WorkflowProgress — exibe o progresso de um workflow etapa a etapa.
 *
 * Usa React.createElement (sem JSX) para compatibilidade com ESM puro / Node >= 20
 * sem transpilador Babel.
 *
 * O componente escuta eventos de um EventEmitter Node.js:
 *   'step:start'     → payload: stepId (string)
 *   'step:done'      → payload: stepId (string)
 *   'step:error'     → payload: { step: string, message: string }
 *   'workflow:done'  → sem payload
 *   'workflow:error' → payload: message (string)
 */

import React, { useState, useEffect } from "react";
import { Box, Text } from "ink";
import Spinner from "ink-spinner";

const e = React.createElement;

// ─────────────────────────────────────────────────────────────────────────────
// Constantes
// ─────────────────────────────────────────────────────────────────────────────

const STEP_LABELS = {
  "extract-text": "Extrair texto",
  "privacy-filter": "Anonimizar (filtro de privacidade)",
  "generate-artifact": "Gerar artefato APDA via LLM",
  "validate-schema": "Validar schema JSON",
  "scan-segments": "Varredura semântica (identificar segmentos)",
  "generate-from-manifest": "Gerar APDAs por segmento",
};

// ─────────────────────────────────────────────────────────────────────────────
// Sub-componente: ícone de status de uma etapa
// ─────────────────────────────────────────────────────────────────────────────

function StepIcon({ status }) {
  switch (status) {
    case "loading":
      return e(Text, { color: "cyan" }, e(Spinner, { type: "dots" }));
    case "success":
      return e(Text, { color: "green" }, "✔");
    case "error":
      return e(Text, { color: "red" }, "✘");
    default: // 'pending'
      return e(Text, { dimColor: true }, "·");
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-componente: linha de uma etapa
// ─────────────────────────────────────────────────────────────────────────────

function StepRow({ stepId, status }) {
  const label = STEP_LABELS[stepId] ?? stepId;

  const labelColor =
    status === "success"
      ? "green"
      : status === "error"
        ? "red"
        : status === "loading"
          ? "white"
          : undefined;

  return e(
    Box,
    { flexDirection: "row", gap: 1 },
    e(StepIcon, { status }),
    e(Text, { color: labelColor, dimColor: status === "pending" }, label),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────────────────────────────────────

/**
 * WorkflowProgress
 *
 * @param {object}       props
 * @param {string}       props.workflowName  — nome legível do workflow
 * @param {string}       props.inputFile     — caminho relativo do arquivo de entrada
 * @param {string[]}     props.steps         — array de IDs de etapas na ordem de execução
 * @param {EventEmitter} props.emitter       — emitter compartilhado com run-workflow.js
 */
export function WorkflowProgress({ workflowName, inputFile, steps, emitter }) {
  const [stepStatus, setStepStatus] = useState(() =>
    Object.fromEntries(steps.map((s) => [s, "pending"])),
  );
  const [done, setDone] = useState(false);
  const [errorMsg, setErrorMsg] = useState(null);

  useEffect(() => {
    function onStepStart(stepId) {
      setStepStatus((prev) => ({ ...prev, [stepId]: "loading" }));
    }
    function onStepDone(stepId) {
      setStepStatus((prev) => ({ ...prev, [stepId]: "success" }));
    }
    function onStepError({ step, message }) {
      setStepStatus((prev) => ({ ...prev, [step]: "error" }));
      setErrorMsg(message);
    }
    function onWorkflowDone() {
      setDone(true);
    }
    function onWorkflowError(message) {
      setErrorMsg(message);
    }

    emitter.on("step:start", onStepStart);
    emitter.on("step:done", onStepDone);
    emitter.on("step:error", onStepError);
    emitter.on("workflow:done", onWorkflowDone);
    emitter.on("workflow:error", onWorkflowError);

    return () => {
      emitter.off("step:start", onStepStart);
      emitter.off("step:done", onStepDone);
      emitter.off("step:error", onStepError);
      emitter.off("workflow:done", onWorkflowDone);
      emitter.off("workflow:error", onWorkflowError);
    };
  }, [emitter]);

  return e(
    Box,
    { flexDirection: "column", paddingY: 1 },

    // Cabeçalho
    e(
      Box,
      { flexDirection: "row", gap: 1, marginBottom: 1 },
      e(Text, { bold: true }, "Workflow:"),
      e(Text, { color: "cyan", bold: true }, workflowName),
    ),
    e(
      Box,
      { flexDirection: "row", gap: 1, marginBottom: 1 },
      e(Text, { dimColor: true }, "Entrada: "),
      e(Text, null, inputFile),
    ),

    // Etapas
    e(
      Box,
      { flexDirection: "column", paddingLeft: 2 },
      ...steps.map((stepId) =>
        e(StepRow, {
          key: stepId,
          stepId,
          status: stepStatus[stepId] ?? "pending",
        }),
      ),
    ),

    // Resultado final
    done && !errorMsg
      ? e(
          Box,
          { marginTop: 1 },
          e(Text, { color: "green", bold: true }, "✔ Concluído com sucesso!"),
        )
      : null,

    errorMsg
      ? e(
          Box,
          { marginTop: 1, flexDirection: "column" },
          e(Text, { color: "red", bold: true }, "✘ Erro durante a execução:"),
          e(Text, { color: "red", wrap: "wrap" }, `  ${errorMsg}`),
        )
      : null,
  );
}

export default WorkflowProgress;
