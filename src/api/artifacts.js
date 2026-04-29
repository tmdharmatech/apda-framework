import { existsSync } from "node:fs";
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";

export async function handleArtifacts(root, _req, res) {
  const saida = path.join(root, "saida");
  if (!existsSync(saida)) {
    res.json([]);
    return;
  }

  const entries = await readdir(saida, { withFileTypes: true });
  const jsonFiles = entries.filter(
    (e) => e.isFile() && e.name.endsWith(".apda.json"),
  );

  const artifacts = await Promise.all(
    jsonFiles.map(async (entry) => {
      const filePath = path.join(saida, entry.name);
      const relativePath = path.join("saida", entry.name);
      try {
        const [raw, info] = await Promise.all([
          readFile(filePath, "utf8"),
          stat(filePath),
        ]);
        const data = JSON.parse(raw);
        return {
          label: entry.name.replace(/\.apda\.json$/, ""),
          path: relativePath,
          modifiedAt: info.mtime.toISOString(),
          data,
        };
      } catch {
        return { label: entry.name, path: relativePath, modifiedAt: null, data: null };
      }
    }),
  );

  artifacts.sort((a, b) => String(b.modifiedAt).localeCompare(String(a.modifiedAt)));
  res.json(artifacts);
}
