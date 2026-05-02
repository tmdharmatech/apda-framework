import path from "node:path";

// ── Eixo de formato ───────────────────────────────────────────────────────────
// Ao adicionar um novo formato (ex: .odt), basta inserir uma entrada aqui.
const FORMATS = [
  { id: "txt",  label: "TXT",      extensions: [".txt"],          steps: [] },
  { id: "docx", label: "DOCX",     extensions: [".docx"],         steps: ["extract-text"] },
  { id: "xlsx", label: "XLSX/XLS", extensions: [".xlsx", ".xls"], steps: ["extract-text"] },
  { id: "pdf",  label: "PDF",      extensions: [".pdf"],          steps: ["extract-text"] },
];

// ── Eixo de anonimização ──────────────────────────────────────────────────────
const ANON_MODES = [
  { id: "fast",   label: null,             steps: [] },
  { id: "regex",  label: "regex-anon",     steps: ["regex-anon"] },
  { id: "neural", label: "Privacy Filter", steps: ["privacy-filter"] },
];

// ── Eixo de pipeline ──────────────────────────────────────────────────────────
const PIPELINE_MODES = [
  {
    id: "single",
    label: "JSON APDA → validação",
    steps: ["generate-artifact", "validate-schema"],
  },
  {
    id: "segment",
    label: "varredura → APDA por segmento → validação",
    steps: ["scan-segments", "validate-manifest", "generate-from-manifest", "validate-schema"],
  },
];

// ── Geração automática de workflows ──────────────────────────────────────────
function buildName(fmt, anon, pipeline) {
  const parts = [fmt.label];
  if (anon.label) parts.push(anon.label);
  parts.push(pipeline.label);
  return parts.join(" → ");
}

const generatedWorkflows = FORMATS.flatMap((fmt) =>
  ANON_MODES.flatMap((anon) =>
    PIPELINE_MODES.map((pipeline) => ({
      id: `${fmt.id}-${anon.id}-${pipeline.id}`,
      name: buildName(fmt, anon, pipeline),
      inputExtensions: fmt.extensions,
      steps: [...fmt.steps, ...anon.steps, ...pipeline.steps],
    })),
  ),
);

// ── Workflows utilitários (não se encaixam no modelo 3-eixos) ─────────────────
// Mantidos explicitamente: pipelines parciais, validação avulsa e extração pura.
const specialWorkflows = [
  {
    id: "extract-only",
    name: "Extrair texto",
    inputExtensions: [".docx", ".xlsx", ".xls", ".pdf"],
    steps: ["extract-text"],
  },
  {
    id: "docx-to-text",
    name: "DOCX → texto extraído",
    inputExtensions: [".docx"],
    steps: ["extract-text"],
  },
  {
    id: "xlsx-to-text",
    name: "XLSX/XLS → texto extraído",
    inputExtensions: [".xlsx", ".xls"],
    steps: ["extract-text"],
  },
  {
    id: "pdf-to-text",
    name: "PDF → texto extraído",
    inputExtensions: [".pdf"],
    steps: ["extract-text"],
  },
  {
    id: "anonymize-privacy-filter",
    name: "TXT → Privacy Filter",
    inputExtensions: [".txt"],
    steps: ["privacy-filter"],
  },
  {
    id: "generate-apda-json",
    name: "TXT anonimizado → JSON APDA",
    inputExtensions: [".txt"],
    steps: ["generate-artifact"],
  },
  {
    id: "validate-apda-json",
    name: "Validar JSON APDA",
    inputExtensions: [".json"],
    steps: ["validate-schema"],
  },
];

// ── Registry completo ─────────────────────────────────────────────────────────
const allWorkflows = [...specialWorkflows, ...generatedWorkflows];

// ── Aliases de retrocompatibilidade ──────────────────────────────────────────
// Mapeiam IDs legados para IDs canônicos gerados.
// getWorkflow() resolve aliases transparentemente; listWorkflows() retorna apenas canônicos.
const LEGACY_ALIASES = {
  "txt-fast":           "txt-fast-single",
  "txt-regex-anon":     "txt-regex-single",
  "txt-to-apda-json":   "txt-neural-single",
  "txt-scan-fast":      "txt-fast-segment",
  "txt-scan-and-segment": "txt-fast-segment",

  "docx-fast":          "docx-fast-single",
  "docx-regex-anon":    "docx-regex-single",
  "docx-to-apda-json":  "docx-neural-single",
  "docx-scan-fast":     "docx-fast-segment",
  "docx-scan-regex":    "docx-regex-segment",
  "docx-scan-and-segment": "docx-neural-segment",

  "xlsx-fast":          "xlsx-fast-single",
  "xlsx-regex-anon":    "xlsx-regex-single",
  "xlsx-to-apda-json":  "xlsx-neural-single",
  "xlsx-scan-fast":     "xlsx-fast-segment",
  "xlsx-scan-regex":    "xlsx-regex-segment",
  "xlsx-scan-and-segment": "xlsx-neural-segment",

  "pdf-fast":           "pdf-fast-single",
  "pdf-regex-anon":     "pdf-regex-single",
  "pdf-to-apda-json":   "pdf-neural-single",
};

// ── API pública ───────────────────────────────────────────────────────────────

export function listWorkflows() {
  return allWorkflows;
}

export function getWorkflow(id) {
  const direct = allWorkflows.find((w) => w.id === id);
  if (direct) return direct;

  const canonicalId = LEGACY_ALIASES[id];
  if (canonicalId) return allWorkflows.find((w) => w.id === canonicalId);

  return undefined;
}

export function getWorkflowsForFile(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  return allWorkflows.filter((w) => w.inputExtensions.includes(extension));
}
