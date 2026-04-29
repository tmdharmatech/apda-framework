import test from "node:test";
import assert from "node:assert/strict";
import { buildLlamaServerArgs, formatLlamaServerCommand } from "../src/runners/llama-server-process.js";

test("buildLlamaServerArgs derives port from base URL", () => {
  assert.deepEqual(
    buildLlamaServerArgs({
      modelPath: "/models/qwen.gguf",
      baseUrl: "http://127.0.0.1:8091",
      ngl: 99,
    }),
    ["-m", "/models/qwen.gguf", "--port", "8091", "-ngl", "99"],
  );
});

test("formatLlamaServerCommand quotes paths with spaces or parentheses", () => {
  const command = formatLlamaServerCommand("/opt/llama-server", [
    "-m",
    "/tmp/Modelo Teste(1).gguf",
    "--port",
    "8091",
  ]);
  assert.equal(command, '/opt/llama-server -m "/tmp/Modelo Teste(1).gguf" --port 8091');
});
