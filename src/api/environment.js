import { detectGpus } from "../detectors/gpu.js";
import { findInputFiles } from "../detectors/input-files.js";
import { findModels } from "../detectors/models.js";

export async function handleGpus(_root, _req, res) {
  const gpus = await detectGpus();
  res.json(gpus);
}

export async function handleModels(root, _req, res) {
  const models = await findModels(root);
  res.json(models);
}

export async function handleInputs(root, _req, res) {
  const inputs = await findInputFiles(root);
  res.json(inputs);
}
