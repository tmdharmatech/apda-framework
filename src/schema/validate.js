import { readFile } from "node:fs/promises";
import path from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import { toAbsolute } from "../lib/paths.js";

let compiledValidator = null;

async function loadSchema(root) {
  const schemaPath = path.join(root, "schemas", "artefato_pedagogico.schema.json");
  return JSON.parse(await readFile(schemaPath, "utf8"));
}

async function getValidator(root) {
  if (compiledValidator) return compiledValidator;
  const schema = await loadSchema(root);
  const ajv = new Ajv2020({
    allErrors: true,
    strict: false,
    verbose: true,
  });
  compiledValidator = ajv.compile(schema);
  return compiledValidator;
}

function formatPath(error) {
  if (error.instancePath) {
    return error.instancePath
      .replace(/^\//, "")
      .replace(/\//g, ".") || "<raiz>";
  }
  if (error.params?.missingProperty) {
    const parent = error.instancePath
      ? error.instancePath.replace(/^\//, "").replace(/\//g, ".")
      : "";
    return parent ? `${parent}.${error.params.missingProperty}` : error.params.missingProperty;
  }
  return "<raiz>";
}

function formatAllowedValues(values) {
  if (!Array.isArray(values)) return null;
  return values.map((value) => JSON.stringify(value)).join(", ");
}

function humanMessage(error) {
  const field = formatPath(error);
  if (error.keyword === "required") {
    return `${field}: campo obrigatorio ausente.`;
  }
  if (error.keyword === "enum") {
    return `${field}: valor invalido; esperado um de ${formatAllowedValues(error.params?.allowedValues)}.`;
  }
  if (error.keyword === "type") {
    return `${field}: tipo invalido; esperado ${error.params?.type}.`;
  }
  if (error.keyword === "additionalProperties") {
    return `${field}: propriedade adicional nao permitida (${error.params?.additionalProperty}).`;
  }
  return `${field}: ${error.message ?? "erro de schema"}.`;
}

function normalizeAjvError(error) {
  return {
    path: formatPath(error),
    keyword: error.keyword,
    message: humanMessage(error),
    schemaPath: error.schemaPath,
    params: error.params,
  };
}

export async function validateArtifact(root, artifact) {
  const validate = await getValidator(root);
  const ok = validate(artifact);
  const details = ok ? [] : (validate.errors ?? []).map(normalizeAjvError);
  return {
    ok: Boolean(ok),
    errors: details.map((error) => error.message),
    details,
  };
}

export async function validateArtifactFile(root, filePath) {
  const absolute = toAbsolute(root, filePath);
  try {
    const artifact = JSON.parse(await readFile(absolute, "utf8"));
    const result = await validateArtifact(root, artifact);
    return { ...result, file: absolute };
  } catch (error) {
    const detail = {
      path: "<arquivo>",
      keyword: "parse",
      message: `JSON invalido ou arquivo inacessivel: ${error.message}`,
      schemaPath: null,
      params: {},
    };
    return {
      ok: false,
      file: absolute,
      errors: [detail.message],
      details: [detail],
    };
  }
}
