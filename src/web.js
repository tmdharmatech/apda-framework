import { createServer } from "node:http";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { exec } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { respond } from "./lib/http.js";
import { handleDoctor } from "./api/doctor.js";
import { handleGpus, handleInputs, handleModels } from "./api/environment.js";
import { handleRuns, handleRunById } from "./api/runs.js";
import { handleArtifacts } from "./api/artifacts.js";
import { handleBenchmarks } from "./api/benchmarks.js";
import { handleValidate } from "./api/validate.js";
import {
  handleServerStatus,
  handleServerStart,
  handleServerStop,
  handleServerCommand,
  handleServerLog,
} from "./api/server-api.js";
import {
  handleWorkflows,
  handleRun,
  handleRunSync,
  handleRunStream,
} from "./api/workflows-api.js";

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".css":  "text/css; charset=utf-8",
  ".js":   "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".ico":  "image/x-icon",
  ".png":  "image/png",
  ".svg":  "image/svg+xml",
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FRONTEND = path.resolve(__dirname, "../frontend");

async function serveStatic(req, res) {
  let urlPath = new URL(req.url, "http://localhost").pathname;

  if (urlPath === "/" || urlPath === "") urlPath = "/index.html";

  const filePath = path.join(FRONTEND, urlPath);

  if (!filePath.startsWith(FRONTEND)) {
    res.writeHead(403);
    res.end("Proibido.");
    return;
  }

  if (!existsSync(filePath)) {
    res.writeHead(404);
    res.end("Nao encontrado.");
    return;
  }

  const ext = path.extname(filePath).toLowerCase();
  const mime = MIME[ext] ?? "application/octet-stream";
  const body = await readFile(filePath);
  res.writeHead(200, { "Content-Type": mime, "Content-Length": body.length });
  res.end(body);
}

function routeApi(root, req, res) {
  const url = new URL(req.url, "http://localhost");
  const route = url.pathname;
  const wrapped = respond(res);

  const match = (method, pattern) => {
    if (method !== "*" && req.method !== method) return null;
    if (typeof pattern === "string") return route === pattern ? {} : null;
    const m = route.match(pattern);
    return m ? m.groups ?? {} : null;
  };

  const handle = (fn, params = {}) => fn(root, req, wrapped, ...Object.values(params)).catch((err) => {
    wrapped.status(500).json({ error: err.message });
  });

  if (match("GET", "/api/doctor"))         return handle(handleDoctor);
  if (match("GET", "/api/gpus"))           return handle(handleGpus);
  if (match("GET", "/api/models"))         return handle(handleModels);
  if (match("GET", "/api/inputs"))         return handle(handleInputs);
  if (match("GET", "/api/workflows"))      return handle(handleWorkflows);
  if (match("GET", "/api/artifacts"))      return handle(handleArtifacts);
  if (match("GET", "/api/benchmarks"))     return handle(handleBenchmarks);
  if (match("GET", "/api/server/status"))  return handle(handleServerStatus);
  if (match("GET", "/api/server/command")) return handle(handleServerCommand);
  if (match("GET", "/api/server/log"))     return handle(handleServerLog);
  if (match("POST", "/api/server/start"))  return handle(handleServerStart);
  if (match("POST", "/api/server/stop"))   return handle(handleServerStop);
  if (match("POST", "/api/run"))           return handle(handleRun);
  if (match("POST", "/api/run/sync"))      return handle(handleRunSync);
  if (match("GET", "/api/run/stream"))     return handle(handleRunStream);
  if (match("*", "/api/validate"))         return handle(handleValidate);
  if (match("GET", "/api/runs"))           return handle(handleRuns);

  const runMatch = match("GET", /^\/api\/runs\/(?<id>[^/]+)$/);
  if (runMatch) return handle(handleRunById, runMatch);

  wrapped.status(404).json({ error: `Rota nao encontrada: ${req.method} ${route}` });
}

function openBrowser(url) {
  const cmd = process.platform === "darwin" ? "open"
    : process.platform === "win32" ? "start"
    : "xdg-open";
  exec(`${cmd} ${url}`, () => {});
}

export async function startWebServer(root, options = {}) {
  const port = options.port ?? 3000;

  const server = createServer(async (req, res) => {
    try {
      if (req.url.startsWith("/api/")) {
        routeApi(root, req, res);
      } else {
        await serveStatic(req, res);
      }
    } catch (err) {
      if (!res.headersSent) {
        res.writeHead(500, { "Content-Type": "text/plain" });
        res.end(err.message);
      }
    }
  });

  await new Promise((resolve, reject) => {
    server.listen(port, "127.0.0.1", resolve);
    server.once("error", reject);
  });

  const url = `http://localhost:${port}`;
  console.log(`APDA Web — ${url}`);
  console.log(`Frontend: ${FRONTEND}`);
  console.log("Pressione Ctrl+C para encerrar.\n");

  if (options.open !== false) openBrowser(url);

  process.on("SIGINT", () => {
    console.log("\nEncerrando servidor...");
    server.close(() => process.exit(0));
  });

  return server;
}
