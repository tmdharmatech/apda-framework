import { runOnboarding } from "../onboard.js";
import { parseCommandArgs } from "./helpers.js";

export const onboardCommand = {
  name: "onboard",
  aliases: [],
  group: "Onboarding interativo",
  description: "inicia o fluxo guiado de configuracao",
  usage: "apda onboard [--dry-run]",
  examples: [
    { command: "apda onboard", description: "inicia o fluxo guiado de configuracao" },
    { command: "apda onboard --dry-run", description: "simula o fluxo sem executar etapas reais" },
  ],
  options: { "dry-run": { type: "boolean" } },
  async handler({ root, argv }) {
    const { values } = parseCommandArgs(this, argv);
    return runOnboarding(root, { dryRun: values["dry-run"] });
  },
};
