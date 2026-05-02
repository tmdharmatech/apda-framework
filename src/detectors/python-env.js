import { existsSync } from "node:fs";
import path from "node:path";
import { runCommand } from "../lib/command.js";

const REQUIRED_SCRIPTS = [
  "scripts/01_extrair_texto.py",
  "scripts/02_anonimizar_texto.py",
  "scripts/04_privacy_filter_anonimizar.py",
  "scripts/05_gerar_artefato_3b.py",
];

/** Módulos exigidos por todos os workflows (fast, regex-anon, generate). */
const CORE_MODULES = [
  { module: "docx", packageName: "python-docx" },
  { module: "fitz", packageName: "PyMuPDF" },
  { module: "pandas", packageName: "pandas" },
];

/**
 * Módulos exigidos apenas pelo workflow privacy-filter.
 * Instalados via requirements-neural.txt (~2GB com GPU).
 */
const NEURAL_MODULES = [
  { module: "torch", packageName: "torch" },
  { module: "transformers", packageName: "transformers" },
];

const ALL_MODULES = [...CORE_MODULES, ...NEURAL_MODULES];

async function checkPythonModules(command) {
  const script = `
import importlib.util, json
mods = ${JSON.stringify(ALL_MODULES.map((item) => item.module))}
print(json.dumps({m: importlib.util.find_spec(m) is not None for m in mods}))
`;
  const result = await runCommand(command, ["-c", script]);
  if (!result.ok) {
    return ALL_MODULES.map((item) => ({ ...item, ok: false }));
  }
  const found = JSON.parse(result.stdout);
  return ALL_MODULES.map((item) => ({ ...item, ok: Boolean(found[item.module]) }));
}

export async function detectPython(root) {
  const venvPython = path.join(root, ".venv", "bin", "python");
  const candidates = [venvPython, "python3", "python"];
  for (const command of candidates) {
    const result = await runCommand(command, ["--version"]);
    if (result.ok) {
      const modules = await checkPythonModules(command);
      const coreModules  = modules.filter((m) => CORE_MODULES.some((c) => c.module === m.module));
      const neuralModules = modules.filter((m) => NEURAL_MODULES.some((n) => n.module === m.module));
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
        modulesOk: coreModules.every((item) => item.ok),
        coreModules,
        coreModulesOk: coreModules.every((item) => item.ok),
        neuralModules,
        neuralModulesOk: neuralModules.every((item) => item.ok),
      };
    }
  }
  const scripts = REQUIRED_SCRIPTS.map((script) => ({
    path: script,
    ok: existsSync(path.join(root, script)),
  }));
  const modules = ALL_MODULES.map((item) => ({ ...item, ok: false }));
  return {
    ok: false,
    command: null,
    version: null,
    scriptsOk: scripts.every((script) => script.ok),
    scripts,
    modules,
    modulesOk: false,
    coreModules: CORE_MODULES.map((item) => ({ ...item, ok: false })),
    coreModulesOk: false,
    neuralModules: NEURAL_MODULES.map((item) => ({ ...item, ok: false })),
    neuralModulesOk: false,
  };
}
