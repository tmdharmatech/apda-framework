import { getWorkflowsForFile, listWorkflows } from "../workflows/registry.js";
import { WorkflowList } from "../ui/WorkflowList.js";
import { parseCommandArgs, renderComponent } from "./helpers.js";

export const workflowsCommand = {
  name: "workflows",
  aliases: ["workflow-list"],
  group: "Utilitarios",
  description: "lista workflows disponiveis",
  usage: "apda workflows [--file <arquivo>]",
  examples: [
    { command: "apda workflows", description: "lista todos os workflows disponiveis" },
    {
      command: "apda workflows --file entrada/doc.docx",
      description: "filtra workflows compativeis com o arquivo",
    },
  ],
  options: { file: { type: "string", short: "f" } },
  async handler({ argv }) {
    const { values } = parseCommandArgs(this, argv, { allowPositionals: true });
    const workflows = values.file
      ? getWorkflowsForFile(values.file)
      : listWorkflows();
    return renderComponent(WorkflowList, { workflows });
  },
};
