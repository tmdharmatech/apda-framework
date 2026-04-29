import { spawn } from "node:child_process";

export function runCommand(command, args, options = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: { ...process.env, ...options.env },
      stdio: options.stdio ?? ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    if (child.stdout) child.stdout.on("data", (chunk) => (stdout += chunk));
    if (child.stderr) child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("error", (error) => resolve({ ok: false, code: null, stdout, stderr: String(error.message) }));
    child.on("close", (code) => resolve({ ok: code === 0, code, stdout, stderr }));
  });
}

export async function commandExists(command) {
  const result = await runCommand("sh", ["-lc", `command -v ${command}`]);
  return result.ok;
}
