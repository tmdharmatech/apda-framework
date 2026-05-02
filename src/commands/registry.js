import { doctorCommand } from "./doctor.js";
import { listGpusCommand } from "./list-gpus.js";
import { listInputsCommand } from "./list-inputs.js";
import { listModelsCommand } from "./list-models.js";
import { onboardCommand } from "./onboard.js";
import { runCommand } from "./run.js";
import { runsCommand } from "./runs.js";
import { serverCommand } from "./server.js";
import { stackCommand } from "./stack.js";
import { validateCommand } from "./validate.js";
import { webCommand } from "./web.js";
import { workflowsCommand } from "./workflows.js";

export const COMMANDS = [
  doctorCommand,
  serverCommand,
  runCommand,
  runsCommand,
  listGpusCommand,
  listModelsCommand,
  listInputsCommand,
  workflowsCommand,
  validateCommand,
  stackCommand,
  webCommand,
  onboardCommand,
];

const COMMAND_INDEX = new Map();

for (const command of COMMANDS) {
  COMMAND_INDEX.set(command.name, command);
  for (const alias of command.aliases ?? []) {
    COMMAND_INDEX.set(alias, command);
  }
}

export function resolveCommand(name = "onboard") {
  return COMMAND_INDEX.get(name) ?? null;
}

export function listCommands() {
  return COMMANDS;
}
