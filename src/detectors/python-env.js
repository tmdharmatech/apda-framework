import { existsSync } from "node:fs";
import path from "node:path";
import { runCommand } from "../lib/command.js";

const REQUIRED_SCRIPTS = [
  "scripts/01_extrair_texto.py",
  "scripts/04_privacy_filter_anonimizar.py",
  "scripts/05_gerar_artefato_3b.py",
];

const REQUIRED_MODULES = [
  { module: "docx", packageName: "python-docx" },
  { module: "fitz", packageName: "PyMuPDF" },
  { module: "pandas", packageName: "pandas" },
  { module: "torch", packageName: "torch" },
  { module: "transformers", packageName: "transformers" },
];

async function checkPythonModules(command) {
  const script = `
import importlib.util, json
mods = ${JSON.stringify(REQUIRED_MODULES.map((item) => item.module))}
print(json.dumps({m: importlib.util.find_spec(m) is not None for m in mods}))
`;
  const result = await runCommand(command, ["-c", script]);
  if (!result.ok) {
    return REQUIRED_MODULES.map((item) => ({ ...item, ok: false }));
  }
  const found = JSON.parse(result.stdout);
  return REQUIRED_MODULES.map((item) => ({ ...item, ok: Boolean(found[item.module]) }));
}

export async function detectPython(root) {
  const venvPython = path.join(root, ".venv", "bin", "python");
  const candidates = [venvPython, "python3", "python"];
  for (const command of candidates) {
    const result = await runCommand(command, ["--version"]);
    if (result.ok) {
      const modules = await checkPythonModules(command);
      return {
        ok: true,
        command,
        version: `${result.stdout}${result.stderr}`.trim(),
        scriptsOk: REQUIRED_SCRIPTS.every((script) => existsSync(path.join(root, script))),
        scripts: REQUIRED_SCRIPTS.map((script) => ({
          path: script,
          ok: existsSync(path.join(root, script)),
        })),
        modules,
        modulesOk: modules.every((item) => item.ok),
      };
    }
  }
  const scripts = REQUIRED_SCRIPTS.map((script) => ({
    path: script,
    ok: existsSync(path.join(root, script)),
  }));
  return {
    ok: false,
    command: null,
    version: null,
    scriptsOk: scripts.every((script) => script.ok),
    scripts,
    modules: REQUIRED_MODULES.map((item) => ({ ...item, ok: false })),
    modulesOk: false,
  };
}
