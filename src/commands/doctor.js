import { runDoctor } from "../doctor.js";
import { parseCommandArgs } from "./helpers.js";

export const doctorCommand = {
  name: "doctor",
  aliases: [],
  group: "Diagnostico",
  description: "mostra relatorio do ambiente",
  usage: "apda doctor [--json]",
  examples: [
    { command: "apda doctor", description: "mostra relatorio visual do ambiente" },
    { command: "apda doctor --json", description: "emite o relatorio em JSON puro" },
  ],
  options: { json: { type: "boolean" } },
  async handler({ root, argv }) {
    const { values } = parseCommandArgs(this, argv);
    return runDoctor(root, { json: values.json });
  },
};
