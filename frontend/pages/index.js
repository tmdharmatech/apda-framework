import { getJSON, postJSON } from "../lib/api.js";
import { esc, text } from "../lib/dom.js";

const state = { artifacts: [], selectedIndex: 0, query: "", validations: {} };

const els = {
  list:   document.getElementById("artifactList"),
  panel:  document.getElementById("detailPanel"),
  metrics: document.getElementById("metrics"),
  search: document.getElementById("searchInput"),
};

function statusClass(v) {
  const n = text(v, "").toLowerCase();
  if (["validado","processado","alta","baixo"].includes(n)) return "ok";
  if (["pendente","pendente_revisao","medio","media","nao_calculada","nao_avaliado"].includes(n)) return "warn";
  if (["alto","erro","rejeitado","baixa"].includes(n)) return "risk";
  return "";
}

function arrayItems(items) {
  if (!Array.isArray(items) || !items.length) return `<div class="field-value">NÃ£o informado</div>`;
  return `<ul>${items.map(i => `<li>${esc(i)}</li>`).join("")}</ul>`;
}

function chips(items) {
  if (!Array.isArray(items) || !items.length) return `<div class="field-value">Nenhum item registrado</div>`;
  return `<div class="chips">${items.map(i => `<span class="chip">${esc(i)}</span>`).join("")}</div>`;
}

function artifactTitle(item) {
  return item.label || item.data?.origem?.nome_arquivo || item.path || "Artefato sem tÃ­tulo";
}

function filtered() {
  const q = state.query.trim().toLowerCase();
  if (!q) return state.artifacts;
  return state.artifacts.filter(item => {
    const blob = JSON.stringify(item.data || {}).toLowerCase() + " " + artifactTitle(item).toLowerCase();
    return blob.includes(q);
  });
}

function validationBadge(item) {
  const v = state.validations[item.path];
  if (!v) return "";
  if (v.loading) return `<span class="item-valid" title="Validando...">â€¦</span>`;
  return v.result?.ok
    ? `<span class="item-valid" title="Schema vÃ¡lido">âœ“</span>`
    : `<span class="item-invalid" title="${v.result?.errors?.length ?? 0} erro(s) de schema">âœ—</span>`;
}

function renderList() {
  const items = filtered();
  if (!items.length) {
    const hasAny = state.artifacts.length > 0;
    els.list.innerHTML = hasAny
      ? `<div class="empty">Nenhum artefato corresponde ao filtro.</div>`
      : `<div class="empty">Nenhum artefato em <code>saida/</code>.<br><br>
           <a href="/run.html" style="color:var(--primary);font-weight:700">Executar workflow â†’</a></div>`;
    return;
  }
  els.list.innerHTML = items.map(item => {
    const ri = state.artifacts.indexOf(item);
    const d = item.data || {};
    const active = ri === state.selectedIndex ? " active" : "";
    return `<button class="item-btn${active}" type="button" data-index="${ri}">
      <div class="item-title">${validationBadge(item)}${esc(artifactTitle(item))}</div>
      <div class="item-meta">
        ${esc(d.tipo_artefato || "tipo indefinido")} Â·
        ${esc((d.metadados_processamento || {}).status || "sem status")} Â·
        ${esc((d.validacao_humana || {}).status || "sem validaÃ§Ã£o")}
      </div>
    </button>`;
  }).join("");
  els.list.querySelectorAll("[data-index]").forEach(btn => {
    btn.addEventListener("click", () => { state.selectedIndex = Number(btn.dataset.index); render(); });
  });
}

function renderMetrics(d) {
  if (!d) { els.metrics.innerHTML = ""; return; }
  const cp = d.conteudo_pedagogico || {};
  const anon = d.anonimizacao || {};
  const val = d.validacao_humana || {};
  const meta = d.metadados_processamento || {};
  const total = (cp.barreiras_identificadas || []).length +
                (cp.estrategias_pedagogicas || []).length +
                (cp.recursos_acessibilidade || []).length;

  els.metrics.innerHTML = [
    `<div class="metric"><div class="metric-label">Tipo</div><div class="metric-value">${esc(d.tipo_artefato || "â€”")}</div></div>`,
    `<div class="metric"><div class="metric-label">Sinais extraÃ­dos</div><div class="metric-value">${total}</div></div>`,
    `<div class="metric"><div class="metric-label">Risco PII</div><div class="metric-value"><span class="status ${statusClass(anon.risco_reidentificacao)}">${esc(anon.risco_reidentificacao || "nao_avaliado")}</span></div></div>`,
    `<div class="metric"><div class="metric-label">ValidaÃ§Ã£o</div><div class="metric-value"><span class="status ${statusClass(val.status || meta.status)}">${esc(val.status || meta.status || "pendente")}</span></div></div>`,
  ].join("");
}

function renderDetail() {
  const item = state.artifacts[state.selectedIndex];
  if (!item) {
    els.panel.innerHTML = `<div class="empty">Selecione um artefato para visualizar.</div>`;
    renderMetrics(null);
    return;
  }
  const d = item.data || {};
  const orig = d.origem || {};
  const cp = d.conteudo_pedagogico || {};
  const anon = d.anonimizacao || {};
  const meta = d.metadados_processamento || {};
  const val = d.validacao_humana || {};

  renderMetrics(d);

  els.panel.innerHTML = `
    <h2>${esc(artifactTitle(item))}</h2>
    <div class="grid-two">
      <div>
        <div class="field"><div class="field-label">Arquivo de origem</div><div class="field-value">${esc(orig.nome_arquivo)}</div></div>
        <div class="field"><div class="field-label">Formato original</div><div class="field-value">${esc(orig.formato_original)}</div></div>
        <div class="field"><div class="field-label">PÃ¡gina ou aba</div><div class="field-value">${esc(orig.pagina_ou_aba)}</div></div>
      </div>
      <div>
        <div class="field"><div class="field-label">Pipeline</div><div class="field-value">${esc(meta.pipeline_versao)} Â· ${esc(meta.status)}</div></div>
        <div class="field"><div class="field-label">ConfianÃ§a da extraÃ§Ã£o</div><div class="field-value"><span class="status ${statusClass(meta.confianca_extracao)}">${esc(meta.confianca_extracao)}</span></div></div>
        <div class="field"><div class="field-label">ValidaÃ§Ã£o humana</div><div class="field-value"><span class="status ${statusClass(val.status)}">${esc(val.status)}</span></div></div>
      </div>
    </div>
    <div class="field"><div class="field-label">Objetivo pedagÃ³gico</div><div class="field-value">${esc(cp.objetivo_pedagogico)}</div></div>
    <div class="grid-two">
      <div class="field"><div class="field-label">Barreiras identificadas</div>${arrayItems(cp.barreiras_identificadas)}</div>
      <div class="field"><div class="field-label">EstratÃ©gias pedagÃ³gicas</div>${arrayItems(cp.estrategias_pedagogicas)}</div>
    </div>
    <div class="grid-two">
      <div class="field"><div class="field-label">Recursos de acessibilidade</div>${arrayItems(cp.recursos_acessibilidade)}</div>
      <div class="field"><div class="field-label">Itens mascarados</div>${chips(anon.itens_mascarados)}</div>
    </div>
    <div class="field"><div class="field-label">ObservaÃ§Ãµes relevantes</div><div class="field-value">${esc(cp.observacoes_relevantes)}</div></div>
      <details>
        <summary>JSON bruto para auditoria</summary>
        <pre>${esc(JSON.stringify(d, null, 2))}</pre>
      </details>
      <div id="validationSection">${renderValidationSection(item)}</div>`;
  wireValidationButton();
}

function renderValidationSection(item) {
  if (!item) return "";
  const v = state.validations[item.path];

  const btnLabel = v?.loading ? "Validandoâ€¦" : "Validar schema";
  const btnDisabled = v?.loading ? " disabled" : "";

  let resultHtml = "";
  if (v?.result) {
    if (v.result.ok) {
      resultHtml = `<div class="validation-bar valid">
        <span style="font-size:18px">âœ“</span>
        <span class="validation-label">Schema vÃ¡lido â€” artefato conforme com <code>artefato_pedagogico.schema.json</code>.</span>
      </div>`;
    } else {
      const rows = (v.result.details ?? []).map(e =>
        `<div class="validation-error-row">
          <span class="error-field">${esc(e.path)}</span>
          <span class="error-msg-text">${esc(e.message)}</span>
        </div>`
      ).join("");
      resultHtml = `<div class="validation-bar invalid">
        <span style="font-size:18px">âœ—</span>
        <span class="validation-label">${v.result.errors?.length ?? 0} erro(s) de schema encontrado(s).</span>
      </div>
      <div class="validation-errors">${rows}</div>`;
    }
  }

  return `<div style="margin-top:8px;display:flex;flex-direction:column;gap:8px">
    <div style="display:flex;align-items:center;gap:8px">
      <div class="field-label">ValidaÃ§Ã£o de schema</div>
          <button type="button" id="validateBtn"${btnDisabled}
            style="font-size:12px;padding:4px 10px">${btnLabel}</button>
    </div>
    ${resultHtml}
  </div>`;
}

function render() { renderList(); renderDetail(); }

/* â”€â”€ ValidaÃ§Ã£o â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */
async function triggerValidation() {
  const item = state.artifacts[state.selectedIndex];
  if (!item) return;
  state.validations[item.path] = { loading: true };
  refreshValidationSection(item);
  try {
    const body = item.virtual
      ? { artifact: item.data }
      : { file: item.path };
    const result = await postJSON("/api/validate", body);
    state.validations[item.path] = { loading: false, result };
  } catch (e) {
    state.validations[item.path] = {
      loading: false,
      result: { ok: false, errors: [e.message], details: [{ path: "<rede>", keyword: "fetch", message: e.message }] },
    };
  }
  refreshValidationSection(item);
  renderList();
}

function refreshValidationSection(item) {
  const sec = document.getElementById("validationSection");
  if (sec) {
    sec.innerHTML = renderValidationSection(item);
    wireValidationButton();
  }
}

function wireValidationButton() {
  document.getElementById("validateBtn")?.addEventListener("click", triggerValidation);
}

async function loadArtifacts() {
  els.list.innerHTML = `<div class="empty">Carregando artefatos...</div>`;
  els.panel.innerHTML = `<div class="empty">Carregando detalhes...</div>`;
  try {
    state.artifacts = await getJSON("/api/artifacts");
    state.selectedIndex = 0;
    render();
  } catch (err) {
    els.metrics.innerHTML = "";
    els.list.innerHTML = `<div class="empty">NÃ£o foi possÃ­vel carregar artefatos.</div>`;
    els.panel.innerHTML = `<p class="error-msg">Erro: ${esc(err.message)}</p>
      <p>Verifique se o servidor APDA estÃ¡ rodando: <code>apda web</code></p>`;
  }
}

async function loadFiles(files) {
  const additions = [];
  for (const f of files) {
    const raw = await f.text();
    additions.push({ label: f.name, path: f.name, virtual: true, data: JSON.parse(raw) });
  }
  state.artifacts = additions.concat(state.artifacts);
  state.selectedIndex = 0;
  render();
}

els.search.addEventListener("input", e => { state.query = e.target.value; renderList(); });

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("reloadBtn")?.addEventListener("click", loadArtifacts);

  const fileInput = document.getElementById("fileInput");
  fileInput?.addEventListener("change", async e => {
    try { await loadFiles(Array.from(e.target.files || [])); }
    catch (err) { els.panel.innerHTML = `<p class="error-msg">JSON invÃ¡lido: ${esc(err.message)}</p>`; }
    finally { e.target.value = ""; }
  });

  // Drag-and-drop global
  document.body.addEventListener("dragover", e => { e.preventDefault(); });
  document.body.addEventListener("drop", async e => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer?.files ?? []).filter(f => f.name.endsWith(".json"));
    if (!files.length) return;
    try { await loadFiles(files); }
    catch (err) { alert(`Erro ao carregar JSON: ${err.message}`); }
  });
});

loadArtifacts();


