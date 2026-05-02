import test from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";

const FRONTEND = path.join(process.cwd(), "frontend");

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
