import { runServerCommand } from "../server.js";

export const serverCommand = {
  name: "server",
  aliases: [],
  group: "Servidor LLM",
  description: "gerencia o llama-server local",
  usage: "apda server <status|start|stop|command>",
  examples: [
    { command: "apda server status", description: "verifica se o servidor esta ativo" },
    { command: "apda server start", description: "inicia o llama-server com a config salva" },
    { command: "apda server stop", description: "encerra o llama-server gerenciado" },
    { command: "apda server command", description: "exibe o comando equivalente sem executar" },
  ],
  async handler({ root, argv }) {
    return runServerCommand(root, argv);
  },
};
