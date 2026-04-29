import { listRunRecords, readRunRecord } from "../runs.js";

export async function handleRuns(root, _req, res) {
  const records = await listRunRecords(root);
  res.json(records);
}

export async function handleRunById(root, req, res, id) {
  const record = await readRunRecord(root, id);
  if (!record) {
    res.status(404).json({ error: `Execucao nao encontrada: ${id}` });
    return;
  }
  res.json(record);
}
