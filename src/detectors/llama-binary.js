import { existsSync } from "node:fs";
import path from "node:path";
import { runCommand } from "../lib/command.js";

const CANDIDATES = [
  "llama-server",
  "/home/eu/ai/llama.cpp/build-vulkan/bin/llama-server",
  "/home/eu/llama.cpp/build/bin/llama-server",
  "/home/eu/llama.cpp/build-vulkan/bin/llama-server",
];

export async function findLlamaServerBinary(config = {}) {
  if (config.llamaBinary && existsSync(config.llamaBinary)) {
    return { ok: true, path: config.llamaBinary, source: "config" };
  }

  const command = await runCommand("sh", ["-lc", "command -v llama-server"]);
  if (command.ok && command.stdout.trim()) {
    return { ok: true, path: command.stdout.trim().split("\n")[0], source: "path" };
  }

  for (const candidate of CANDIDATES.slice(1)) {
    if (existsSync(candidate)) return { ok: true, path: path.resolve(candidate), source: "known-path" };
  }

  const found = await runCommand("sh", [
    "-lc",
    "find /home/eu -type f -name 'llama-server' -perm -111 2>/dev/null | head -1",
  ]);
  const first = found.stdout.trim().split("\n").filter(Boolean)[0];
  if (first) return { ok: true, path: first, source: "find" };

  return { ok: false, path: null, source: "missing" };
}
