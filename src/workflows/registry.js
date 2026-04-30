import path from "node:path";

const workflows = [
  {
    id: "extract-only",
    name: "Extrair texto",
    inputExtensions: [".docx", ".xlsx", ".xls", ".pdf"],
    steps: ["extract-text"],
  },
  {
    id: "docx-to-text",
    name: "DOCX -> texto extraido",
    inputExtensions: [".docx"],
    steps: ["extract-text"],
  },
  {
    id: "xlsx-to-text",
    name: "XLSX/XLS -> texto extraido",
    inputExtensions: [".xlsx", ".xls"],
    steps: ["extract-text"],
  },
  {
    id: "pdf-to-text",
    name: "PDF -> texto extraido",
    inputExtensions: [".pdf"],
    steps: ["extract-text"],
  },
  {
    id: "anonymize-privacy-filter",
    name: "TXT -> Privacy Filter",
    inputExtensions: [".txt"],
    steps: ["privacy-filter"],
  },
  {
    id: "generate-apda-json",
    name: "TXT anonimizado -> JSON APDA",
    inputExtensions: [".txt"],
    steps: ["generate-artifact"],
  },
  {
    id: "validate-apda-json",
    name: "Validar JSON APDA",
    inputExtensions: [".json"],
    steps: ["validate-schema"],
  },
  {
    id: "txt-to-apda-json",
    name: "TXT -> Privacy Filter -> JSON APDA -> validacao",
    inputExtensions: [".txt"],
    steps: ["privacy-filter", "generate-artifact", "validate-schema"],
  },
  {
    id: "docx-to-apda-json",
    name: "DOCX -> texto -> Privacy Filter -> JSON APDA -> validacao",
    inputExtensions: [".docx"],
    steps: [
      "extract-text",
      "privacy-filter",
      "generate-artifact",
      "validate-schema",
    ],
  },
  {
    id: "xlsx-to-apda-json",
    name: "XLSX/XLS -> texto -> Privacy Filter -> JSON APDA -> validacao",
    inputExtensions: [".xlsx", ".xls"],
    steps: [
      "extract-text",
      "privacy-filter",
      "generate-artifact",
      "validate-schema",
    ],
  },
  {
    id: "pdf-to-apda-json",
    name: "PDF -> texto -> Privacy Filter -> JSON APDA -> validacao",
    inputExtensions: [".pdf"],
    steps: [
      "extract-text",
      "privacy-filter",
      "generate-artifact",
      "validate-schema",
    ],
  },
  {
    id: "xlsx-scan-and-segment",
    name: "XLSX → varredura → segmentos → APDA por segmento",
    inputExtensions: [".xlsx", ".xls"],
    steps: [
      "extract-text",
      "privacy-filter",
      "scan-segments",
      "generate-from-manifest",
      "validate-schema",
    ],
  },
  {
    id: "txt-scan-and-segment",
    name: "TXT anonimizado → varredura → APDA por segmento",
    inputExtensions: [".txt"],
    steps: ["scan-segments", "generate-from-manifest", "validate-schema"],
  },
  {
    id: "docx-scan-and-segment",
    name: "DOCX → varredura → segmentos → APDA por segmento",
    inputExtensions: [".docx"],
    steps: [
      "extract-text",
      "privacy-filter",
      "scan-segments",
      "generate-from-manifest",
      "validate-schema",
    ],
  },

  // ── Eixo 1: Produção rápida (sem anonimização — dados fictícios ou pré-anonimizados)

  {
    id: "txt-fast",
    name: "TXT → JSON APDA (sem anonimização)",
    inputExtensions: [".txt"],
    steps: ["generate-artifact", "validate-schema"],
  },
  {
    id: "docx-fast",
    name: "DOCX → texto → JSON APDA (sem anonimização)",
    inputExtensions: [".docx"],
    steps: ["extract-text", "generate-artifact", "validate-schema"],
  },
  {
    id: "xlsx-fast",
    name: "XLSX → texto → JSON APDA (sem anonimização)",
    inputExtensions: [".xlsx", ".xls"],
    steps: ["extract-text", "generate-artifact", "validate-schema"],
  },
  {
    id: "pdf-fast",
    name: "PDF → texto → JSON APDA (sem anonimização)",
    inputExtensions: [".pdf"],
    steps: ["extract-text", "generate-artifact", "validate-schema"],
  },

  // ── Eixo 2: Anonimização leve (regex — sem GPU)

  {
    id: "txt-regex-anon",
    name: "TXT → regex-anon → JSON APDA",
    inputExtensions: [".txt"],
    steps: ["regex-anon", "generate-artifact", "validate-schema"],
  },
  {
    id: "docx-regex-anon",
    name: "DOCX → texto → regex-anon → JSON APDA",
    inputExtensions: [".docx"],
    steps: ["extract-text", "regex-anon", "generate-artifact", "validate-schema"],
  },
  {
    id: "xlsx-regex-anon",
    name: "XLSX → texto → regex-anon → JSON APDA",
    inputExtensions: [".xlsx", ".xls"],
    steps: ["extract-text", "regex-anon", "generate-artifact", "validate-schema"],
  },
  {
    id: "pdf-regex-anon",
    name: "PDF → texto → regex-anon → JSON APDA",
    inputExtensions: [".pdf"],
    steps: ["extract-text", "regex-anon", "generate-artifact", "validate-schema"],
  },

  // ── Eixo 3: Segmentação multi-artefato (sem Privacy Filter neural)

  {
    id: "txt-scan-fast",
    name: "TXT → varredura → APDA por segmento (sem anonimização)",
    inputExtensions: [".txt"],
    steps: ["scan-segments", "generate-from-manifest", "validate-schema"],
  },
  {
    id: "xlsx-scan-fast",
    name: "XLSX → texto → varredura → APDA por segmento (sem anonimização)",
    inputExtensions: [".xlsx", ".xls"],
    steps: ["extract-text", "scan-segments", "generate-from-manifest", "validate-schema"],
  },
  {
    id: "docx-scan-fast",
    name: "DOCX → texto → varredura → APDA por segmento (sem anonimização)",
    inputExtensions: [".docx"],
    steps: ["extract-text", "scan-segments", "generate-from-manifest", "validate-schema"],
  },
  {
    id: "xlsx-scan-regex",
    name: "XLSX → texto → regex-anon → varredura → APDA por segmento",
    inputExtensions: [".xlsx", ".xls"],
    steps: [
      "extract-text",
      "regex-anon",
      "scan-segments",
      "generate-from-manifest",
      "validate-schema",
    ],
  },
  {
    id: "docx-scan-regex",
    name: "DOCX → texto → regex-anon → varredura → APDA por segmento",
    inputExtensions: [".docx"],
    steps: [
      "extract-text",
      "regex-anon",
      "scan-segments",
      "generate-from-manifest",
      "validate-schema",
    ],
  },
];

export function listWorkflows() {
  return workflows;
}

export function getWorkflow(id) {
  return workflows.find((workflow) => workflow.id === id);
}

export function getWorkflowsForFile(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  return workflows.filter((workflow) =>
    workflow.inputExtensions.includes(extension),
  );
}
