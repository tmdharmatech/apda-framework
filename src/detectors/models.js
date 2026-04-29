import { readdir, stat } from "node:fs/promises";
import { existsSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const DEFAULT_DIRS = ["modelos", "models", path.join(os.homedir(), "models")];

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return "tamanho desconhecido";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`;
}

async function walk(dir, output) {
  if (!existsSync(dir)) return;
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(fullPath, output);
    } else if (entry.isFile() && entry.name.toLowerCase().endsWith(".gguf")) {
      const info = await stat(fullPath);
      output.push({
        name: entry.name,
        path: fullPath,
        size: info.size,
        sizeLabel: formatBytes(info.size),
      });
    }
  }
}

export async function findModels(root, extraDirs = []) {
  const output = [];
  const dirs = [...DEFAULT_DIRS.map((dir) => (path.isAbsolute(dir) ? dir : path.join(root, dir))), ...extraDirs];
  for (const dir of dirs) await walk(dir, output);
  return output.sort((a, b) => a.name.localeCompare(b.name));
}
