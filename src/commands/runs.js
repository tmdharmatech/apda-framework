import { runRunsCommand } from "../runs.js";

export const runsCommand = {
  name: "runs",
  aliases: [],
  group: "Execucao",
  description: "lista e detalha execucoes anteriores",
  usage: "apda runs [show <id>]",
  examples: [
    { command: "apda runs", description: "lista as ultimas 20 execucoes" },
    { command: "apda runs show <id>", description: "detalha uma execucao especifica" },
  ],
  async handler({ root, argv }) {
    return runRunsCommand(root, argv);
  },
};
