import React from "react";
import { render } from "ink";
import { parseArgs } from "node:util";

export function parseCommandArgs(command, argv, options = {}) {
  return parseArgs({
    args: argv,
    options: command.options ?? {},
    allowPositionals: options.allowPositionals ?? false,
  });
}

export function renderInk(element) {
  const { waitUntilExit } = render(element);
  return waitUntilExit();
}

export function renderComponent(Component, props = {}) {
  return renderInk(React.createElement(Component, props));
}

export function handleCliError(error) {
  console.error(error.message);
  process.exitCode = 1;
}
