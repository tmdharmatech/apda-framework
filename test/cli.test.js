import test from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";

const fixturePath = "entrada/arquivo_teste.docx";

function runCli(args) {
  return spawnSync(process.execPath, ["src/cli.js", ...args], {
    cwd: process.cwd(),
    encoding: "utf8",
  });
}

async function withInputFixture(fn) {
  await mkdir("entrada", { recursive: true });
  await writeFile(fixturePath, "fixture");
  try {
    await fn();
  } finally {
    await rm(fixturePath, { force: true });
  }
}

test("CLI dry-run prints planned extraction command without running heavy steps", async () => {
  await withInputFixture(() => {
    const result = runCli([
      "run",
      "--file",
      fixturePath,
      "--workflow",
      "docx-to-text",
      "--dry-run",
    ]);
    assert.equal(result.status, 0, result.stderr);
    assert.match(result.stdout, /scripts\/01_extrair_texto\.py/);
    assert.match(result.stdout, /arquivo_teste\.texto_extraido\.txt/);
  });
});

test("CLI rejects incompatible workflow and extension", async () => {
  await withInputFixture(() => {
    const result = runCli([
      "run",
      "--file",
      fixturePath,
      "--workflow",
      "validate-apda-json",
    ]);
    assert.notEqual(result.status, 0);
    assert.match(result.stderr, /nao aceita arquivos \.docx/);
  });
});
