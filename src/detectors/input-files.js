import { readdir, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

export const SUPPORTED_EXTENSIONS = new Set([".docx", ".xlsx", ".xls", ".pdf", ".txt", ".json"]);

export async function findInputFiles(root, inputDir = "entrada") {
  const dir = path.isAbsolute(inputDir) ? inputDir : path.join(root, inputDir);
  if (!existsSync(dir)) return [];
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (!entry.isFile()) continue;
    const fullPath = path.join(dir, entry.name);
    const extension = path.extname(entry.name).toLowerCase();
    if (!SUPPORTED_EXTENSIONS.has(extension)) continue;
    const info = await stat(fullPath);
    files.push({ name: entry.name, path: fullPath, extension, size: info.size });
  }
  return files.sort((a, b) => a.name.localeCompare(b.name));
}
