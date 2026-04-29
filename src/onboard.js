import { confirm, input, select } from "@inquirer/prompts";
import { detectGpus } from "./detectors/gpu.js";
import { findModels } from "./detectors/models.js";
import { findInputFiles } from "./detectors/input-files.js";
import { findLlamaServerBinary } from "./detectors/llama-binary.js";
import { checkLlamaServer } from "./detectors/llama-server.js";
import { getWorkflowsForFile } from "./workflows/registry.js";
import { runWorkflow } from "./workflows/run-workflow.js";
import { mergeConfig, readConfig } from "./lib/config.js";
import { buildLlamaServerArgs, formatLlamaServerCommand, startLlamaServer } from "./runners/llama-server-process.js";

function choices(items, mapper) {
  return items.map((item) => {
    const mapped = mapper(item);
    return { ...mapped, value: item };
  });
}

function defaultIndex(items, predicate) {
  const index = items.findIndex(predicate);
  return index >= 0 ? index : 0;
}

export async function runOnboarding(root, options = {}) {
  const config = await readConfig(root);
  let managedServer = null;
  console.log("APDA onboarding\n");

  const gpus = await detectGpus();
  const gpu = await select({
    message: "Selecione a GPU para o teste",
    choices: choices(gpus, (item) => ({ name: item.label })),
    default: gpus[defaultIndex(gpus, (item) => item.name === config.gpuName)],
  });

  const models = await findModels(root);
  let model = null;
  if (models.length) {
    model = await select({
      message: "Selecione o modelo .gguf",
      choices: choices(models, (item) => ({ name: `${item.name} (${item.sizeLabel})`, description: item.path })),
      default: models[defaultIndex(models, (item) => item.path === config.modelPath)],
    });
  } else {
    console.log("Nenhum modelo .gguf encontrado. O fluxo ainda pode usar um llama-server ja iniciado.");
  }

  const files = await findInputFiles(root);
  if (!files.length) throw new Error("Nenhum arquivo suportado encontrado em entrada/.");
  const selectedInput = await select({
    message: "Selecione o arquivo em entrada/",
    choices: choices(files, (item) => ({ name: `${item.name} (${item.extension})`, description: item.path })),
    default: files[defaultIndex(files, (item) => item.path === config.inputPath)],
  });

  const workflows = getWorkflowsForFile(selectedInput.path);
  if (!workflows.length) throw new Error("Nenhum workflow compativel para o arquivo selecionado.");
  const workflow = await select({
    message: "Selecione o workflow",
    choices: choices(workflows, (item) => ({ name: item.name, description: item.id })),
    default: workflows[defaultIndex(workflows, (item) => item.id === config.workflowId)],
  });

  const defaultBaseUrl = process.env.APDA_LLAMA_BASE_URL ?? config.llamaBaseUrl ?? "http://127.0.0.1:8091";
  const baseUrl = await input({
    message: "URL do llama-server",
    default: defaultBaseUrl,
  });

  let llama = await checkLlamaServer(baseUrl);
  let detectedLlamaBinary = config.llamaBinary ?? null;
  console.log(`\nllama-server: ${llama.ok ? "ok" : "indisponivel"} (${baseUrl})`);
  if (!llama.ok) {
    const binary = await findLlamaServerBinary(config);
    if (binary.ok) detectedLlamaBinary = binary.path;
    const ngl = config.ngl ?? 99;
    const command = binary.ok && model
      ? formatLlamaServerCommand(binary.path, buildLlamaServerArgs({ modelPath: model.path, baseUrl, ngl }))
      : null;

    if (!binary.ok) {
      console.log("Binario llama-server nao encontrado. Instale ou informe o caminho no config.");
    }
    if (model) {
      console.log(`Comando sugerido: ${command ?? `llama-server -m "${model.path}" --port 8091 -ngl 99`}`);
    }

    const serverAction = await select({
      message: "Como deseja prosseguir com o llama-server?",
      choices: [
        {
          name: "Subir automaticamente e encerrar ao final",
          value: "auto",
          disabled: !binary.ok || !model ? "requer binario llama-server e modelo .gguf" : false,
        },
        { name: "Mostrar comando e continuar em dry-run", value: "dry-run" },
        { name: "Continuar sem subir servidor", value: "manual" },
      ],
      default: binary.ok && model ? "auto" : "dry-run",
    });

    if (serverAction === "auto") {
      console.log("Subindo llama-server...");
      managedServer = await startLlamaServer({
        binary: binary.path,
        modelPath: model.path,
        baseUrl,
        ngl,
        cwd: root,
      });
      console.log(`llama-server pronto: ${baseUrl}`);
      llama = await checkLlamaServer(baseUrl);
    } else if (serverAction === "dry-run") {
      options.dryRun = true;
    }
  }

  await mergeConfig(root, {
    gpuKind: gpu.kind,
    gpuName: gpu.name,
    modelPath: model?.path ?? null,
    inputPath: selectedInput.path,
    workflowId: workflow.id,
    llamaBaseUrl: baseUrl,
    llamaBinary: detectedLlamaBinary,
    ngl: config.ngl ?? 99,
  });

  const dryRun = options.dryRun ?? (await confirm({ message: "Executar em modo dry-run?", default: !llama.ok }));
  const shouldRun = await confirm({
    message: dryRun ? "Mostrar plano de execucao agora?" : "Executar workflow agora?",
    default: true,
  });

  if (!shouldRun) {
    const dryRunFlag = dryRun ? " --dry-run" : "";
    console.log(`Comando equivalente:\napda run --file "${selectedInput.path}" --workflow ${workflow.id} --base-url ${baseUrl}${dryRunFlag}`);
    return;
  }

  try {
    await runWorkflow(root, workflow.id, selectedInput.path, { baseUrl, dryRun });
  } finally {
    if (managedServer) {
      const shouldStop = await confirm({
        message: "Encerrar llama-server iniciado pelo onboarding?",
        default: true,
      });
      if (shouldStop) await managedServer.stop();
      else console.log("llama-server mantido em execucao.");
    }
  }
}
