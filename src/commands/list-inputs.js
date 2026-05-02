import { findInputFiles } from "../detectors/input-files.js";
import { InputList } from "../ui/ListViews.js";
import { renderComponent } from "./helpers.js";

export const listInputsCommand = {
  name: "list-inputs",
  aliases: ["inputs"],
  group: "Utilitarios",
  description: "lista arquivos suportados em entrada/",
  usage: "apda list-inputs",
  examples: [
    { command: "apda list-inputs", description: "lista arquivos suportados em entrada/" },
  ],
  async handler({ root }) {
    const inputs = await findInputFiles(root);
    return renderComponent(InputList, { inputs });
  },
};
