import { findModels } from "../detectors/models.js";
import { ModelList } from "../ui/ListViews.js";
import { renderComponent } from "./helpers.js";

export const listModelsCommand = {
  name: "list-models",
  aliases: ["models"],
  group: "Utilitarios",
  description: "lista modelos .gguf em modelos/",
  usage: "apda list-models",
  examples: [
    { command: "apda list-models", description: "lista modelos .gguf em modelos/" },
  ],
  async handler({ root }) {
    const models = await findModels(root);
    return renderComponent(ModelList, { models });
  },
};
