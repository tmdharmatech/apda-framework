import { getJSON } from "../lib/api.js";
import { esc } from "../lib/dom.js";

function icon(ok, warn = false) {
  if (ok)   return `<span class="check-icon" style="color:var(--ok)">✓</span>`;
  if (warn) return `<span class="check-icon" style="color:var(--warn)">⚠</span>`;
  return `<span class="check-icon" style="color:var(--risk)">✗</span>`;
}

function pill(label, cls) {
  return `<span class="badge ${cls}">${esc(label)}</span>`;
}

function endpointPill(status) {
  const map = {
    "openai-compatible": ["API ativa",  "ok"],
    "occupied":          ["porta ocupada", "warn"],
    "free":              ["porta livre",   ""],
  };
  const [label, cls] = map[status] ?? [status, ""];
  return pill(label, cls);
}

function renderPython(py) {
  const rows = [
    { ok: py.ok, label: "Python disponível", detail: py.ok ? `${py.command} · ${py.version || "versão desconhecida"}` : "python3 / .venv não encontrado" },
    { ok: py.scriptsOk, label: "Scripts APDA presentes", detail: py.scripts.filter(s => !s.ok).map(s => s.path).join(", ") || "todos encontrados" },
    { ok: py.modulesOk, label: "Dependências Python instaladas",
      detail: py.modules.filter(m => !m.ok).map(m => m.packageName).join(", ") || "todas presentes" },
  ];
  return `
    <div class="panel">
      <div class="panel-head"><h2>Python</h2></div>
      ${rows.map(r => `
        <div class="check-row">
          ${icon(r.ok)}
          <span class="check-label">${esc(r.label)}</span>
          <span class="check-detail">${esc(r.detail)}</span>
        </div>`).join("")}
      ${!py.modulesOk ? `
        <details style="margin-top:10px">
          <summary>Módulos ausentes</summary>
          <div style="margin-top:8px;display:flex;flex-wrap:wrap;gap:6px">
            ${py.modules.filter(m => !m.ok).map(m =>
              `<span class="chip" style="border-color:var(--risk);color:var(--risk)">${esc(m.packageName)}</span>`
            ).join("")}
          </div>
          <div class="cmd-box">.venv/bin/pip install -r requirements.txt</div>
        </details>` : ""}
    </div>`;
}

function renderGpus(gpus) {
  return `
    <div class="panel">
      <div class="panel-head"><h2>GPUs detectadas</h2><span class="badge">${gpus.length}</span></div>
      ${gpus.length ? gpus.map(g => `
        <div class="check-row">
          ${icon(true)}
          <span class="check-label">${esc(g.label)}</span>
          <span class="check-detail">${esc(g.kind)}</span>
        </div>`).join("") : `<div class="check-row">${icon(false, true)}<span class="check-label">Nenhuma GPU detectada — CPU disponível como fallback</span></div>`}
    </div>`;
}

function renderModels(models, defaultModel) {
  const defPath = defaultModel?.path ?? null;
  return `
    <div class="panel">
      <div class="panel-head">
        <h2>Modelos .gguf</h2>
        <span class="badge">${models.length}</span>
      </div>
      ${defaultModel ? `
        <div class="check-row">
          ${icon(true)}
          <span class="check-label"><strong>Padrão:</strong> ${esc(defaultModel.name)}</span>
          <span class="check-detail">${esc(defaultModel.sizeLabel)} · ${esc(defaultModel.source)}</span>
        </div>` : `
        <div class="check-row">
          ${icon(false, true)}
          <span class="check-label">Nenhum modelo configurado como padrão</span>
        </div>`}
      ${models.filter(m => m.path !== defPath).slice(0, 6).map(m => `
        <div class="check-row">
          ${icon(true)}
          <span class="check-label">${esc(m.name)}</span>
          <span class="check-detail">${esc(m.sizeLabel)}</span>
        </div>`).join("")}
      ${models.length > 7 ? `<div class="check-detail" style="padding:6px 0">... e mais ${models.length - 7} modelos</div>` : ""}
    </div>`;
}

function renderServer(llamaBinary, endpoint, llamaCommand) {
  const endpointOk = endpoint.status === "openai-compatible";
  const endpointWarn = endpoint.status === "occupied";
  return `
    <div class="panel">
      <div class="panel-head"><h2>llama-server</h2></div>
      <div class="check-row">
        ${icon(llamaBinary.ok)}
        <span class="check-label">Binário llama-server</span>
        <span class="check-detail">${llamaBinary.ok ? `${esc(llamaBinary.path)} · ${esc(llamaBinary.source)}` : "não encontrado"}</span>
      </div>
      <div class="check-row">
        ${icon(endpointOk, endpointWarn)}
        <span class="check-label">Endpoint configurado</span>
        <div class="endpoint-row">
          <code>${esc(endpoint.baseUrl)}</code>
          ${endpointPill(endpoint.status)}
        </div>
      </div>
      ${llamaCommand && !endpointOk ? `
        <div style="margin-top:10px">
          <div class="field-label">Comando para subir manualmente</div>
          <div class="cmd-box">${esc(llamaCommand)}</div>
        </div>` : ""}
    </div>`;
}

function renderInputs(inputs) {
  const extCount = {};
  for (const f of inputs) extCount[f.extension] = (extCount[f.extension] || 0) + 1;
  return `
    <div class="panel">
      <div class="panel-head">
        <h2>Arquivos em entrada/</h2>
        <span class="badge">${inputs.length}</span>
      </div>
      ${!inputs.length ? `<div class="check-row">${icon(false, true)}<span class="check-label">Nenhum arquivo suportado encontrado</span></div>` :
        `<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:10px">
          ${Object.entries(extCount).map(([ext, n]) => `<span class="chip">${esc(ext)} × ${n}</span>`).join("")}
        </div>
        ${inputs.slice(0, 8).map(f => `
          <div class="check-row">
            ${icon(true)}
            <span class="check-label">${esc(f.name)}</span>
            <span class="check-detail">${esc(f.extension)}</span>
          </div>`).join("")}
        ${inputs.length > 8 ? `<div class="check-detail" style="padding:6px 0">... e mais ${inputs.length - 8} arquivos</div>` : ""}`}
    </div>`;
}

function renderConfig(cfg) {
  return `
    <div class="panel">
      <div class="panel-head"><h2>Configuração local</h2></div>
      <div class="check-row">
        ${icon(cfg.exists)}
        <span class="check-label">.apda/config.json</span>
        <span class="check-detail">${cfg.exists ? "encontrada" : "não criada — será gerada no primeiro onboarding"}</span>
      </div>
      ${cfg.exists ? `
        <details style="margin-top:10px">
          <summary>Ver valores</summary>
          <pre>${esc(JSON.stringify(cfg.values, null, 2))}</pre>
        </details>` : ""}
    </div>`;
}

function renderActions(actions) {
  if (!actions.length) {
    return `
      <div class="panel">
        <div class="panel-head"><h2>Próximas ações</h2></div>
        <div class="check-row">
          ${icon(true)}
          <span class="check-label">Ambiente pronto — execute <strong>apda web</strong> ou <a href="/run.html">Executar</a> para iniciar.</span>
        </div>
      </div>`;
  }
  return `
    <div class="panel">
      <div class="panel-head"><h2>Próximas ações</h2><span class="badge warn">${actions.length}</span></div>
      <div class="actions-list">
        ${actions.map(a => `
          <div class="action-item">
            <span class="action-icon">→</span>
            <span>${esc(a)}</span>
          </div>`).join("")}
      </div>
    </div>`;
}

function renderSummaryCards(report) {
  const allOk = report.python.ok && report.python.modulesOk && report.llamaBinary.ok
    && report.endpoint.status === "openai-compatible" && report.inputs.length > 0;
  const hasActions = report.actions.length > 0;

  const card = (label, value, cls = "") =>
    `<div class="card"><div class="card-label">${label}</div><div class="card-value ${cls}">${value}</div></div>`;

  return `<div class="cards">
    ${card("Python", report.python.ok ? `<span class="badge ok">ok</span>` : `<span class="badge risk">problema</span>`)}
    ${card("GPUs", report.gpus.length || "CPU")}
    ${card("Modelos", report.models.length)}
    ${card("Servidor", `<span class="badge ${report.endpoint.status === "openai-compatible" ? "ok" : ""}">${report.endpoint.status === "openai-compatible" ? "ativo" : "inativo"}</span>`)}
    ${card("Arquivos", report.inputs.length)}
    ${card("Status geral", allOk ? `<span class="badge ok">pronto</span>` : hasActions ? `<span class="badge warn">${report.actions.length} ação${report.actions.length > 1 ? "ões" : ""}</span>` : `<span class="badge warn">verificar</span>`)}
  </div>`;
}

function render(report) {
  const main = document.getElementById("main");
  main.innerHTML = `
    ${renderSummaryCards(report)}
    ${renderActions(report.actions)}
    <div class="section-grid">
      ${renderPython(report.python)}
      ${renderGpus(report.gpus)}
      ${renderModels(report.models, report.defaultModel)}
      ${renderServer(report.llamaBinary, report.endpoint, report.llamaCommand)}
    </div>
    ${renderInputs(report.inputs)}
    ${renderConfig(report.config)}
  `;
}

async function load() {
  const main = document.getElementById("main");
  main.innerHTML = `<div class="loading">Carregando diagnóstico...</div>`;
  try {
    render(await getJSON("/api/doctor"));
  } catch (err) {
    main.innerHTML = `<div class="panel"><p class="error-msg">Erro ao carregar diagnóstico: ${esc(err.message)}</p></div>`;
  }
}

document.getElementById("reloadBtn").addEventListener("click", load);
load();


