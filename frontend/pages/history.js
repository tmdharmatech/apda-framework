import { getJSON } from "../lib/api.js";
import { esc } from "../lib/dom.js";

const STEP_LABELS = {
  "extract-text":      "Extraindo texto",
  "privacy-filter":    "Privacy Filter (PII)",
  "generate-artifact": "Gerando artefato JSON",
  "validate-schema":   "Validando schema",
};
const STEP_ICONS = {
  "extract-text":      "ðŸ“„",
  "privacy-filter":    "ðŸ”’",
  "generate-artifact": "ðŸ¤–",
  "validate-schema":   "âœ…",
};
const OUTPUT_LABELS = {
  extracted:  "Texto extraÃ­do",
  anonymized: "Texto anonimizado",
  artifact:   "Artefato pedagÃ³gico",
};
const EXT_CLASS = { txt:"txt", json:"json", docx:"docx", pdf:"pdf", xlsx:"xlsx" };

let allRuns = [];
let selectedId = null;

function statusBadge(status) {
  const labels = { ok: "ok", error: "erro", "dry-run": "dry-run", running: "em andamento" };
  const label = labels[status] ?? status;
  return `<span class="status-badge ${esc(status)}">
    <span class="status-dot dot-${esc(status)}"></span>${esc(label)}
  </span>`;
}

function fmtDate(iso) {
  if (!iso) return "â€“";
  const d = new Date(iso);
  return d.toLocaleDateString("pt-BR") + " " + d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

function fmtElapsed(ms) {
  if (ms == null) return "â€“";
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function fileName(path) {
  return path ? path.split("/").pop() : "â€“";
}

/* â”€â”€ Carregar dados â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
async function loadRuns() {
  document.getElementById("runsBody").innerHTML =
    `<tr><td colspan="6" class="empty-state">Carregando...</td></tr>`;
  try {
    allRuns = await getJSON("/api/runs");
    populateWorkflowFilter();
    renderTable();
    updateSubtitle();
  } catch (e) {
    document.getElementById("runsBody").innerHTML =
      `<tr><td colspan="6" class="empty-state" style="color:var(--risk)">Erro: ${esc(e.message)}</td></tr>`;
  }
}

function populateWorkflowFilter() {
  const wfSet = new Set(allRuns.map(r => r.workflowId).filter(Boolean));
  const sel = document.getElementById("filterWorkflow");
  const cur = sel.value;
  while (sel.options.length > 1) sel.remove(1);
  for (const wf of [...wfSet].sort()) {
    const opt = document.createElement("option");
    opt.value = wf;
    opt.textContent = wf;
    sel.appendChild(opt);
  }
  if (cur) sel.value = cur;
}

function filteredRuns() {
  const status   = document.getElementById("filterStatus").value;
  const workflow = document.getElementById("filterWorkflow").value;
  const search   = document.getElementById("filterSearch").value.trim().toLowerCase();
  return allRuns.filter(r => {
    if (status && r.status !== status) return false;
    if (workflow && r.workflowId !== workflow) return false;
    if (search) {
      const haystack = [r.id, r.workflowId, r.workflowName, r.input?.relativePath].join(" ").toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  });
}

function renderTable() {
  const runs = filteredRuns();
  if (!runs.length) {
    document.getElementById("runsBody").innerHTML =
      `<tr><td colspan="6" class="empty-state">Nenhuma execuÃ§Ã£o encontrada.</td></tr>`;
    return;
  }
  document.getElementById("runsBody").innerHTML = runs.map(r => {
    const sel = r.id === selectedId ? " class=\"selected\"" : "";
    const shortId = r.id.split("-")[0] ?? r.id;
    const inputName = fileName(r.input?.relativePath ?? r.input?.path ?? "");
    return `<tr${sel} data-id="${esc(r.id)}">
      <td>${statusBadge(r.status)}</td>
      <td>${esc(r.workflowName ?? r.workflowId ?? "â€“")}</td>
      <td class="input-cell" title="${esc(inputName)}">${esc(inputName)}</td>
      <td class="elapsed-cell">${fmtElapsed(r.elapsedMs)}</td>
      <td class="date-cell">${fmtDate(r.startedAt)}</td>
      <td class="run-id-cell">${esc(shortId)}</td>
    </tr>`;
  }).join("");
  document.querySelectorAll("#runsBody tr[data-id]").forEach(row => {
    row.addEventListener("click", () => openDetail(row.dataset.id));
  });
}

function updateSubtitle() {
  const total   = allRuns.length;
  const ok      = allRuns.filter(r => r.status === "ok").length;
  const errors  = allRuns.filter(r => r.status === "error").length;
  const running = allRuns.filter(r => r.status === "running").length;
  let parts = [`${total} execuÃ§${total === 1 ? "Ã£o" : "Ãµes"}`];
  if (ok)      parts.push(`${ok} ok`);
  if (errors)  parts.push(`${errors} com erro`);
  if (running) parts.push(`${running} em andamento`);
  document.getElementById("subtitle").textContent = parts.join(" Â· ");
}

/* â”€â”€ Detalhe â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
async function openDetail(id) {
  selectedId = id;
  renderTable();
  const panel = document.getElementById("detailPanel");
  panel.classList.add("open");
  panel.querySelector("#detailTitle").textContent = "Carregando...";
  panel.querySelector("#detailMeta").textContent = "";
  panel.querySelector("#detailBadge").innerHTML = "";
  panel.querySelector("#detailSteps").innerHTML = "";
  panel.querySelector("#detailOutputsWrap").style.display = "none";
  panel.querySelector("#detailMetricsWrap").style.display = "none";
  panel.querySelector("#detailErrorWrap").style.display = "none";
  panel.querySelector("#detailActions").innerHTML = "";
  panel.querySelector("#detailJson").textContent = "";

  try {
    const rec = await getJSON(`/api/runs/${encodeURIComponent(id)}`);
    renderDetail(rec);
  } catch (e) {
    panel.querySelector("#detailTitle").textContent = "Erro ao carregar";
    panel.querySelector("#detailError").textContent = e.message;
    panel.querySelector("#detailErrorWrap").style.display = "";
  }
}

function renderDetail(rec) {
  document.getElementById("detailTitle").textContent =
    rec.workflowName ?? rec.workflowId ?? rec.id;

  const inputName = fileName(rec.input?.relativePath ?? rec.input?.path ?? "");
  document.getElementById("detailMeta").textContent =
    [inputName, fmtDate(rec.startedAt), fmtElapsed(rec.elapsedMs)].filter(Boolean).join(" Â· ");

  document.getElementById("detailBadge").innerHTML = statusBadge(rec.status);

  // Etapas
  const steps = rec.steps ?? [];
  document.getElementById("detailSteps").innerHTML = steps.length
    ? steps.map(s => `<div class="step-row done">
        <div class="step-icon">${esc(STEP_ICONS[s] ?? "Â·")}</div>
        <div class="step-label">${esc(STEP_LABELS[s] ?? s)}</div>
      </div>`).join("")
    : `<div style="color:var(--muted);font-size:13px">Nenhuma etapa registrada.</div>`;

  // Outputs
  const outputs = rec.outputs ?? {};
  const outEntries = Object.entries(OUTPUT_LABELS)
    .map(([key, label]) => ({ key, label, data: outputs[key] }))
    .filter(e => e.data?.relativePath ?? e.data?.path);

  if (outEntries.length) {
    document.getElementById("detailOutputsWrap").style.display = "";
    document.getElementById("detailOutputs").innerHTML = outEntries.map(({ label, data }) => {
      const relPath = data.relativePath ?? data.path;
      const ext = relPath.split(".").pop();
      const extCls = EXT_CLASS[ext] ?? "";
      return `<div class="output-row">
        <span class="file-ext ${extCls}" style="background:var(--chip);border-radius:4px;padding:2px 7px;font-size:11px;font-weight:800">${esc(ext)}</span>
        <span class="output-path">${esc(relPath)}</span>
        <span class="output-label">${esc(label)}</span>
      </div>`;
    }).join("");
  }

  // MÃ©tricas
  const meta = rec.meta ?? {};
  const metricItems = [];
  if (meta.tokenCount != null)
    metricItems.push({ label: "Tokens", value: meta.tokenCount.toLocaleString("pt-BR") });
  if (meta.promptTokens != null)
    metricItems.push({ label: "Tokens prompt", value: meta.promptTokens.toLocaleString("pt-BR") });
  if (meta.completionTokens != null)
    metricItems.push({ label: "Tokens resposta", value: meta.completionTokens.toLocaleString("pt-BR") });
  if (rec.elapsedMs != null)
    metricItems.push({ label: "DuraÃ§Ã£o total", value: fmtElapsed(rec.elapsedMs) });

  if (metricItems.length) {
    document.getElementById("detailMetricsWrap").style.display = "";
    document.getElementById("detailMetrics").innerHTML = metricItems.map(m =>
      `<div class="metric-item"><strong>${esc(m.value)}</strong>${esc(m.label)}</div>`
    ).join("");
  }

  // Erro
  if (rec.error) {
    document.getElementById("detailErrorWrap").style.display = "";
    document.getElementById("detailError").textContent = rec.error.message ?? JSON.stringify(rec.error);
  }

  // JSON bruto
  document.getElementById("detailJson").textContent = JSON.stringify(rec, null, 2);

  // AÃ§Ãµes
  const actions = [];
  if (rec.outputs?.artifact?.relativePath) {
    actions.push(`<a href="/index.html" class="btn primary" style="font-size:12px">Ver artefato â†’</a>`);
  }
  const inputFile = rec.input?.relativePath ?? rec.input?.path;
  if (inputFile && (rec.status === "ok" || rec.status === "error")) {
    actions.push(`<a href="/run.html" class="btn" style="font-size:12px">Re-executar arquivo</a>`);
  }
  document.getElementById("detailActions").innerHTML = actions.join("");
}

/* â”€â”€ Eventos â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
document.getElementById("reloadBtn").addEventListener("click", loadRuns);
document.getElementById("filterStatus").addEventListener("change", renderTable);
document.getElementById("filterWorkflow").addEventListener("change", renderTable);
document.getElementById("filterSearch").addEventListener("input", renderTable);

loadRuns();


