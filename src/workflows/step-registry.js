import path from "node:path";

/**
 * STEP_REGISTRY mapeia IDs de steps para sua configuração de execução.
 *
 * Cada entrada descreve um step Python do pipeline:
 *   script    — caminho relativo ao script Python (a partir da raiz do projeto)
 *   argsFrom  — recebe o contexto de execução e retorna o array de args CLI
 *   afterRun  — hook opcional chamado após execução bem-sucedida para mutar o contexto
 *   checkFile — função opcional que retorna { path, error } para validar saída gerada
 *
 * O step "validate-schema" é tratado nativamente em JS e intencionalmente
 * ausente deste registro.
 */
export const STEP_REGISTRY = {
  "extract-text": {
    script: "scripts/01_extrair_texto.py",
    argsFrom: (ctx) => ["--input", ctx.inputPath, "--output", ctx.extracted],
    inputPaths: (ctx) => [ctx.inputPath],
    outputPaths: (ctx) => [ctx.extracted],
    afterRun: (ctx) => {
      ctx.currentText = ctx.extracted;
    },
    checkFile: (ctx) => ({
      path: ctx.extracted,
      error: `Texto extraido esperado nao foi gerado: ${ctx.extracted}`,
    }),
  },

  "privacy-filter": {
    script: "scripts/04_privacy_filter_anonimizar.py",
    argsFrom: (ctx) => ["--input", ctx.currentText, "--output", ctx.anonymized],
    inputPaths: (ctx) => [ctx.currentText],
    outputPaths: (ctx) => [ctx.anonymized],
    afterRun: (ctx) => {
      ctx.currentText = ctx.anonymized;
    },
  },

  "regex-anon": {
    script: "scripts/02_anonimizar_texto.py",
    argsFrom: (ctx) => ["--input", ctx.currentText, "--output", ctx.regexOut],
    inputPaths: (ctx) => [ctx.currentText],
    outputPaths: (ctx) => [ctx.regexOut],
    afterRun: (ctx) => {
      ctx.currentText = ctx.regexOut;
    },
    checkFile: (ctx) => ({
      path: ctx.regexOut,
      error: `Texto anonimizado (regex) nao gerado: ${ctx.regexOut}`,
    }),
  },

  "scan-segments": {
    script: "scripts/02_scan_segments.py",
    argsFrom: (ctx) => [
      "--input", ctx.currentText,
      "--output", ctx.manifest,
      "--base-url", ctx.baseUrl,
    ],
    inputPaths: (ctx) => [ctx.currentText],
    outputPaths: (ctx) => [ctx.manifest],
    checkFile: (ctx) => ({
      path: ctx.manifest,
      error: `Manifesto de segmentos nao gerado: ${ctx.manifest}`,
    }),
  },

  "generate-from-manifest": {
    script: "scripts/07_gerar_de_manifesto.py",
    argsFrom: (ctx) => [
      "--manifest", ctx.manifest,
      "--input", ctx.currentText,
      "--output-dir", path.join(ctx.root, "saida"),
      "--base-url", ctx.baseUrl,
    ],
    inputPaths: (ctx) => [ctx.manifest, ctx.currentText],
    outputPaths: (ctx) => [ctx.outputDir],
  },

  "generate-artifact": {
    script: "scripts/05_gerar_artefato_3b.py",
    argsFrom: (ctx) => {
      const args = [
        "--input", ctx.currentText,
        "--output", ctx.artifact,
        "--base-url", ctx.baseUrl,
      ];
      if (ctx.litellm) args.push("--litellm");
      if (ctx.modelo) args.push("--modelo", ctx.modelo);
      if (ctx.municipio) args.push("--municipio", ctx.municipio);
      return args;
    },
    inputPaths: (ctx) => [ctx.currentText],
    outputPaths: (ctx) => [ctx.artifact],
    afterRun: (ctx) => {
      ctx.currentArtifact = ctx.artifact;
    },
  },
};
