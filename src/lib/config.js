import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";

const CONFIG_DIR = ".apda";
const CONFIG_FILE = "config.json";

export function configPath(root) {
  return path.join(root, CONFIG_DIR, CONFIG_FILE);
}

export async function readConfig(root) {
  const filePath = configPath(root);
  if (!existsSync(filePath)) return {};
  try {
    return JSON.parse(await readFile(filePath, "utf8"));
  } catch {
    return {};
  }
}

export async function writeConfig(root, config) {
  const dir = path.join(root, CONFIG_DIR);
  await mkdir(dir, { recursive: true });
  await writeFile(configPath(root), `${JSON.stringify(config, null, 2)}\n`, "utf8");
}

export async function mergeConfig(root, patch) {
  const current = await readConfig(root);
  const next = { ...current, ...patch, updatedAt: new Date().toISOString() };
  await writeConfig(root, next);
  return next;
}
