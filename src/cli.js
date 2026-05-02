#!/usr/bin/env node
import React from "react";
import { resolveCommand } from "./commands/registry.js";
import { handleCliError, renderInk } from "./commands/helpers.js";
import { resolveProjectRoot } from "./lib/paths.js";
import { HelpView } from "./ui/HelpView.js";

async function main() {
  const root = resolveProjectRoot();
  const commandName = process.argv[2] ?? "onboard";
  const argv = process.argv.slice(3);
  const command = resolveCommand(commandName);

  if (!command) {
    return renderInk(React.createElement(HelpView));
  }

  return command.handler({ root, argv, commandName });
}

main().catch(handleCliError);
