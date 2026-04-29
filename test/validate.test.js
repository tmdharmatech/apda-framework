import test from "node:test";
import assert from "node:assert/strict";
import { validateArtifact } from "../src/schema/validate.js";

const root = process.cwd();

test("validateArtifact accepts a minimal APDA artifact matching the JSON Schema", async () => {
  const result = await validateArtifact(root, {
    tipo_artefato: "diario_aee",
    origem: {
      nome_arquivo: "arquivo.txt",
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
    metadados_processamento: {
      pipeline_versao: "test",
      data_processamento: "2026-04-29T00:00:00.000Z",
      status: "pendente_revisao",
      confianca_extracao: "nao_calculada",
    },
    validacao_humana: {
      necessaria: true,
      status: "pendente",
      responsavel: null,
    },
  });
  assert.equal(result.ok, true);
  assert.deepEqual(result.details, []);
});

test("validateArtifact reports schema paths for invalid artifacts", async () => {
  const result = await validateArtifact(root, { tipo_artefato: "invalido" });
  assert.equal(result.ok, false);
  assert.ok(result.details.some((error) => error.path === "origem" && error.keyword === "required"));
  assert.ok(result.details.some((error) => error.path === "tipo_artefato" && error.keyword === "enum"));
});
