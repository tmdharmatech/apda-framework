/**
 * HelpView — tela de ajuda completa do APDA CLI.
 *
 * Usa React.createElement (sem JSX) para compatibilidade com ESM puro / Node >= 20
 * sem transpilador Babel.
 */

import React from "react";
import { Box, Text } from "ink";

const e = React.createElement;

// ─────────────────────────────────────────────────────────────────────────────
// Helpers internos
// ─────────────────────────────────────────────────────────────────────────────

/** Grupo de comandos com título de seção. */
function CmdGroup({ title, children }) {
  return e(
    Box,
    { flexDirection: "column", marginBottom: 1 },
    e(Text, { color: "cyan", bold: true }, title),
    children,
  );
}

/**
 * Uma linha de comando.
 * @param {object} props
 * @param {string}  props.cmd   — o comando (ex.: "apda doctor")
 * @param {string}  [props.desc] — descrição curta exibida à direita
 */
function Cmd({ cmd, desc }) {
  return e(
    Box,
    { flexDirection: "row" },
    e(Text, { color: "green" }, `  ${cmd}`),
    desc
      ? e(Text, { dimColor: true }, `   # ${desc}`)
      : null,
  );
}

/** Separador horizontal visual. */
function Sep() {
  return e(Text, { dimColor: true }, "─".repeat(60));
}

// ─────────────────────────────────────────────────────────────────────────────
// Componente principal
// ─────────────────────────────────────────────────────────────────────────────

export function HelpView() {
  return e(
    Box,
    {
      flexDirection: "column",
      borderStyle: "round",
      borderColor: "cyan",
      paddingX: 2,
      paddingY: 1,
    },

    // ── Cabeçalho ──────────────────────────────────────────────────────────
    e(
      Box,
      { flexDirection: "row", marginBottom: 1 },
      e(Text, { bold: true, color: "whiteBright" }, "APDA CLI  "),
      e(Text, { dimColor: true }, "— comandos disponíveis"),
    ),
    e(Sep),
    e(Box, { height: 1 }),

    // ── Diagnóstico ────────────────────────────────────────────────────────
    e(
      CmdGroup,
      { title: "🩺  Diagnóstico" },
      e(Cmd, { cmd: "apda doctor",        desc: "mostra relatório visual do ambiente" }),
      e(Cmd, { cmd: "apda doctor --json", desc: "emite o relatório em JSON puro" }),
    ),

    // ── Servidor LLM ───────────────────────────────────────────────────────
    e(
      CmdGroup,
      { title: "🦙  Servidor LLM (llama-server)" },
      e(Cmd, { cmd: "apda server status",  desc: "verifica se o servidor está ativo" }),
      e(Cmd, { cmd: "apda server start",   desc: "inicia o llama-server com a config salva" }),
      e(Cmd, { cmd: "apda server stop",    desc: "encerra o llama-server gerenciado" }),
      e(Cmd, { cmd: "apda server command", desc: "exibe o comando equivalente sem executar" }),
    ),

    // ── Execução de workflows ──────────────────────────────────────────────
    e(
      CmdGroup,
      { title: "▶  Execução" },
      e(Cmd, {
        cmd: "apda run --file entrada/doc.docx --workflow docx-to-apda-json",
        desc: "executa um workflow num arquivo",
      }),
      e(Cmd, {
        cmd: "apda run --file ... --workflow ... --dry-run",
        desc: "simula sem chamar o LLM",
      }),
      e(Cmd, { cmd: "apda runs",          desc: "lista as últimas 20 execuções" }),
      e(Cmd, { cmd: "apda runs show <id>", desc: "detalha uma execução específica" }),
    ),

    // ── Utilitários ────────────────────────────────────────────────────────
    e(
      CmdGroup,
      { title: "🔧  Utilitários" },
      e(Cmd, { cmd: "apda list-gpus",   desc: "lista GPUs detectadas no sistema" }),
      e(Cmd, { cmd: "apda list-models", desc: "lista modelos .gguf em modelos/" }),
      e(Cmd, { cmd: "apda list-inputs", desc: "lista arquivos suportados em entrada/" }),
      e(Cmd, {
        cmd: "apda workflows",
        desc: "lista todos os workflows disponíveis",
      }),
      e(Cmd, {
        cmd: "apda workflows --file entrada/doc.docx",
        desc: "filtra workflows compatíveis com o arquivo",
      }),
      e(Cmd, {
        cmd: "apda validate saida/artefato.json",
        desc: "valida artefato contra o schema APDA",
      }),
      e(Cmd, {
        cmd: "apda validate saida/artefato.json --json",
        desc: "resultado da validação em JSON",
      }),
    ),

    // ── Stack de observabilidade ───────────────────────────────────────────
    e(
      CmdGroup,
      { title: "📊  Stack de Observabilidade (LiteLLM + Prometheus + Grafana)" },
      e(Cmd, { cmd: "apda stack status",       desc: "mostra o estado de todos os serviços" }),
      e(Cmd, { cmd: "apda stack status --json", desc: "emite o estado em JSON" }),
      e(Cmd, { cmd: "apda stack start",        desc: "inicia LiteLLM, Prometheus, Grafana e métricas" }),
      e(Cmd, { cmd: "apda stack stop",         desc: "encerra todo o stack" }),
      e(Cmd, { cmd: "apda stack logs",         desc: "exibe últimas linhas do log do LiteLLM" }),
      e(Cmd, { cmd: "apda stack logs litellm", desc: "log de um serviço específico" }),
    ),

    // ── Interface Web ──────────────────────────────────────────────────────
    e(
      CmdGroup,
      { title: "🌐  Interface Web" },
      e(Cmd, { cmd: "apda web",            desc: "inicia o servidor web na porta 3000" }),
      e(Cmd, { cmd: "apda web --port 8090", desc: "inicia na porta especificada" }),
    ),

    // ── Onboarding ─────────────────────────────────────────────────────────
    e(
      CmdGroup,
      { title: "🚀  Onboarding interativo" },
      e(Cmd, { cmd: "apda onboard",           desc: "inicia o fluxo guiado de configuração" }),
      e(Cmd, { cmd: "apda onboard --dry-run",  desc: "simula o fluxo sem executar etapas reais" }),
    ),

    // ── Rodapé ─────────────────────────────────────────────────────────────
    e(Sep),
    e(
      Box,
      { marginTop: 1 },
      e(Text, { dimColor: true }, "Dica: "),
      e(Text, { color: "yellow" }, "apda doctor"),
      e(Text, { dimColor: true }, " é o ponto de partida para diagnosticar problemas no ambiente."),
    ),
  );
}

export default HelpView;
