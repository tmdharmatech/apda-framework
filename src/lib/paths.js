import { existsSync } from "node:fs";
import path from "node:path";

export function resolveProjectRoot(start = process.cwd()) {
  let current = path.resolve(start);
  while (true) {
    if (
      existsSync(path.join(current, "scripts")) &&
      existsSync(path.join(current, "schemas", "artefato_pedagogico.schema.json"))
    ) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) return path.resolve(start);
    current = parent;
  }
}

export function toAbsolute(root, filePath) {
  return path.isAbsolute(filePath) ? filePath : path.join(root, filePath);
}

export function outputStem(filePath) {
  return path.basename(filePath, path.extname(filePath));
}
