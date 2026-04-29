import React from "react";
import { Box, Text } from "ink";

const e = React.createElement;

export function WorkflowList({ workflows }) {
  if (!workflows || workflows.length === 0) {
    return e(Text, { color: "yellow" }, "Nenhum workflow compatível encontrado.");
  }
  return e(
    Box,
    { flexDirection: "column" },
    ...workflows.map((w) =>
      e(
        Box,
        { key: w.id, flexDirection: "row", gap: 1 },
        e(Text, { color: "cyan", bold: true }, w.id + ":"),
        e(Text, null, w.name),
      ),
    ),
  );
}

export default WorkflowList;
