import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, writeFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { cpSync } from "node:fs";

import { runWorkflow } from "../src/workflows/run-workflow.js";
import { getWorkflow, listWorkflows } from "../src/workflows/registry.js";

async function startMetricsCaptureServer() {
  const payloads = [];
  const server = createServer((req, res) => {
    let body = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => {
      payloads.push(JSON.parse(body));
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end('{"ok":true}');
    });
  });

  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();
  return {
    payloads,
    url: `http://127.0.0.1:${port}/push`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
}

// ---------------------------------------------------------------------------
// Erros de entrada — ocorrem antes de qualquer renderização ink/React
// ---------------------------------------------------------------------------

test("runWorkflow lança erro para workflow inexistente", async () => {
  await assert.rejects(
    () => runWorkflow(process.cwd(), "workflow-inexistente", "qualquer.txt"),
    (err) => {
      assert.ok(err.message.includes("Workflow desconhecido"), err.message);
      return true;
    },
  );
});

test("runWorkflow lança erro para arquivo de entrada ausente", async () => {
  await assert.rejects(
    () =>
      runWorkflow(
        process.cwd(),
        "validate-apda-json",
        "caminho/que/nao/existe.json",
      ),
    (err) => {
      assert.ok(
        err.message.includes("nao encontrado") ||
          err.message.includes("não encontrado"),
        err.message,
      );
      return true;
    },
  );
});

test("runWorkflow lança erro quando extensão não é aceita pelo workflow", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "apda-test-"));
  const wrongFile = path.join(dir, "arquivo.xyz");
  await writeFile(wrongFile, "conteudo de teste");

  await assert.rejects(
    () => runWorkflow(dir, "docx-to-text", wrongFile),
    (err) => {
      assert.ok(
        err.message.includes(".xyz") || err.message.includes("nao aceita"),
        err.message,
      );
      return true;
    },
  );
});

test("runWorkflow lança erro quando arquivo .docx é passado para workflow txt", async () => {
  const dir = await mkdtemp(path.join(tmpdir(), "apda-test-"));
  const wrongFile = path.join(dir, "arquivo.docx");
  await writeFile(wrongFile, "conteudo");

  await assert.rejects(
    () => runWorkflow(dir, "anonymize-privacy-filter", wrongFile),
    (err) => {
      assert.ok(
        err.message.includes(".docx") || err.message.includes("nao aceita"),
        err.message,
      );
      return true;
    },
  );
});

// ---------------------------------------------------------------------------
// Registry — testes de contrato adicionais
// ---------------------------------------------------------------------------

test("todos os IDs de workflow são únicos", () => {
  const ids = listWorkflows().map((w) => w.id);
  const uniqueIds = new Set(ids);
  assert.strictEqual(
    uniqueIds.size,
    ids.length,
    `IDs duplicados encontrados: ${ids.filter((id, i) => ids.indexOf(id) !== i).join(", ")}`,
  );
});

test("workflow validate-apda-json aceita apenas .json", () => {
  const workflow = getWorkflow("validate-apda-json");
  assert.deepEqual(workflow.inputExtensions, [".json"]);
});

test("workflow extract-only aceita múltiplos formatos", () => {
  const workflow = getWorkflow("extract-only");
  assert.ok(workflow.inputExtensions.includes(".docx"));
  assert.ok(workflow.inputExtensions.includes(".xlsx"));
  assert.ok(workflow.inputExtensions.includes(".pdf"));
});

test("steps de validate-schema aparecem apenas em workflows com geração de artefato", () => {
  const comValidacao = listWorkflows().filter((w) =>
    w.steps.includes("validate-schema"),
  );
  for (const w of comValidacao) {
    const temGerador =
      w.steps.includes("generate-artifact") ||
      w.steps.includes("generate-from-manifest") ||
      w.id === "validate-apda-json";
    assert.ok(
      temGerador,
      `Workflow ${w.id} tem validate-schema mas não tem gerador`,
    );
  }
});

test("nenhum workflow tem steps vazios ou duplicados", () => {
  for (const workflow of listWorkflows()) {
    assert.ok(
      workflow.steps.length > 0,
      `Workflow ${workflow.id} tem steps vazios`,
    );
    const uniqueSteps = new Set(workflow.steps);
    assert.strictEqual(
      uniqueSteps.size,
      workflow.steps.length,
      `Workflow ${workflow.id} tem steps duplicados`,
    );
  }
});

test("runWorkflow envia metricas de step e pipeline pelo runner", async (t) => {
  const dir = await mkdtemp(path.join(tmpdir(), "apda-test-"));
  const inputFile = path.join(dir, "artefato.json");
  await writeFile(inputFile, "{}");
  const metrics = await startMetricsCaptureServer();
  t.after(() => metrics.close());

  await runWorkflow(dir, "validate-apda-json", inputFile, {
    dryRun: true,
    record: false,
    metricsUrl: metrics.url,
    metricsTimeoutMs: 500,
  });

  const stepMetric = metrics.payloads.find((payload) => payload.action === "step");
  const pipelineMetric = metrics.payloads.find(
    (payload) => payload.action === "pipeline",
  );

  assert.ok(stepMetric, "metrica de step nao foi enviada");
  assert.ok(pipelineMetric, "metrica de pipeline nao foi enviada");
  assert.equal(stepMetric.workflow, "validate-apda-json");
  assert.equal(stepMetric.step, "validate-schema");
  assert.equal(stepMetric.status, "dry-run");
  assert.equal(stepMetric.input_bytes, 2);
  assert.equal(pipelineMetric.workflow, "validate-apda-json");
  assert.equal(pipelineMetric.status, "dry-run");
  assert.equal(pipelineMetric.steps_executed, 1);
});
