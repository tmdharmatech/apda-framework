import { getJSON, postJSON } from "../lib/api.js";
import { esc } from "../lib/dom.js";

let currentStatus = null;
let pollInterval  = null;
let startTimer    = null;
let startElapsed  = 0;
let logVisible    = true;

const els = {
  block:       document.getElementById("statusBlock"),
  dot:         document.querySelector(".status-dot"),
  errorMsg:    document.getElementById("errorMsg"),
  errorText:   document.getElementById("errorText"),
  progressRow: document.getElementById("progressRow"),
  progressLbl: document.getElementById("progressLabel"),
  progressFil: document.getElementById("progressFill"),
  progressTmr: document.getElementById("progressTimer"),
  detailPanel: document.getElementById("detailPanel"),
  infoPanel:   document.getElementById("infoPanel"),
  cmdPanel:    document.getElementById("cmdPanel"),
  logSection:  document.getElementById("logSection"),
  logContent:  document.getElementById("logContent"),
  reloadBtn:   document.getElementById("reloadBtn"),
  toggleLogBtn:  document.getElementById("toggleLogBtn"),
  refreshLogBtn: document.getElementById("refreshLogBtn"),
};

/* â”€â”€ Estado do bloco principal â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function setBlock(kind, title, sub, btns = "") {
  els.block.className = `server-status-block ${kind}`;
  els.dot.className   = `status-dot ${kind}`;
  els.block.querySelector(".status-text").innerHTML =
    `<div class="status-title">${title}</div><div class="status-sub">${sub}</div>`;

  const existing = els.block.querySelector(".btn-row");
  if (existing) existing.remove();
  if (btns) {
    const row = document.createElement("div");
    row.className = "btn-row";
    row.innerHTML = btns;
    els.block.appendChild(row);
    wireButtons(row);
  }
}

function wireButtons(container) {
  container.querySelector("#startBtn")?.addEventListener("click", startServer);
  container.querySelector("#stopBtn")?.addEventListener("click", confirmStop);
}

/* â”€â”€ Renderiza status â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
function renderStatus(s) {
  currentStatus = s;
  hideError();

  const ep = s.endpoint;
  const m  = s.managed;
  const endpointOk = ep.status === "openai-compatible";
  const managed    = m && m.alive;
  const external   = endpointOk && !managed;
  const occupied   = ep.status === "occupied" && !endpointOk;

  if (managed) {
    setBlock("active",
      "Servidor ativo â€” gerenciado pela APDA",
      `${esc(ep.baseUrl)} Â· pid ${m.pid} Â· iniciado Ã s ${new Date(m.startedAt).toLocaleTimeString("pt-BR")}`,
      `<button id="stopBtn" class="danger" type="button">Encerrar servidor</button>`
    );
  } else if (external) {
    setBlock("external",
      "Servidor ativo â€” externo",
      `${esc(ep.baseUrl)} Â· nÃ£o iniciado pela CLI`,
      ``
    );
  } else if (occupied) {
    setBlock("busy",
      "Porta ocupada (nÃ£o Ã© llama-server)",
      `${esc(ep.baseUrl)} Â· porta ${ep.port} em uso por outro processo`,
      ``
    );
  } else {
    setBlock("inactive",
      "Servidor inativo",
      `${esc(ep.baseUrl)} Â· porta ${ep.port} livre`,
      `<button id="startBtn" class="primary" type="button">Iniciar servidor</button>`
    );
  }

  renderDetails(s);
  els.detailPanel.style.display = "grid";

  if (endpointOk || m) {
    loadLog();
    els.logSection.style.display = "";
  }
}

function renderDetails(s) {
  const m  = s.managed;
  const ep = s.endpoint;

  /* painel esquerdo: informaÃ§Ãµes */
  els.infoPanel.innerHTML = `
    <h2>InformaÃ§Ãµes</h2>
    <div class="field"><div class="field-label">Endpoint</div>
      <div class="field-value"><code>${esc(ep.baseUrl)}</code></div></div>
    <div class="field"><div class="field-label">Status da porta</div>
      <div class="field-value">
        <span class="badge ${ep.status === "openai-compatible" ? "ok" : ep.status === "occupied" ? "warn" : ""}">
          ${{ "openai-compatible": "API compatÃ­vel ativa", "occupied": "ocupada (outro processo)", "free": "livre" }[ep.status] ?? ep.status}
        </span>
      </div></div>
    ${m ? `
      <div class="field"><div class="field-label">Processo</div>
        <div class="field-value">pid ${m.pid} Â· ${m.alive ? '<span class="badge ok">ativo</span>' : '<span class="badge risk">encerrado</span>'}</div></div>
      <div class="field"><div class="field-label">Modelo em uso</div>
        <div class="field-value" style="font-size:12px">${esc(m.modelPath?.split("/").pop() ?? "â€”")}</div></div>
      <div class="field"><div class="field-label">Log</div>
        <div class="field-value" style="font-size:12px">${esc(m.logPath)}</div></div>` : ""}
  `;

  /* painel direito: comando */
  els.cmdPanel.innerHTML = `
    <h2>Comando de subida</h2>
    <div style="font-size:12px;color:var(--muted);margin-bottom:8px">
      Comando resolvido com o modelo e configuraÃ§Ãµes atuais.
    </div>
    <div id="cmdContent"><div style="color:var(--muted);font-size:13px">Carregando...</div></div>
  `;
  loadCommand();
}

async function loadCommand() {
  try {
    const d = await getJSON("/api/server/command");
    const model = d.modelPath?.split("/").pop() ?? "â€”";
    document.getElementById("cmdContent").innerHTML = `
      <div class="field"><div class="field-label">Modelo</div>
        <div class="field-value" style="font-size:12px">${esc(model)}</div></div>
      <div class="cmd-box">${esc(d.command)}</div>
    `;
  } catch (err) {
    document.getElementById("cmdContent").innerHTML =
      `<div class="notice">${esc(err.message ?? "NÃ£o foi possÃ­vel resolver o comando.")}</div>`;
  }
}

/* â”€â”€ Log â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
async function loadLog() {
  try {
    const d = await getJSON("/api/server/log");
    if (!d.lines?.length) {
      els.logContent.innerHTML = `<div style="color:var(--muted)">Nenhuma linha de log disponÃ­vel.</div>`;
      return;
    }
    const keywords = ["model loaded", "server is listening", "error", "GGML", "VRAM", "KV buffer", "compute buffer"];
    els.logContent.innerHTML = d.lines.map(line => {
      const hi = keywords.some(k => line.toLowerCase().includes(k.toLowerCase()));
      return `<div class="log-line${hi ? " highlight" : ""}">${esc(line)}</div>`;
    }).join("");
    els.logContent.scrollTop = els.logContent.scrollHeight;
  } catch { /* ignora */ }
}

/* â”€â”€ Start â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
async function startServer() {
  hideError();
  setBlock("inactive", "Iniciando servidor...", "Aguardando endpoint ficar pronto â€” pode levar atÃ© 90s");
  els.block.querySelector(".btn-row")?.remove();

  els.progressRow.style.display = "";
  els.progressLbl.textContent   = "Iniciando llama-server...";
  els.progressFil.className     = "progress-fill indeterminate";
  els.logSection.style.display  = "";

  startElapsed = 0;
  startTimer = setInterval(() => {
    startElapsed += 1;
    els.progressTmr.textContent = `${startElapsed}s`;
    if (startElapsed % 3 === 0) loadLog();
  }, 1000);

  try {
    const d = await postJSON("/api/server/start", {}, {
      signal: AbortSignal.timeout(120_000),
    });
    renderStatus(d);
  } catch (err) {
    showError(`Falha ao iniciar servidor: ${err.message}`);
    await loadStatus();
  } finally {
    clearInterval(startTimer);
    startTimer = null;
    els.progressRow.style.display = "none";
  }
}

/* â”€â”€ Stop â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
async function confirmStop() {
  if (!confirm("Encerrar o llama-server?\nA VRAM serÃ¡ liberada.")) return;
  hideError();
  try {
    const d = await postJSON("/api/server/stop", {});
    renderStatus(d);
    await loadLog();
  } catch (err) {
    showError(`Falha ao encerrar servidor: ${err.message}`);
  }
}

/* â”€â”€ Polling â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
async function loadStatus() {
  try {
    renderStatus(await getJSON("/api/server/status"));
  } catch (err) {
    showError(`Erro ao obter status: ${err.message}`);
  }
}

function startPolling() {
  stopPolling();
  pollInterval = setInterval(() => {
    if (!startTimer) loadStatus();
  }, 5000);
}

function stopPolling() {
  if (pollInterval) { clearInterval(pollInterval); pollInterval = null; }
}

function showError(msg) {
  els.errorText.textContent = msg;
  els.errorMsg.style.display = "";
}

function hideError() {
  els.errorMsg.style.display = "none";
}

/* â”€â”€ Eventos â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
els.reloadBtn.addEventListener("click", loadStatus);

els.toggleLogBtn.addEventListener("click", () => {
  logVisible = !logVisible;
  els.logContent.style.display  = logVisible ? "" : "none";
  els.toggleLogBtn.textContent  = logVisible ? "Ocultar log" : "Mostrar log";
});

els.refreshLogBtn.addEventListener("click", loadLog);

/* â”€â”€ Init â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
loadStatus().then(startPolling);

window.addEventListener("beforeunload", stopPolling);


