import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";

export async function handleBenchmarks(root, _req, res) {
  const filePath = path.join(root, "benchmarks", "benchmarks.json");
  if (!existsSync(filePath)) {
    res.status(404).json({ error: "benchmarks/benchmarks.json nao encontrado." });
    return;
  }
  const raw = await readFile(filePath, "utf8");
  res.json(JSON.parse(raw));
}
