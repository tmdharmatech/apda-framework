import { getJSON, postJSON } from "../lib/api.js";
import { esc } from "../lib/dom.js";

/* â”€â”€ Estado global â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
const state = {
  step: 0,
  files: [],
  selectedFile: null,
  workflows: [],
  selectedWorkflow: null,
  serverUrl: "http://127.0.0.1:8091",
  dryRun: false,
  runId: null,
  sseSource: null,
  timerInterval: null,
  elapsed: 0,
};

/* â”€â”€ UtilitÃ¡rios â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
const STEP_LABELS = {
  "extract-text":      "Extraindo texto do arquivo",
  "privacy-filter":    "Aplicando Privacy Filter (PII)",
  "generate-artifact": "Gerando artefato JSON com LLM",
  "validate-schema":   "Validando schema APDA",
};

const STEP_ICONS = {
  "extract-text":      "ðŸ“„",
  "privacy-filter":    "ðŸ”’",
  "generate-artifact": "ðŸ¤–",
  "validate-schema":   "âœ…",
};

const EXT_CLASS = { ".docx":"docx", ".xlsx":"xlsx", ".xls":"xlsx", ".pdf":"pdf", ".txt":"txt", ".json":"json" };

function extClass(ext) { return EXT_CLASS[ext?.toLowerCase()] ?? ""; }

/* â”€â”€ Wizard â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function goTo(step) {
  state.step = step;
  document.querySelectorAll(".section").forEach((el, i) => {
    el.classList.toggle("visible", i === step);
  });
  document.querySelectorAll(".wstep").forEach((el, i) => {
    el.classList.remove("active", "done");
    if (i < step) el.classList.add("done");
    if (i === step) el.classList.add("active");
  });
  window.scrollTo({ top: 0, behavior: "smooth" });
}

/* â”€â”€ Passo 1: Arquivos â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
async function loadFiles() {
  document.getElementById("fileGrid").innerHTML = `<div class="empty">Carregando...</div>`;
  try {
    state.files = await getJSON("/api/inputs");
    renderFiles();
  } catch (e) {
    document.getElementById("fileGrid").innerHTML = `<div class="empty error-msg">Erro: ${esc(e.message)}</div>`;
  }
}

function renderFiles() {
  const q = document.getElementById("fileSearch").value.trim().toLowerCase();
  const items = q ? state.files.filter(f => f.name.toLowerCase().includes(q)) : state.files;
  if (!items.length) {
    document.getElementById("fileGrid").innerHTML = `<div class="empty">Nenhum arquivo encontrado em <code>entrada/</code>.</div>`;
    return;
  }
  document.getElementById("fileGrid").innerHTML = items.map(f => {
    const ext = f.extension?.replace(".", "") ?? "";
    const sel = state.selectedFile?.path === f.path ? " selected" : "";
    return `<button class="file-card${sel}" type="button" data-path="${esc(f.path)}">
      <div class="file-ext ${extClass(f.extension)}">${esc(ext || "?")}</div>
      <div class="file-name">${esc(f.name)}</div>
    </button>`;
  }).join("");
  document.getElementById("fileGrid").querySelectorAll(".file-card").forEach(card => {
    card.addEventListener("click", () => selectFile(card.dataset.path));
  });
}

async function selectFile(filePath) {
  state.selectedFile = state.files.find(f => f.path === filePath);
  if (!state.selectedFile) return;
  document.getElementById("selectedFilePill").textContent = state.selectedFile.name;
  await loadWorkflows(filePath);
  goTo(1);
}

/* â”€â”€ Passo 2: Workflows â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
async function loadWorkflows(filePath) {
  document.getElementById("workflowList").innerHTML = `<div class="empty">Carregando workflows...</div>`;
  try {
    state.workflows = await getJSON(`/api/workflows?file=${encodeURIComponent(filePath)}`);
    renderWorkflows();
  } catch (e) {
    document.getElementById("workflowList").innerHTML = `<div class="empty error-msg">Erro: ${esc(e.message)}</div>`;
  }
}

function renderWorkflows() {
  if (!state.workflows.length) {
    document.getElementById("workflowList").innerHTML = `<div class="empty">Nenhum workflow compatÃ­vel com este arquivo.</div>`;
    return;
  }
  document.getElementById("workflowList").innerHTML = state.workflows.map(wf => {
    const stepLabels = wf.steps.map(s => STEP_LABELS[s] ?? s).join(" â†’ ");
    const sel = state.selectedWorkflow?.id === wf.id ? " selected" : "";
    return `<button class="workflow-card${sel}" type="button" data-id="${esc(wf.id)}">
      <div class="workflow-info">
        <div class="workflow-name">${esc(wf.name)}</div>
        <div class="workflow-steps">${esc(stepLabels)}</div>
      </div>
      <div class="workflow-arrow">â€º</div>
    </button>`;
  }).join("");
  document.getElementById("workflowList").querySelectorAll(".workflow-card").forEach(card => {
    card.addEventListener("click", () => selectWorkflow(card.dataset.id));
  });
}

function selectWorkflow(workflowId) {
  state.selectedWorkflow = state.workflows.find(w => w.id === workflowId);
  if (!state.selectedWorkflow) return;
  renderConfig();
  goTo(2);
}

/* â”€â”€ Passo 3: Config â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function renderConfig() {
  const wf = state.selectedWorkflow;
  const needsServer = wf.steps.includes("generate-artifact");
  document.getElementById("serverUrlField").style.display = needsServer ? "" : "none";

  document.getElementById("configWorkflowSummary").innerHTML = `
    <div class="field-label">Workflow selecionado</div>
    <div class="field-value" style="margin-top:4px">
      <strong>${esc(wf.name)}</strong>
      <div style="color:var(--muted);font-size:12px;margin-top:2px">
        ${wf.steps.map(s => STEP_ICONS[s] ?? "Â·").join(" ")} &nbsp;
        ${wf.steps.map(s => STEP_LABELS[s] ?? s).join(" â†’ ")}
      </div>
    </div>`;

  if (needsServer) checkServer();
}

async function checkServer() {
  const url = document.getElementById("serverUrlInput").value.trim();
  state.serverUrl = url;
  const dot = document.getElementById("serverDot");
  const status = document.getElementById("serverUrlStatus");
  dot.className = "server-dot";
  status.textContent = "Verificando...";
  try {
    const d = await getJSON("/api/server/status");
    if (d.endpoint.status === "openai-compatible") {
      dot.className = "server-dot ok";
      status.textContent = "Servidor disponÃ­vel â€” API compatÃ­vel respondendo.";
    } else {
      dot.className = "server-dot warn";
      status.innerHTML = `Servidor nÃ£o responde em <code>${esc(url)}</code>. <a href="/server.html">Iniciar servidor â†’</a>`;
    }
  } catch {
    dot.className = "server-dot warn";
    status.textContent = "NÃ£o foi possÃ­vel verificar o servidor.";
  }
}

/* â”€â”€ Passo 4: ExecuÃ§Ã£o â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function buildExecSteps(workflow, currentStep = -1, doneSteps = [], errorStep = null) {
  return workflow.steps.map((s, i) => {
    let cls = "pending";
    let icon = STEP_ICONS[s] ?? "Â·";
    let detail = "";

    if (errorStep === s) { cls = "error"; icon = "âœ—"; detail = "Erro nesta etapa."; }
    else if (doneSteps.includes(s)) { cls = "done"; icon = "âœ“"; }
    else if (currentStep === s) { cls = "running"; icon = ""; }

    return `<div class="exec-step ${cls}">
      <div class="exec-step-icon">${cls === "running" ? `<div class="spinner"></div>` : esc(icon)}</div>
      <div class="exec-step-label">${esc(STEP_LABELS[s] ?? s)}</div>
      <div class="exec-step-detail">${esc(detail)}</div>
    </div>`;
  }).join("");
}

function startTimer() {
  state.elapsed = 0;
  state.timerInterval = setInterval(() => {
    state.elapsed += 1;
    document.getElementById("execTimer").textContent = `${state.elapsed}s`;
  }, 1000);
}

function stopTimer() {
  if (state.timerInterval) { clearInterval(state.timerInterval); state.timerInterval = null; }
}

async function executeWorkflow() {
  const wf = state.selectedWorkflow;
  const file = state.selectedFile;
  if (!wf || !file) return;

  goTo(3);
  document.getElementById("execError").style.display = "none";
  document.getElementById("execSteps").innerHTML = buildExecSteps(wf, wf.steps[0]);
  startTimer();

  try {
    const d = await postJSON("/api/run", {
      file: file.path,
      workflow: wf.id,
      baseUrl: state.serverUrl,
      dryRun: state.dryRun,
    });

    // Servidor antigo (sem reiniciar): resposta sÃ­ncrona sem runId
    if (d.status === "ok" || d.status === "dry-run") {
      document.getElementById("execSteps").innerHTML = buildExecSteps(wf, null, wf.steps);
      stopTimer();
      showResult(d, false);
      return;
    }

    if (!d.runId) {
      throw new Error("Servidor nÃ£o retornou ID de execuÃ§Ã£o. Reinicie o servidor APDA com `apda web`.");
    }

    state.runId = d.runId;
    watchRun(wf);
  } catch (err) {
    stopTimer();
    showExecError(err.message);
  }
}

function watchRun(wf) {
  if (state.sseSource) state.sseSource.close();

  const src = new EventSource(`/api/run/stream?runId=${encodeURIComponent(state.runId)}`);
  state.sseSource = src;

  let stepIndex = 0;

  const ticker = setInterval(() => {
    const nextStep = stepIndex < wf.steps.length - 1 ? stepIndex + 1 : stepIndex;
    if (stepIndex < wf.steps.length - 1) stepIndex++;
    document.getElementById("execSteps").innerHTML = buildExecSteps(wf, wf.steps[nextStep]);
  }, 4000);

  src.addEventListener("update", (e) => {
    const record = JSON.parse(e.data);
    clearInterval(ticker);
    if (record.status === "ok" || record.status === "dry-run") {
      document.getElementById("execSteps").innerHTML =
        buildExecSteps(wf, null, wf.steps);
      stopTimer();
      src.close();
      showResult(record, false);
    } else if (record.status === "error") {
      document.getElementById("execSteps").innerHTML =
        buildExecSteps(wf, null, [], wf.steps[wf.steps.length - 1]);
      stopTimer();
      src.close();
      showExecError(record.error?.message ?? "Erro desconhecido.");
    }
  });

  src.addEventListener("error", (e) => {
    clearInterval(ticker);
    const data = e.data ? JSON.parse(e.data) : null;
    stopTimer();
    src.close();
    showExecError(data?.message ?? "ConexÃ£o com o servidor perdida.");
  });

  src.onerror = () => {
    clearInterval(ticker);
    stopTimer();
    src.close();
    checkRunFallback(wf);
  };
}

async function checkRunFallback(wf) {
  if (!state.runId) return;
  try {
    const record = await getJSON(`/api/runs/${encodeURIComponent(state.runId)}`);
    if (record.status === "ok" || record.status === "dry-run") {
      document.getElementById("execSteps").innerHTML = buildExecSteps(wf, null, wf.steps);
      showResult(record, false);
    } else if (record.status === "error") {
      showExecError(record.error?.message ?? "Erro desconhecido.");
    }
  } catch { /* ignora */ }
}

function showExecError(msg) {
  const el = document.getElementById("execError");
  el.textContent = `Erro: ${msg}`;
  el.style.display = "";
}

/* â”€â”€ Passo 5: Resultado â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function showResult(record, isError) {
  goTo(4);
  const elapsed = record.elapsedMs != null
    ? `${(record.elapsedMs / 1000).toFixed(1)}s`
    : state.elapsed > 0 ? `${state.elapsed}s` : "";
  const outputs = record.outputs ?? record.result?.outputs ?? {};
  const isDry = record.status === "dry-run";

  const files = [];
  if (outputs.extracted?.relativePath) {
    files.push({ label: "Texto extraÃ­do", path: outputs.extracted.relativePath, type: "txt" });
  }
  if (outputs.anonymized?.relativePath) {
    files.push({ label: "Texto anonimizado", path: outputs.anonymized.relativePath, type: "txt" });
  }
  if (outputs.artifact?.relativePath) {
    files.push({ label: "Artefato pedagÃ³gico", path: outputs.artifact.relativePath, type: "json" });
  }

  const artifact = outputs.artifact?.relativePath;

  document.getElementById("resultBlock").innerHTML = `
    <div class="result-block${isError ? " error-result" : ""}">
      <div class="result-title ${isError ? "err" : "ok"}">
        ${isDry ? "âœ“ Dry-run concluÃ­do" : isError ? "âœ— ExecuÃ§Ã£o com erro" : "âœ“ ExecuÃ§Ã£o concluÃ­da"}
      </div>
      <div style="color:var(--muted);font-size:13px;margin-bottom:10px">
        ${esc(record.workflowName ?? record.workflowId)} Â· ${elapsed}
        ${isDry ? ' Â· <span class="badge warn">dry-run</span>' : ""}
      </div>
      ${files.length ? `
        <div class="result-files">
          ${files.map(f => `
            <div class="result-file">
              <span class="file-ext ${extClass("." + f.type)}">${esc(f.type)}</span>
              <span class="result-file-path">${esc(f.path)}</span>
              <span class="field-label">${esc(f.label)}</span>
            </div>`).join("")}
        </div>` : ""}
      ${artifact && !isDry ? `
        <div style="margin-top:14px">
          <a href="/index.html" class="btn primary" style="font-size:13px">
            Ver artefato no Visualizador â†’
          </a>
        </div>` : ""}
      ${record.error ? `<div class="error-msg" style="margin-top:10px">${esc(record.error.message)}</div>` : ""}
    </div>`;
}

/* â”€â”€ Eventos â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
document.getElementById("fileSearch").addEventListener("input", renderFiles);
document.getElementById("reloadFilesBtn").addEventListener("click", loadFiles);
document.getElementById("changeFileBtn").addEventListener("click", () => goTo(0));
document.getElementById("changeWorkflowBtn").addEventListener("click", () => goTo(1));
document.getElementById("checkServerBtn").addEventListener("click", checkServer);
document.getElementById("dryRunCheck").addEventListener("change", e => { state.dryRun = e.target.checked; });
document.getElementById("serverUrlInput").addEventListener("change", e => {
  state.serverUrl = e.target.value;
  checkServer();
});
document.getElementById("executeBtn").addEventListener("click", executeWorkflow);
document.getElementById("newRunBtn").addEventListener("click", () => {
  state.selectedFile = null;
  state.selectedWorkflow = null;
  state.runId = null;
  if (state.sseSource) { state.sseSource.close(); state.sseSource = null; }
  stopTimer();
  loadFiles();
  goTo(0);
});

/* â”€â”€ Init â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
loadFiles();


