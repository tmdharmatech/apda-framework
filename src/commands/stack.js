import { runStackCommand } from "../stack.js";

export const stackCommand = {
  name: "stack",
  aliases: [],
  group: "Stack de Observabilidade",
  description: "gerencia LiteLLM, Prometheus, Grafana e metricas",
  usage: "apda stack <status|start|stop|logs>",
  examples: [
    { command: "apda stack status", description: "mostra o estado de todos os servicos" },
    { command: "apda stack status --json", description: "emite o estado em JSON" },
    { command: "apda stack start", description: "inicia o stack de observabilidade" },
    { command: "apda stack stop", description: "encerra todo o stack" },
    { command: "apda stack logs", description: "exibe ultimas linhas do log do LiteLLM" },
    { command: "apda stack logs litellm", description: "log de um servico especifico" },
  ],
  async handler({ root, argv }) {
    return runStackCommand(root, argv);
  },
};
