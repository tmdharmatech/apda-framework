import { detectGpus } from "../detectors/gpu.js";
import { GpuList } from "../ui/ListViews.js";
import { renderComponent } from "./helpers.js";

export const listGpusCommand = {
  name: "list-gpus",
  aliases: ["gpus"],
  group: "Utilitarios",
  description: "lista GPUs detectadas no sistema",
  usage: "apda list-gpus",
  examples: [
    { command: "apda list-gpus", description: "lista GPUs detectadas no sistema" },
  ],
  async handler() {
    const gpus = await detectGpus();
    return renderComponent(GpuList, { gpus });
  },
};
