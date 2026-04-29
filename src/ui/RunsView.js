/**
 * RunsView — tabela de execuções passadas do APDA.
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

const COL_ID       = 36; // UUID completo
const COL_STATUS   = 10;
const COL_WORKFLOW = 28;
const COL_ELAPSED  = 12;

/**
 * Trunca / padeia uma string para exatamente `width` caracteres.
 * Trunca com "…" se necessário.
 */
function fit(str, width) {
  const s = String(str ?? "—");
  if (s.length > width) return `${s.slice(0, width - 1)}…`;
  return s.padEnd(width);
}

/** Cor semântica para o campo status. */
function statusColor(status) {
  switch (status) {
    case "ok":
    case "done":
    case "success":    return "green";
    case "error":
    case "failed":     return "red";
    case "dry-run":    return "yellow";
    case "running":    return "cyan";
    default:           return "white";
  }
}

/** Formata duração em ms de forma legível. */
function formatElapsed(ms) {
  if (ms == null) return "em andamento";
  if (ms < 1000)  return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Sub-componentes
// ─────────────────────────────────────────────────────────────────────────────

/** Cabeçalho da tabela. */
function TableHeader() {
  return e(
    Box,
    { flexDirection: "row" },
    e(Text, { bold: true, color: "whiteBright" }, fit("ID", COL_ID)),
    e(Text, { bold: true, color: "whiteBright" }, "  "),
    e(Text, { bold: true, color: "whiteBright" }, fit("Status", COL_STATUS)),
    e(Text, { bold: true, color: "whiteBright" }, "  "),
    e(Text, { bold: true, color: "whiteBright" }, fit("Workflow", COL_WORKFLOW)),
    e(Text, { bold: true, color: "whiteBright" }, "  "),
    e(Text, { bold: true, color: "whiteBright" }, fit("Duração", COL_ELAPSED)),
  );
}

/** Linha separadora. */
function TableSep() {
  const total = COL_ID + COL_STATUS + COL_WORKFLOW + COL_ELAPSED + 6; // 3 × "  "
  return e(Text, { dimColor: true }, "─".repeat(total));
}

/** Uma linha da tabela. */
function TableRow({ record }) {
  const color = statusColor(record.status);
  return e(
    Box,
    { flexDirection: "row" },
    e(Text, { dimColor: true }, fit(record.id, COL_ID)),
    e(Text, null, "  "),
    e(Text, { color }, fit(record.status, COL_STATUS)),
    e(Text, null, "  "),
    e(Text, null, fit(record.workflowId ?? record.workflowName, COL_WORKFLOW)),
    e(Text, null, "  "),
    e(Text, { dimColor: true }, fit(formatElapsed(record.elapsedMs), COL_ELAPSED)),
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────────────────────────────────────

/**
 * RunsView({ records })
 *
 * `records` é o array retornado por `listRunRecords(root)` (já ordenado por data desc).
 *
 * - Exibe mensagem em amarelo se vazio.
 * - Renderiza cabeçalho + separador + até 20 linhas.
 * - Rodapé indica quantas execuções adicionais existem além das 20 exibidas.
 */
export function RunsView({ records }) {
  if (!records || records.length === 0) {
    return e(
      Box,
      { paddingY: 1 },
      e(Text, { color: "yellow" }, "Nenhuma execução registrada."),
    );
  }

  const shown = records.slice(0, 20);
  const extra = records.length - shown.length;

  return e(
    Box,
    { flexDirection: "column" },

    // Cabeçalho
    e(TableHeader),
    e(TableSep),

    // Linhas
    ...shown.map((record) =>
      e(TableRow, { record, key: record.id }),
    ),

    // Separador inferior e rodapé
    e(TableSep),

    // Rodapé com contagem total
    extra > 0
      ? e(
          Box,
          { marginTop: 1 },
          e(Text, { dimColor: true }, `Mostrando 20 de ${records.length} execuções.  `),
          e(Text, { color: "yellow" }, `${extra} registro(s) adicional(ais) não exibido(s).`),
        )
      : e(
          Box,
          { marginTop: 1 },
          e(Text, { dimColor: true }, `${records.length} execução(ões) no total.`),
        ),
  );
}

export default RunsView;
