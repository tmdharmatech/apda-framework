/**
 * ServerStartView — feedback visual durante o início do llama-server.
 *
 * Usa React.createElement (sem JSX) para compatibilidade com ESM puro / Node >= 20
 * sem transpilador Babel.
 *
 * Eventos esperados do emitter:
 *   'server:spawned' → payload: pid (number) → fase 'waiting'
 *   'server:ready'   → sem payload            → fase 'ready'
 *   'server:error'   → payload: message (string) → fase 'error'
 */

import React, { useState, useEffect } from "react";
import { Box, Text } from "ink";
import Spinner from "ink-spinner";

const e = React.createElement;

/**
 * ServerStartView
 *
 * @param {object}       props
 * @param {string}       props.baseUrl  — URL base do llama-server (ex.: http://127.0.0.1:8091)
 * @param {EventEmitter} props.emitter  — emitter compartilhado com server.js
 */
export function ServerStartView({ baseUrl, emitter }) {
  const [phase, setPhase] = useState("spawning"); // 'spawning' | 'waiting' | 'ready' | 'error'
  const [pid, setPid] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  useEffect(() => {
    function onSpawned(spawnedPid) {
      setPid(spawnedPid);
      setPhase("waiting");
    }
    function onReady() {
      setPhase("ready");
    }
    function onError(message) {
      setErrorMsg(message);
      setPhase("error");
    }

    emitter.on("server:spawned", onSpawned);
    emitter.on("server:ready", onReady);
    emitter.on("server:error", onError);

    return () => {
      emitter.off("server:spawned", onSpawned);
      emitter.off("server:ready", onReady);
      emitter.off("server:error", onError);
    };
  }, [emitter]);

  if (phase === "spawning") {
    return e(
      Box,
      { flexDirection: "row", gap: 1 },
      e(Text, { color: "cyan" }, e(Spinner, { type: "dots" })),
      e(Text, null, "Iniciando llama-server..."),
    );
  }

  if (phase === "waiting") {
    return e(
      Box,
      { flexDirection: "row", gap: 1 },
      e(Text, { color: "cyan" }, e(Spinner, { type: "dots" })),
      e(
        Text,
        null,
        "Aguardando llama-server",
        pid != null ? e(Text, { dimColor: true }, ` (pid=${pid})`) : null,
        " responder em ",
        e(Text, { color: "cyan" }, baseUrl),
        "...",
      ),
    );
  }

  if (phase === "ready") {
    return e(
      Box,
      { flexDirection: "row", gap: 1 },
      e(Text, { color: "green", bold: true }, "✔ llama-server pronto:"),
      e(Text, { color: "cyan" }, baseUrl),
    );
  }

  // phase === 'error'
  return e(
    Box,
    { flexDirection: "column" },
    e(
      Box,
      { flexDirection: "row", gap: 1 },
      e(Text, { color: "red", bold: true }, "✘ Falha ao iniciar llama-server:"),
    ),
    errorMsg ? e(Text, { color: "red", wrap: "wrap" }, `  ${errorMsg}`) : null,
  );
}

export default ServerStartView;
