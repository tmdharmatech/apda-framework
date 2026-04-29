import test from "node:test";
import assert from "node:assert/strict";
import { getWorkflow, getWorkflowsForFile, listWorkflows } from "../src/workflows/registry.js";

test("registry exposes granular workflows", () => {
  const ids = listWorkflows().map((workflow) => workflow.id);
  assert.ok(ids.includes("extract-only"));
  assert.ok(ids.includes("anonymize-privacy-filter"));
  assert.ok(ids.includes("generate-apda-json"));
  assert.ok(ids.includes("validate-apda-json"));
  assert.ok(ids.includes("docx-to-apda-json"));
});

test("registry filters workflows by file extension", () => {
  assert.deepEqual(
    getWorkflowsForFile("entrada/arquivo_teste.docx").map((workflow) => workflow.id),
    ["extract-only", "docx-to-text", "docx-to-apda-json", "docx-scan-and-segment"],
  );
  assert.deepEqual(
    getWorkflowsForFile("saida/artefato.apda.json").map((workflow) => workflow.id),
    ["validate-apda-json"],
  );
});

test("known workflow has expected steps", () => {
  assert.deepEqual(getWorkflow("txt-to-apda-json").steps, [
    "privacy-filter",
    "generate-artifact",
    "validate-schema",
  ]);
});
