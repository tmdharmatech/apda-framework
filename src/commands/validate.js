import { validateArtifactFile } from "../schema/validate.js";
import { parseCommandArgs } from "./helpers.js";

export const validateCommand = {
  name: "validate",
  aliases: [],
  group: "Utilitarios",
  description: "valida artefato contra o schema APDA",
  usage: "apda validate <arquivo.json> [--json]",
  examples: [
    {
      command: "apda validate saida/artefato.json",
      description: "valida artefato contra o schema APDA",
    },
    {
      command: "apda validate saida/artefato.json --json",
      description: "resultado da validacao em JSON",
    },
  ],
  options: { json: { type: "boolean" } },
  async handler({ root, argv }) {
    const { values, positionals } = parseCommandArgs(this, argv, {
      allowPositionals: true,
    });
    const file = positionals[0];
    if (!file) throw new Error("Uso: apda validate <arquivo.json> [--json]");

    const result = await validateArtifactFile(root, file);
    if (values.json) {
      console.log(JSON.stringify(result, null, 2));
      if (!result.ok) process.exitCode = 1;
      return;
    }

    if (result.ok) {
      console.log(`OK: ${result.file}`);
      return;
    }

    console.error(`ERRO: ${result.file}`);
    for (const error of result.errors) console.error(`- ${error}`);
    process.exitCode = 1;
  },
};
