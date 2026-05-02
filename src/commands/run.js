import { runWorkflow } from "../workflows/run-workflow.js";
import { parseCommandArgs } from "./helpers.js";

export const runCommand = {
  name: "run",
  aliases: [],
  group: "Execucao",
  description: "executa um workflow num arquivo",
  usage: "apda run --file <entrada/arquivo> --workflow <id>",
  examples: [
    {
      command: "apda run --file entrada/doc.docx --workflow docx-to-apda-json",
      description: "executa um workflow num arquivo",
    },
    {
      command: "apda run --file ... --workflow ... --dry-run",
      description: "simula sem chamar o LLM",
    },
  ],
  options: {
    file: { type: "string", short: "f" },
    workflow: { type: "string", short: "w" },
    "base-url": { type: "string" },
    "dry-run": { type: "boolean" },
    litellm: { type: "boolean" },
  },
  async handler({ root, argv }) {
    const { values } = parseCommandArgs(this, argv);
    if (!values.file || !values.workflow)
      throw new Error("Uso: apda run --file <entrada/arquivo> --workflow <id>");

    return runWorkflow(root, values.workflow, values.file, {
      baseUrl: values["base-url"],
      dryRun: values["dry-run"],
      litellm: values.litellm,
    });
  },
};
