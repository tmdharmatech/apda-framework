/**
 * ListViews — componentes de listagem simples para GPU, modelos e arquivos de entrada.
 *
 * Usa React.createElement (sem JSX) para compatibilidade com ESM puro / Node >= 20
 * sem transpilador Babel.
 */

import React from "react";
import { Box, Text } from "ink";

const e = React.createElement;

// ─────────────────────────────────────────────────────────────────────────────
// GpuList
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GpuList({ gpus })
 *
 * `gpus` é um array de objetos com pelo menos `{ label }`.
 * Exibe cada GPU numerada com índice colorido em ciano.
 */
export function GpuList({ gpus }) {
  if (!gpus || gpus.length === 0) {
    return e(
      Box,
      { paddingY: 1 },
      e(Text, { color: "yellow" }, "Nenhuma GPU detectada — CPU está disponível como fallback."),
    );
  }

  return e(
    Box,
    { flexDirection: "column" },
    ...gpus.map((gpu, i) =>
      e(
        Box,
        { flexDirection: "row", key: `gpu-${i}` },
        e(Text, { color: "cyan", bold: true }, `${i + 1}. `),
        e(Text, null, gpu.label),
      ),
    ),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ModelList
// ─────────────────────────────────────────────────────────────────────────────

/**
 * ModelList({ models })
 *
 * `models` é um array de objetos com `{ name, path, sizeLabel }`.
 * Exibe nome em branco, path em dim e sizeLabel em magenta.
 */
export function ModelList({ models }) {
  if (!models || models.length === 0) {
    return e(
      Box,
      { paddingY: 1 },
      e(Text, { color: "yellow" }, "Nenhum modelo .gguf encontrado em modelos/."),
    );
  }

  return e(
    Box,
    { flexDirection: "column" },
    ...models.map((model, i) =>
      e(
        Box,
        { flexDirection: "column", key: `model-${i}`, marginBottom: 0 },
        e(
          Box,
          { flexDirection: "row" },
          e(Text, { color: "magenta", bold: true }, `${i + 1}. `),
          e(Text, { bold: true }, model.name),
          e(Text, { color: "magenta" }, `  (${model.sizeLabel})`),
        ),
        model.path
          ? e(
              Box,
              { flexDirection: "row", paddingLeft: 3 },
              e(Text, { dimColor: true }, model.path),
            )
          : null,
      ),
    ),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// InputList
// ─────────────────────────────────────────────────────────────────────────────

/**
 * InputList({ inputs })
 *
 * `inputs` é um array de objetos com `{ name, extension, path? }`.
 * Exibe nome do arquivo e extensão com cor semântica.
 */
export function InputList({ inputs }) {
  if (!inputs || inputs.length === 0) {
    return e(
      Box,
      { paddingY: 1 },
      e(Text, { color: "yellow" }, "Nenhum arquivo suportado encontrado em entrada/."),
    );
  }

  const extColor = (ext) => {
    switch (ext?.toLowerCase()) {
      case ".pdf":   return "red";
      case ".docx":
      case ".doc":   return "blue";
      case ".txt":   return "white";
      case ".json":  return "green";
      default:       return "cyan";
    }
  };

  return e(
    Box,
    { flexDirection: "column" },
    ...inputs.map((input, i) =>
      e(
        Box,
        { flexDirection: "row", key: `input-${i}` },
        e(Text, { color: "cyan" }, `${i + 1}. `),
        e(Text, null, input.name),
        e(Text, { color: extColor(input.extension), bold: true }, `  ${input.extension}`),
      ),
    ),
  );
}
