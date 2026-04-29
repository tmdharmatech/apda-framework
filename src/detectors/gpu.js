import { commandExists, runCommand } from "../lib/command.js";

function parseNvidia(output) {
  return output
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((line) => {
      const [name, memoryMiB] = line.split(",").map((part) => part.trim());
      return {
        kind: "nvidia",
        name,
        memoryMiB: Number(memoryMiB),
        label: `NVIDIA: ${name}${memoryMiB ? ` (${memoryMiB} MiB)` : ""}`,
      };
    });
}

export async function detectGpus() {
  const gpus = [];

  if (await commandExists("nvidia-smi")) {
    const result = await runCommand("nvidia-smi", [
      "--query-gpu=name,memory.total",
      "--format=csv,noheader,nounits",
    ]);
    if (result.ok) gpus.push(...parseNvidia(result.stdout));
  }

  if (await commandExists("rocminfo")) {
    const result = await runCommand("sh", ["-lc", "rocminfo | awk '/Marketing Name/ {print $0}' | head -8"]);
    if (result.ok && result.stdout.trim()) {
      for (const line of result.stdout.trim().split("\n")) {
        const name = line.split(":").pop()?.trim() || "AMD ROCm";
        gpus.push({ kind: "amd-rocm", name, label: `AMD/ROCm: ${name}` });
      }
    }
  }

  if (await commandExists("vulkaninfo")) {
    const result = await runCommand("sh", ["-lc", "vulkaninfo --summary 2>/dev/null | awk -F= '/deviceName/ {print $2}' | head -8"]);
    if (result.ok && result.stdout.trim()) {
      for (const name of result.stdout.trim().split("\n").map((line) => line.trim()).filter(Boolean)) {
        if (/llvmpipe|software/i.test(name)) continue;
        if (!gpus.some((gpu) => gpu.name === name)) {
          gpus.push({ kind: "vulkan", name, label: `Vulkan: ${name}` });
        }
      }
    }
  }

  if (!gpus.length) {
    gpus.push({ kind: "cpu", name: "CPU", label: "CPU fallback (nenhuma GPU detectada por nvidia-smi/rocminfo/vulkaninfo)" });
  }

  return gpus;
}
