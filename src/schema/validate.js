import { readFile } from "node:fs/promises";
import path from "node:path";
import Ajv2020 from "ajv/dist/2020.js";
import { toAbsolute } from "../lib/paths.js";

const validatorCache = new Map();

async function loadSchema(root, schemaName) {
  const schemaPath = path.join(root, "schemas", schemaName);
  return JSON.parse(await readFile(schemaPath, "utf8"));
}

async function getValidator(root, schemaName) {
  const cacheKey = `${root}::${schemaName}`;
  if (validatorCache.has(cacheKey)) return validatorCache.get(cacheKey);

  const schema = await loadSchema(root, schemaName);
  const ajv = new Ajv2020({
    allErrors: true,
    strict: false,
    verbose: true,
  });
  const compiled = ajv.compile(schema);
  validatorCache.set(cacheKey, compiled);
  return compiled;
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

async function validateAgainstSchema(root, data, schemaName) {
  const validate = await getValidator(root, schemaName);
  const ok = validate(data);
  const details = ok ? [] : (validate.errors ?? []).map(normalizeAjvError);
  return {
    ok: Boolean(ok),
    errors: details.map((error) => error.message),
    details,
  };
}

async function validateFileAgainstSchema(root, filePath, schemaName) {
  const absolute = toAbsolute(root, filePath);
  try {
    const data = JSON.parse(await readFile(absolute, "utf8"));
    const result = await validateAgainstSchema(root, data, schemaName);
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

export async function validateArtifact(root, artifact) {
  return validateAgainstSchema(root, artifact, "artefato_pedagogico.schema.json");
}

export async function validateArtifactFile(root, filePath) {
  return validateFileAgainstSchema(root, filePath, "artefato_pedagogico.schema.json");
}

export async function validateManifest(root, manifest) {
  return validateAgainstSchema(root, manifest, "manifesto_segmentos.schema.json");
}

export async function validateManifestFile(root, filePath) {
  return validateFileAgainstSchema(root, filePath, "manifesto_segmentos.schema.json");
}
