import path from "node:path";
import { readFile } from "node:fs/promises";
import type { ServerResponse } from "node:http";
import type { ViteDevServer } from "vite";

import { createHttpServer } from "./http/server.js";
import type { HttpServer } from "./http/types.js";

import { createDefaultVersionManager } from "./utils/version-management.js";
import { registerVersionRoutes } from "./router/version-routes.js";
import { readAllSessionStatuses, writeAllSessionStatuses } from "./utils/pi-sessions.js";
import { registerSessionStatusRoutes } from "./router/session-status.js";
import { registerPiSkillRoutes, createSkillsDependencies } from "./router/pi-skills.js";
import {
  registerPiPluginRoutes,
  createPiPluginDependencies,
  listPiPlugins,
} from "./router/pi-plugins.js";
import { loadPiSessionContextById } from "./utils/pi-sessions.js";
import { createPersistedPiSession } from "./utils/session-helpers.js";

import { registerHealthRoute } from "./router/health.js";
import { registerChatRoutes } from "./router/chat.js";
import { registerPiSessionRoutes } from "./router/pi-sessions.js";
import { registerModelRoutes } from "./router/models.js";
import { registerWorkspaceRoutes } from "./router/workspace.js";
import { registerLocalActionRoutes } from "./router/local-actions.js";
import { registerSessionNameRoutes } from "./router/session-name.js";
import { setupTerminalWebSocket, killAllTerminals, setTerminalWss } from "./utils/ws-terminal.js";

const port = Number(process.env.PORT || 8787);
const isDev = process.argv.includes("--dev");

let cachedIndexHtml: string | null = null;
async function loadIndexHtml(root: string): Promise<string> {
  if (cachedIndexHtml == null) {
    cachedIndexHtml = await readFile(path.join(root, "dist", "client", "index.html"), "utf8");
  }
  return cachedIndexHtml;
}

/**
 * Dev mode: run Vite in middleware mode against the same HTTP server, so the
 * UI and the API share one port with HMR.
 *
 * API routes are matched before this not-found handler runs, so Vite can never
 * shadow an `/api/*` path. That is why the client root can safely contain
 * files like `client/api/versions.ts` without colliding with the API.
 */
async function registerDevClient(server: HttpServer, root: string): Promise<ViteDevServer> {
  const { createServer } = await import("vite");
  const clientRoot = path.join(root, "client");

  const vite = await createServer({
    configFile: path.join(root, "vite.config.ts"),
    server: {
      middlewareMode: true,
      hmr: { server: server.raw },
    },
    appType: "custom",
  });

  server.setNotFoundHandler(async (request, reply) => {
    reply.hijack();
    const raw = reply.raw;

    vite.middlewares(request.raw, raw, (error?: unknown) => {
      if (error) {
        raw.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
        raw.end("Internal Server Error");
        return;
      }
      void sendSpaHtml(vite, clientRoot, request.url, raw);
    });
  });

  return vite;
}

/** Serve the transformed SPA shell, mirroring Vite's own HTML handling. */
async function sendSpaHtml(
  vite: ViteDevServer,
  clientRoot: string,
  url: string,
  raw: ServerResponse,
): Promise<void> {
  try {
    const template = await readFile(path.join(clientRoot, "index.html"), "utf8");
    const html = await vite.transformIndexHtml(url, template);

    raw.writeHead(200, {
      "content-type": "text/html",
      "content-length": String(Buffer.byteLength(html)),
    });
    raw.end(html);
  } catch (error) {
    if (error instanceof Error) vite.ssrFixStacktrace(error);
    raw.writeHead(500, { "content-type": "text/plain; charset=utf-8" });
    raw.end("Internal Server Error");
  }
}

async function buildServer(): Promise<{ server: HttpServer; vite: ViteDevServer | null }> {
  const server = createHttpServer();
  const root = path.resolve(import.meta.dirname, "..");

  // ──────── API routes ────────
  registerHealthRoute(server);
  registerVersionRoutes(server, createDefaultVersionManager());
  registerSessionStatusRoutes(server, {
    readStatuses: readAllSessionStatuses,
    writeStatuses: writeAllSessionStatuses,
  });
  registerPiPluginRoutes(server, {
    resolveSessionCommands: async (sessionId) => {
      const record = await createPersistedPiSession(sessionId);
      if (!record) return null;

      const dependencies = createPiPluginDependencies(record.session.sessionManager.getCwd());
      const result = await listPiPlugins({
        packageManager: dependencies.packageManager,
        resourceLoader: record.session.resourceLoader,
      });
      return result.commands;
    },
    resolveSessionCwd: async (sessionId) => {
      const context = await loadPiSessionContextById(sessionId);
      return context?.session.cwd ?? null;
    },
  });
  registerPiSkillRoutes(server, createSkillsDependencies());
  registerWorkspaceRoutes(server);
  registerPiSessionRoutes(server);
  registerSessionNameRoutes(server);
  registerLocalActionRoutes(server);
  registerModelRoutes(server);
  registerChatRoutes(server);

  // ──────── Client ────────
  if (isDev) {
    return { server, vite: await registerDevClient(server, root) };
  }

  // Production: serve the pre-built client, then fall back to the app shell.
  server.setStaticRoot(path.join(root, "dist", "client"));
  server.setNotFoundHandler(async (_request, reply) => {
    reply.type("text/html").send(await loadIndexHtml(root));
  });

  return { server, vite: null };
}

async function startWithRetry(server: HttpServer, retries: number): Promise<void> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const address = await server.listen(port, "127.0.0.1");

      // Attach WebSocket terminal server to the underlying HTTP server
      const wss = setupTerminalWebSocket(server.raw);
      setTerminalWss(wss);
      console.log(`My Pi server listening on ${address}`);
      return;
    } catch (error) {
      const isPortInUse =
        error instanceof Error && (error as NodeJS.ErrnoException).code === "EADDRINUSE";

      if (isPortInUse && attempt < retries) {
        console.log(`Port ${port} is in use, retrying in 1s (attempt ${attempt}/${retries - 1})…`);
        await new Promise((r) => setTimeout(r, 1000));
      } else {
        console.error("Failed to start server:", error);
        process.exit(1);
      }
    }
  }
}

const { server, vite } = await buildServer();

// Graceful shutdown on SIGTERM (from node --watch or dev.mjs)
// so the port is released promptly for the next process.
process.on("SIGTERM", async () => {
  killAllTerminals();

  try {
    await vite?.close();
  } catch {}

  try {
    await server.close();
  } catch {}
  process.exit(0);
});

await startWithRetry(server, 5);
