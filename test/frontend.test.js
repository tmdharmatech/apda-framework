import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const FRONTEND = path.join(process.cwd(), "frontend");
const TEXT_EXTENSIONS = new Set([".css", ".html", ".js", ".json"]);
const MOJIBAKE_PATTERNS = [
  /Ã/,
  /â[€†œ”š€¦„‘’‹º]/,
  /ðŸ/,
  /Â[· ]/,
];

async function listFrontendTextFiles(dir = FRONTEND) {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    const entryPath = path.join(dir, entry.name);
    if (entry.isDirectory()) return listFrontendTextFiles(entryPath);
    return TEXT_EXTENSIONS.has(path.extname(entry.name)) ? [entryPath] : [];
  }));
  return files.flat();
}

test("frontend pages load page modules instead of inline scripts", async () => {
  const files = (await readdir(FRONTEND))
    .filter((file) => file.endsWith(".html"))
    .sort();

  assert.ok(files.length > 0);

  for (const file of files) {
    const html = await readFile(path.join(FRONTEND, file), "utf8");
    assert.doesNotMatch(html, /<script>\s*\S/);
    assert.match(html, /<script type="module" src="\/pages\/.+\.js"><\/script>/);
    assert.match(html, /<script src="\/nav\.js"><\/script>/);
  }
});

test("frontend page modules use shared API and DOM helpers", async () => {
  const pageDir = path.join(FRONTEND, "pages");
  const files = (await readdir(pageDir))
    .filter((file) => file.endsWith(".js"))
    .sort();

  assert.ok(files.length > 0);

  for (const file of files) {
    const js = await readFile(path.join(pageDir, file), "utf8");
    assert.match(js, /from "\.\.\/lib\/api\.js"/);
    assert.match(js, /from "\.\.\/lib\/dom\.js"/);
    assert.doesNotMatch(js, /function esc\(/);
    assert.doesNotMatch(js, /fetch\(/);
  }
});

test("frontend text assets do not contain mojibake markers", async () => {
  const files = await listFrontendTextFiles();

  assert.ok(files.length > 0);

  for (const file of files) {
    const text = await readFile(file, "utf8");
    for (const pattern of MOJIBAKE_PATTERNS) {
      assert.doesNotMatch(text, pattern, path.relative(process.cwd(), file));
    }
  }
});
