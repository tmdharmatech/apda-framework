import { startWebServer } from "../web.js";
import { parseCommandArgs } from "./helpers.js";

export const webCommand = {
  name: "web",
  aliases: [],
  group: "Interface Web",
  description: "inicia o servidor web",
  usage: "apda web [--port <porta>] [--no-open]",
  examples: [
    { command: "apda web", description: "inicia o servidor web na porta 3000" },
    { command: "apda web --port 8090", description: "inicia na porta especificada" },
  ],
  options: {
    port: { type: "string" },
    "no-open": { type: "boolean" },
  },
  async handler({ root, argv }) {
    const { values } = parseCommandArgs(this, argv);
    const port = values.port ? Number(values.port) : 3000;
    return startWebServer(root, { port, open: !values["no-open"] });
  },
};
