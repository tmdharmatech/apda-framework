import test from "node:test";
import assert from "node:assert/strict";
import { startWebServer } from "../src/web.js";

const ROOT = process.cwd();

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function startServer() {
  const server = await startWebServer(ROOT, { port: 0, open: false });
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;

  async function get(path) {
    const res = await fetch(`${base}${path}`);
    return { status: res.status, body: await res.json() };
  }

  async function post(path, payload) {
    const res = await fetch(`${base}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return { status: res.status, body: await res.json() };
  }

  function close() {
    return new Promise((resolve) => server.close(resolve));
  }

  return { get, post, close };
}

// ---------------------------------------------------------------------------
// GET /api/workflows
// ---------------------------------------------------------------------------

test("GET /api/workflows retorna array com 31 workflows", async () => {
  const { get, close } = await startServer();
  try {
    const { status, body } = await get("/api/workflows");
    assert.strictEqual(status, 200);
    assert.ok(Array.isArray(body), "resposta deve ser um array");
    assert.strictEqual(body.length, 31);
    assert.ok(body.every((w) => w.id && w.name && w.steps));
  } finally {
    await close();
  }
});

test("GET /api/workflows?file=teste.docx retorna workflows de .docx", async () => {
  const { get, close } = await startServer();
  try {
    const { status, body } = await get(
      "/api/workflows?file=entrada/teste.docx",
    );
    assert.strictEqual(status, 200);
    assert.ok(Array.isArray(body));
    const ids = body.map((w) => w.id);
    assert.ok(ids.includes("docx-to-text"));
    assert.ok(ids.includes("docx-neural-single"), "era docx-to-apda-json");
    assert.ok(!ids.includes("validate-apda-json"), ".json workflow não deve aparecer para .docx");
  } finally {
    await close();
  }
});

test("GET /api/workflows?file=artefato.json retorna apenas validate-apda-json", async () => {
  const { get, close } = await startServer();
  try {
    const { status, body } = await get(
      "/api/workflows?file=saida/artefato.apda.json",
    );
    assert.strictEqual(status, 200);
    assert.deepEqual(
      body.map((w) => w.id),
      ["validate-apda-json"],
    );
  } finally {
    await close();
  }
});

// ---------------------------------------------------------------------------
// POST /api/validate
// ---------------------------------------------------------------------------

test("POST /api/validate com artefato válido retorna ok=true", async () => {
  const { post, close } = await startServer();
  try {
    const artifact = {
      tipo_artefato: "diario_aee",
      origem: {
        nome_arquivo: "teste.txt",
        formato_original: "txt",
        pagina_ou_aba: null,
      },
      conteudo_pedagogico: {
        objetivo_pedagogico: null,
        barreiras_identificadas: [],
        estrategias_pedagogicas: [],
        recursos_acessibilidade: [],
        observacoes_relevantes: null,
      },
      anonimizacao: {
        aplicada: true,
        itens_mascarados: ["private_person"],
        risco_reidentificacao: "nao_avaliado",
      },
      metadados_processamento: {
        pipeline_versao: "test",
        data_processamento: "2026-05-01T00:00:00",
        status: "pendente_revisao",
        confianca_extracao: "nao_calculada",
      },
      validacao_humana: {
        necessaria: true,
        status: "pendente",
        responsavel: null,
      },
    };
    const { status, body } = await post("/api/validate", { artifact });
    assert.strictEqual(status, 200);
    assert.strictEqual(body.ok, true);
    assert.deepEqual(body.errors, []);
  } finally {
    await close();
  }
});

test("POST /api/validate com artefato inválido retorna ok=false com erros", async () => {
  const { post, close } = await startServer();
  try {
    const { status, body } = await post("/api/validate", {
      artifact: { tipo_artefato: "tipo_invalido" },
    });
    assert.strictEqual(status, 200);
    assert.strictEqual(body.ok, false);
    assert.ok(Array.isArray(body.errors) && body.errors.length > 0);
  } finally {
    await close();
  }
});

test("POST /api/validate sem artifact nem file retorna 400", async () => {
  const { post, close } = await startServer();
  try {
    const { status, body } = await post("/api/validate", {});
    assert.strictEqual(status, 400);
    assert.ok(body.error);
  } finally {
    await close();
  }
});

// ---------------------------------------------------------------------------
// POST /api/run — validação de campos obrigatórios
// ---------------------------------------------------------------------------

test("POST /api/run sem file retorna 400", async () => {
  const { post, close } = await startServer();
  try {
    const { status, body } = await post("/api/run", { workflow: "extract-only" });
    assert.strictEqual(status, 400);
    assert.ok(body.error);
  } finally {
    await close();
  }
});

test("POST /api/run sem workflow retorna 400", async () => {
  const { post, close } = await startServer();
  try {
    const { status, body } = await post("/api/run", {
      file: "entrada/teste.docx",
    });
    assert.strictEqual(status, 400);
    assert.ok(body.error);
  } finally {
    await close();
  }
});

test("POST /api/run com file e workflow retorna 202 com runId", async () => {
  const { post, close } = await startServer();
  try {
    const { status, body } = await post("/api/run", {
      file: "entrada/teste.docx",
      workflow: "extract-only",
    });
    assert.strictEqual(status, 202);
    assert.ok(body.runId, "deve retornar runId");
    assert.strictEqual(body.status, "started");
  } finally {
    await close();
  }
});

// ---------------------------------------------------------------------------
// GET /api/runs
// ---------------------------------------------------------------------------

test("GET /api/runs retorna array", async () => {
  const { get, close } = await startServer();
  try {
    const { status, body } = await get("/api/runs");
    assert.strictEqual(status, 200);
    assert.ok(Array.isArray(body));
  } finally {
    await close();
  }
});

// ---------------------------------------------------------------------------
// Rota inexistente
// ---------------------------------------------------------------------------

test("rota inexistente retorna 404", async () => {
  const { get, close } = await startServer();
  try {
    const { status } = await get("/api/rota-que-nao-existe");
    assert.strictEqual(status, 404);
  } finally {
    await close();
  }
});
