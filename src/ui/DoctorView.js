/**
 * DoctorView — renderiza o relatório completo de `buildDoctorReport`.
 *
 * Usa React.createElement (sem JSX) para compatibilidade com ESM puro / Node >= 20
 * sem transpilador Babel.
 */

import React from "react";
import { Box, Text } from "ink";

const e = React.createElement;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Rótulo ✔ / ✘ colorido. */
function StatusBadge({ ok, labelOk = "ok", labelFail = "problema" }) {
  return e(Text, { color: ok ? "green" : "red" }, ok ? `✔ ${labelOk}` : `✘ ${labelFail}`);
}

/** Seção com borda e título. */
function Section({ title, borderColor = "cyan", children }) {
  return e(
    Box,
    {
      flexDirection: "column",
      borderStyle: "round",
      borderColor,
      paddingX: 1,
      marginBottom: 1,
    },
    e(Text, { bold: true, color: borderColor }, title),
    e(Box, { height: 0 }), // espaço visual mínimo
    children,
  );
}

/** Uma linha de item com marcador opcional. */
function Item({ label, value, valueColor, indent = 0 }) {
  const pad = " ".repeat(indent * 2);
  return e(
    Box,
    { flexDirection: "row" },
    e(Text, { dimColor: true }, `${pad}• `),
    e(Text, null, `${label}: `),
    e(Text, { color: valueColor ?? undefined }, String(value ?? "—")),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Seções
// ─────────────────────────────────────────────────────────────────────────────

function SectionGeneral({ report }) {
  const configValue = report.config.exists
    ? report.config.path
    : "não encontrada";
  const configColor = report.config.exists ? "green" : "yellow";

  return e(
    Section,
    { title: "⚙  Projeto", borderColor: "blue" },
    e(Item, { label: "Raiz", value: report.projectRoot }),
    e(Item, {
      label: "Config local",
      value: configValue,
      valueColor: configColor,
    }),
  );
}

function SectionPython({ python }) {
  const children = [
    e(
      Box,
      { flexDirection: "row", key: "status" },
      e(Text, null, "Status: "),
      e(StatusBadge, { ok: python.ok }),
      python.command
        ? e(Text, { dimColor: true }, `  (${python.command})`)
        : null,
    ),
    python.version
      ? e(Item, { label: "Versão", value: python.version, key: "ver" })
      : null,
    e(
      Box,
      { flexDirection: "row", key: "scripts" },
      e(Text, null, "  Scripts APDA: "),
      e(StatusBadge, { ok: python.scriptsOk }),
    ),
    e(
      Box,
      { flexDirection: "row", key: "mods" },
      e(Text, null, "  Módulos Python: "),
      e(StatusBadge, { ok: python.modulesOk }),
    ),
  ];

  // Módulos ausentes
  const missing = python.modules.filter((m) => !m.ok);
  for (const mod of missing) {
    children.push(
      e(
        Box,
        { flexDirection: "row", key: `mod-${mod.module}` },
        e(Text, { color: "red" }, `    ✘ ${mod.packageName} `),
        e(Text, { dimColor: true }, `(import ${mod.module})`),
      ),
    );
  }
  // Módulos presentes (dim)
  const present = python.modules.filter((m) => m.ok);
  for (const mod of present) {
    children.push(
      e(
        Box,
        { flexDirection: "row", key: `modok-${mod.module}` },
        e(Text, { color: "green", dimColor: true }, `    ✔ ${mod.packageName}`),
      ),
    );
  }

  const borderColor = python.ok && python.modulesOk ? "green" : "red";
  return e(Section, { title: "🐍  Python", borderColor }, ...children);
}

function SectionGpus({ gpus }) {
  const items =
    gpus.length === 0
      ? [e(Text, { color: "yellow", key: "none" }, "Nenhuma GPU detectada — CPU será usada como fallback.")]
      : gpus.map((gpu, i) =>
          e(
            Box,
            { flexDirection: "row", key: gpu.label },
            e(Text, { color: "cyan" }, `  ${i + 1}. `),
            e(Text, null, gpu.label),
          ),
        );

  return e(Section, { title: "🖥  GPUs", borderColor: "cyan" }, ...items);
}

function SectionModels({ models, defaultModel }) {
  const shown = models.slice(0, 8);
  const extra = models.length - shown.length;

  const items = [];

  if (models.length === 0) {
    items.push(
      e(Text, { color: "yellow", key: "none" }, "Nenhum modelo .gguf encontrado."),
    );
  } else {
    for (const model of shown) {
      items.push(
        e(
          Box,
          { flexDirection: "row", key: model.name },
          e(Text, { color: "magenta" }, "  • "),
          e(Text, null, model.name),
          e(Text, { dimColor: true }, `  (${model.sizeLabel})`),
        ),
      );
    }
    if (extra > 0) {
      items.push(
        e(Text, { dimColor: true, key: "extra" }, `  ... ${extra} modelos adicionais`),
      );
    }
  }

  // Modelo padrão
  if (defaultModel) {
    const srcColor =
      defaultModel.source === "config"
        ? "green"
        : defaultModel.source === "config-missing"
          ? "red"
          : "cyan";
    items.push(
      e(Box, { flexDirection: "row", marginTop: 1, key: "default" },
        e(Text, { bold: true }, "Padrão: "),
        e(Text, { color: srcColor }, defaultModel.path),
        e(Text, { dimColor: true }, `  [${defaultModel.source}]`),
      ),
    );
  } else {
    items.push(
      e(Text, { color: "yellow", marginTop: 1, key: "nodefault" }, "Modelo padrão não definido."),
    );
  }

  const borderColor = defaultModel ? "magenta" : "yellow";
  return e(Section, { title: "📦  Modelos .gguf", borderColor }, ...items);
}

function SectionLlama({ llamaBinary, endpoint, llamaCommand }) {
  const portColor =
    endpoint.status === "openai-compatible"
      ? "green"
      : endpoint.status === "occupied"
        ? "yellow"
        : "red";
  const portLabel =
    endpoint.status === "openai-compatible"
      ? "ativo (API compatível)"
      : endpoint.status === "occupied"
        ? "ocupada por outro processo"
        : "livre (servidor não iniciado)";

  const items = [
    e(
      Box,
      { flexDirection: "row", key: "bin" },
      e(Text, null, "Binário llama-server: "),
      llamaBinary.ok
        ? e(Text, { color: "green" }, llamaBinary.path)
        : e(Text, { color: "red" }, "não encontrado"),
      llamaBinary.source
        ? e(Text, { dimColor: true }, `  [${llamaBinary.source}]`)
        : null,
    ),
    e(Item, { label: "Endpoint", value: endpoint.baseUrl, key: "ep" }),
    e(
      Box,
      { flexDirection: "row", key: "port" },
      e(Text, null, `  Porta ${endpoint.port}: `),
      e(Text, { color: portColor }, portLabel),
    ),
  ];

  if (llamaCommand) {
    items.push(
      e(Box, { flexDirection: "column", marginTop: 1, key: "cmd" },
        e(Text, { bold: true }, "Comando sugerido:"),
        e(Text, { color: "yellow", wrap: "wrap" }, llamaCommand),
      ),
    );
  }

  const borderColor = llamaBinary.ok && endpoint.status === "openai-compatible"
    ? "green"
    : llamaBinary.ok
      ? "yellow"
      : "red";

  return e(Section, { title: "🦙  llama-server", borderColor }, ...items);
}

function SectionInputs({ inputs }) {
  const shown = inputs.slice(0, 8);
  const extra = inputs.length - shown.length;

  const items =
    inputs.length === 0
      ? [e(Text, { color: "yellow", key: "none" }, "Nenhum arquivo suportado em entrada/.")]
      : [
          ...shown.map((f) =>
            e(
              Box,
              { flexDirection: "row", key: f.name },
              e(Text, { color: "cyan" }, "  • "),
              e(Text, null, f.name),
              e(Text, { dimColor: true }, `  (${f.extension})`),
            ),
          ),
          ...(extra > 0
            ? [e(Text, { dimColor: true, key: "extra" }, `  ... ${extra} arquivos adicionais`)]
            : []),
        ];

  const borderColor = inputs.length > 0 ? "cyan" : "yellow";
  return e(
    Section,
    { title: `📂  Arquivos em entrada/ (${inputs.length})`, borderColor },
    ...items,
  );
}

function SectionActions({ actions }) {
  if (!actions.length) {
    return e(
      Section,
      { title: "✅  Próximas ações", borderColor: "green" },
      e(Text, { color: "green" }, "Ambiente pronto para executar o onboarding."),
    );
  }

  return e(
    Section,
    { title: "⚠  Próximas ações", borderColor: "yellow" },
    ...actions.map((action, i) =>
      e(
        Box,
        { flexDirection: "row", key: i },
        e(Text, { color: "yellow" }, `  ${i + 1}. `),
        e(Text, { wrap: "wrap" }, action),
      ),
    ),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────────────────────────────────────

export function DoctorView({ report }) {
  return e(
    Box,
    { flexDirection: "column" },
    e(
      Box,
      { marginBottom: 1 },
      e(Text, { bold: true, color: "whiteBright" }, "APDA Doctor  "),
      e(Text, { dimColor: true }, "— diagnóstico do ambiente"),
    ),
    e(SectionGeneral, { report }),
    e(SectionPython, { python: report.python }),
    e(SectionGpus, { gpus: report.gpus }),
    e(SectionModels, { models: report.models, defaultModel: report.defaultModel }),
    e(SectionLlama, {
      llamaBinary: report.llamaBinary,
      endpoint: report.endpoint,
      llamaCommand: report.llamaCommand,
    }),
    e(SectionInputs, { inputs: report.inputs }),
    e(SectionActions, { actions: report.actions }),
  );
}

export default DoctorView;
