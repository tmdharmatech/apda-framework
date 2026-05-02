import { getJSON } from "../lib/api.js";
import { esc } from "../lib/dom.js";

const state = { data: null, model: "", category: "" };

const els = {
  cards:          document.getElementById("cards"),
  hardware:       document.getElementById("hardware"),
  rows:           document.getElementById("rows"),
  vramBars:       document.getElementById("vramBars"),
  speedBars:      document.getElementById("speedBars"),
  rawJson:        document.getElementById("rawJson"),
  reload:         document.getElementById("reload"),
  modelFilter:    document.getElementById("modelFilter"),
  categoryFilter: document.getElementById("categoryFilter"),
};

function fmt(v, digits = 1, suffix = "") {
  if (v === null || v === undefined) return "n/a";
  return typeof v === "number" ? `${v.toFixed(digits)}${suffix}` : `${v}${suffix}`;
}

function badge(v, kind) {
  let cls = "";
  if (kind === "json")    cls = v === true ? "ok" : v === false ? "risk" : "warn";
  if (kind === "privacy") cls = v === false ? "ok" : v === true ? "risk" : "warn";
  return `<span class="badge ${cls}">${v === null || v === undefined ? "n/a" : v}</span>`;
}

function qualityBadge(v) {
  const risk = ["mistura_semantica_detectada","boa_com_inconsistencia_validacao"];
  const ok   = ["boa_com_revisao","melhor_separacao_com_inconsistencias"];
  const cls  = risk.includes(v) ? "warn" : ok.includes(v) ? "ok" : "";
  return `<span class="badge ${cls}">${esc(v || "n/a")}</span>`;
}

function boolBadge(v) {
  const cls   = v === true ? "risk" : v === false ? "ok" : "warn";
  const label = v === true ? "sim"  : v === false ? "nÃ£o" : "n/a";
  return `<span class="badge ${cls}">${label}</span>`;
}

function filteredTests() {
  if (!state.data) return [];
  return state.data.tests.filter(t => {
    if (state.model    && t.model_key !== state.model)      return false;
    if (state.category && t.category  !== state.category)   return false;
    return true;
  });
}

function renderCards(all) {
  const jsonTests = all.filter(t => t.category === "json_generation");
  const validJson = jsonTests.filter(t => t.json_valid === true).length;
  const noLeak    = jsonTests.filter(t => t.name_leak_detected === false).length;
  const maxVram   = all.filter(t => t.metrics.vram_total_mib != null)
                      .reduce((m, t) => Math.max(m, t.metrics.vram_total_mib), 0);
  const bestSpeed = all.reduce((m, t) => Math.max(m, t.metrics.generation_tokens_per_second || 0), 0);

  const card = (label, value) =>
    `<div class="card"><div class="card-label">${label}</div><div class="card-value">${value}</div></div>`;

  els.cards.innerHTML = [
    card("Testes",        all.length),
    card("JSON vÃ¡lidos",  `${validJson}/${jsonTests.length}`),
    card("Sem vazamento", `${noLeak}/${jsonTests.length}`),
    card("Pico de VRAM",  fmt(maxVram, 0, " MiB")),
    card("Melhor geraÃ§Ã£o",fmt(bestSpeed, 1, " t/s")),
  ].join("");
}

function renderRows(items) {
  els.rows.innerHTML = items.map(t => {
    const m = t.metrics;
    return `<tr>
      <td><strong>${esc(t.id)}</strong><br><span style="color:var(--muted);font-size:12px">${esc(t.notes || "")}</span></td>
      <td>${esc(t.model_label)}</td>
      <td>${fmt(t.ctx_size, 0)}</td>
      <td>${fmt(t.students, 0)}</td>
      <td>${fmt(m.vram_total_mib, 0, " MiB")}</td>
      <td>${fmt(m.elapsed_seconds, 2, " s")}</td>
      <td>${fmt(m.prompt_tokens_per_second, 1, " t/s")}</td>
      <td>${fmt(m.generation_tokens_per_second, 1, " t/s")}</td>
      <td>${badge(t.json_valid, "json")}</td>
      <td>${badge(t.name_leak_detected, "privacy")}</td>
      <td>${esc(t.student_separation || "n/a")}</td>
      <td>${boolBadge(t.retry_needed)}</td>
      <td>${qualityBadge(t.semantic_quality)}</td>
    </tr>`;
  }).join("");
}

function renderBars(container, items, key, suffix) {
  const measured = items.filter(t => t.metrics[key] != null);
  const max = measured.reduce((m, t) => Math.max(m, t.metrics[key]), 0);
  if (!measured.length) {
    container.innerHTML = `<div class="panel-notes">Sem mediÃ§Ãµes disponÃ­veis.</div>`;
    return;
  }
  container.innerHTML = measured.map(t => {
    const pct = max ? Math.max(2, (t.metrics[key] / max) * 100) : 0;
    return `<div class="bar-row">
      <div class="bar-label">${esc(t.model_label)} Â· ${esc(t.id)}</div>
      <div class="bar-track"><div class="bar-fill" style="width:${pct}%"></div></div>
      <div>${fmt(t.metrics[key], key.includes("vram") ? 0 : 1, suffix)}</div>
    </div>`;
  }).join("");
}

function populateModelFilter() {
  const current = els.modelFilter.value;
  const models = Object.entries(state.data.models || {});
  els.modelFilter.innerHTML = `<option value="">Todos os modelos</option>` +
    models.map(([k, m]) => `<option value="${esc(k)}">${esc(m.label)}</option>`).join("");
  els.modelFilter.value = current;
}

function render() {
  if (!state.data) return;
  const items = filteredTests();
  renderCards(state.data.tests);
  renderRows(items);
  renderBars(els.vramBars,   items, "vram_total_mib",                " MiB");
  renderBars(els.speedBars,  items, "generation_tokens_per_second",  " t/s");
  const hw = state.data.hardware || {};
  els.hardware.textContent = [hw.gpu, hw.backend, hw.device, hw.vram_total_mib ? `VRAM ${hw.vram_total_mib} MiB` : ""].filter(Boolean).join(" Â· ");
  els.rawJson.textContent = JSON.stringify(state.data, null, 2);
}

function showError(msg) {
  els.cards.innerHTML = `<div class="empty" style="color:var(--risk)">âš  ${esc(msg)}</div>`;
  els.rows.innerHTML = "";
  els.vramBars.innerHTML = "";
  els.speedBars.innerHTML = "";
  els.rawJson.textContent = msg;
}

async function load() {
  els.cards.innerHTML = `<div class="empty">Carregando benchmarks...</div>`;
  els.rawJson.textContent = "Carregando...";
  try {
    state.data = await getJSON("/api/benchmarks");
    if (!state.data?.tests?.length) {
      showError("Nenhum benchmark encontrado em benchmarks/benchmarks.json.");
      return;
    }
    populateModelFilter();
    render();
  } catch (e) {
    showError(`Erro ao carregar benchmarks: ${e.message}`);
  }
}

els.reload.addEventListener("click", load);
els.modelFilter.addEventListener("change",    e => { state.model    = e.target.value; render(); });
els.categoryFilter.addEventListener("change", e => { state.category = e.target.value; render(); });

load();


