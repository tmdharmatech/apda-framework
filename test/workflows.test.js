import test from "node:test";
import assert from "node:assert/strict";
import { getWorkflow, getWorkflowsForFile, listWorkflows } from "../src/workflows/registry.js";

test("registry expõe todos os 31 workflows canônicos", () => {
  const ids = listWorkflows().map((workflow) => workflow.id);
  // 7 workflows utilitários + 4 formatos × 3 modos de anon × 2 modos de pipeline = 24 gerados
  assert.strictEqual(ids.length, 31, `esperado 31 workflows, encontrado ${ids.length}`);

  // Utilitários sempre presentes
  assert.ok(ids.includes("extract-only"));
  assert.ok(ids.includes("anonymize-privacy-filter"));
  assert.ok(ids.includes("generate-apda-json"));
  assert.ok(ids.includes("validate-apda-json"));

  // Combinações geradas — IDs canônicos
  assert.ok(ids.includes("docx-neural-single"));   // era docx-to-apda-json
  assert.ok(ids.includes("txt-fast-single"));       // era txt-fast
  assert.ok(ids.includes("docx-regex-single"));     // era docx-regex-anon
  assert.ok(ids.includes("xlsx-regex-segment"));    // era xlsx-scan-regex
  assert.ok(ids.includes("docx-regex-segment"));    // era docx-scan-regex

  // Novas combinações geradas automaticamente (não existiam antes)
  assert.ok(ids.includes("txt-regex-segment"));
  assert.ok(ids.includes("pdf-fast-segment"));
  assert.ok(ids.includes("pdf-neural-segment"));
});

test("IDs legados são resolvidos como aliases por getWorkflow()", () => {
  // Resolução transparente de IDs antigos
  assert.strictEqual(getWorkflow("txt-fast")?.id,           "txt-fast-single");
  assert.strictEqual(getWorkflow("txt-regex-anon")?.id,     "txt-regex-single");
  assert.strictEqual(getWorkflow("txt-to-apda-json")?.id,   "txt-neural-single");
  assert.strictEqual(getWorkflow("txt-scan-fast")?.id,      "txt-fast-segment");
  assert.strictEqual(getWorkflow("txt-scan-and-segment")?.id, "txt-fast-segment");
  assert.strictEqual(getWorkflow("docx-to-apda-json")?.id,  "docx-neural-single");
  assert.strictEqual(getWorkflow("docx-regex-anon")?.id,    "docx-regex-single");
  assert.strictEqual(getWorkflow("docx-scan-regex")?.id,    "docx-regex-segment");
  assert.strictEqual(getWorkflow("xlsx-scan-regex")?.id,    "xlsx-regex-segment");
  assert.strictEqual(getWorkflow("pdf-fast")?.id,           "pdf-fast-single");
});

test("registry filtra workflows por extensão de arquivo — .docx", () => {
  const ids = getWorkflowsForFile("entrada/arquivo_teste.docx").map((w) => w.id);
  assert.strictEqual(ids.length, 8, `esperados 8 workflows para .docx, encontrado ${ids.length}`);
  assert.ok(ids.includes("extract-only"));
  assert.ok(ids.includes("docx-to-text"));
  assert.ok(ids.includes("docx-fast-single"));
  assert.ok(ids.includes("docx-regex-single"));
  assert.ok(ids.includes("docx-neural-single"));
  assert.ok(ids.includes("docx-fast-segment"));
  assert.ok(ids.includes("docx-regex-segment"));
  assert.ok(ids.includes("docx-neural-segment"));
  assert.ok(!ids.includes("txt-fast-single"), "workflow .txt não deve aparecer para .docx");
});

test("registry filtra workflows por extensão de arquivo — .json", () => {
  assert.deepEqual(
    getWorkflowsForFile("saida/artefato.apda.json").map((workflow) => workflow.id),
    ["validate-apda-json"],
  );
});

test("registry filtra workflows por extensão de arquivo — .txt", () => {
  const ids = getWorkflowsForFile("entrada/aula.txt").map((w) => w.id);
  assert.ok(ids.includes("anonymize-privacy-filter"));
  assert.ok(ids.includes("txt-neural-single"),  "era txt-to-apda-json");
  assert.ok(ids.includes("txt-fast-single"),    "era txt-fast");
  assert.ok(ids.includes("txt-regex-single"),   "era txt-regex-anon");
  assert.ok(ids.includes("txt-fast-segment"),   "era txt-scan-and-segment / txt-scan-fast");
  assert.ok(ids.includes("txt-regex-segment"),  "nova combinação gerada automaticamente");
  assert.ok(ids.includes("txt-neural-segment"), "nova combinação gerada automaticamente");
  assert.ok(!ids.includes("docx-fast-single"), "workflow .docx não deve aparecer para .txt");
});

test("workflow conhecido possui steps esperados (via alias legado)", () => {
  assert.deepEqual(getWorkflow("txt-to-apda-json").steps, [
    "privacy-filter",
    "generate-artifact",
    "validate-schema",
  ]);
});

test("getWorkflow retorna undefined para ID inexistente", () => {
  assert.strictEqual(getWorkflow("workflow-inexistente"), undefined);
});

test("todos os workflows possuem id, name, inputExtensions e steps", () => {
  for (const workflow of listWorkflows()) {
    assert.ok(typeof workflow.id === "string" && workflow.id.length > 0, `${workflow.id}: id inválido`);
    assert.ok(typeof workflow.name === "string" && workflow.name.length > 0, `${workflow.id}: name inválido`);
    assert.ok(Array.isArray(workflow.inputExtensions) && workflow.inputExtensions.length > 0, `${workflow.id}: inputExtensions inválido`);
    assert.ok(Array.isArray(workflow.steps) && workflow.steps.length > 0, `${workflow.id}: steps inválido`);
  }
});
