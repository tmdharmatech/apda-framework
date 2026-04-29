import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { findInputFiles } from "../src/detectors/input-files.js";

test("findInputFiles returns supported files and ignores unsupported files", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "apda-inputs-"));
  const inputDir = path.join(root, "entrada");
  await writeFile(path.join(root, "placeholder"), "");
  await import("node:fs/promises").then((fs) => fs.mkdir(inputDir));
  await writeFile(path.join(inputDir, "documento_teste.docx"), "x");
  await writeFile(path.join(inputDir, "artefato.apda.json"), "{}");
  await writeFile(path.join(inputDir, "ignorar.md"), "# x");

  const files = await findInputFiles(root);
  assert.deepEqual(files.map((file) => file.name), [
    "artefato.apda.json",
    "documento_teste.docx",
  ]);
});
