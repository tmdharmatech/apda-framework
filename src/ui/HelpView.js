import React from "react";
import { Box, Text } from "ink";
import { listCommands } from "../commands/registry.js";

const e = React.createElement;

function groupCommands(commands) {
  const groups = new Map();
  for (const command of commands) {
    const group = command.group ?? "Comandos";
    if (!groups.has(group)) groups.set(group, []);
    groups.get(group).push(command);
  }
  return groups;
}

function CommandExample({ example }) {
  return e(
    Box,
    { flexDirection: "column", marginBottom: 0 },
    e(Text, { color: "green" }, `  ${example.command}`),
    example.description
      ? e(Text, { dimColor: true }, `    ${example.description}`)
      : null,
  );
}

function CommandGroup({ title, commands }) {
  return e(
    Box,
    { flexDirection: "column", marginBottom: 1 },
    e(Text, { color: "cyan", bold: true }, title),
    commands.flatMap((command) => {
      const examples = command.examples?.length
        ? command.examples
        : [{ command: command.usage ?? `apda ${command.name}`, description: command.description }];
      return examples.map((example) =>
        e(CommandExample, { key: `${command.name}:${example.command}`, example }),
      );
    }),
  );
}

export function HelpView({ commands = listCommands() }) {
  const groups = groupCommands(commands);

  return e(
    Box,
    {
      flexDirection: "column",
      borderStyle: "round",
      borderColor: "cyan",
      paddingX: 2,
      paddingY: 1,
    },
    e(
      Box,
      { flexDirection: "row", marginBottom: 1 },
      e(Text, { bold: true, color: "whiteBright" }, "APDA CLI  "),
      e(Text, { dimColor: true }, "- comandos disponiveis"),
    ),
    e(Text, { dimColor: true }, "-".repeat(60)),
    e(Box, { height: 1 }),
    [...groups.entries()].map(([title, groupCommands]) =>
      e(CommandGroup, { key: title, title, commands: groupCommands }),
    ),
    e(Text, { dimColor: true }, "-".repeat(60)),
    e(Text, { dimColor: true, marginTop: 1 }, "Dica: apda doctor e o ponto de partida para diagnosticar problemas no ambiente."),
  );
}

export default HelpView;
