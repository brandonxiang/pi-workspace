import Fastify from "fastify";
import path from "node:path";
import { readFile } from "node:fs/promises";
import FastifyStatic from "@fastify/static";
import type { FastifyInstance } from "fastify";

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

/**
 * Serve the pre-built client bundle (dist/client) in production.
 *
 * This mirrors what @fastify/vite does in its production mode, but without
 * pulling @fastify/vite (and its `vite` peer dependency) into the runtime
 * dependency tree — keeping `npm install -g` fast for CLI users.
 */
async function registerStaticClient(server: FastifyInstance, root: string) {
  const clientDir = path.join(root, "dist", "client");

  // Serve the built client bundle. Exact file matches only (no index.html and
  // no wildcard SPA routes — those fall through to the not-found handler).
  // A single registration mirrors @fastify/vite's production behaviour without
  // needing @fastify/vite (nor its `vite` peer dependency) at install time.
  await server.register(async (scope) => {
    await scope.register(FastifyStatic, {
      root: clientDir,
      prefix: "/",
      index: false,
      wildcard: false,
      allowedPath: (p: string) => p !== "/index.html",
    });
  });
}

let cachedIndexHtml: string | null = null;
async function loadIndexHtml(root: string): Promise<string> {
  if (cachedIndexHtml == null) {
    cachedIndexHtml = await readFile(path.join(root, "dist", "client", "index.html"), "utf8");
  }
  return cachedIndexHtml;
}

async function buildServer() {
  const server = Fastify({
    bodyLimit: 8 * 1024 * 1024,
  });
  const root = path.resolve(import.meta.dirname, "..");

  if (isDev) {
    // Dev mode: Vite dev server with HMR. Imported dynamically so the
    // production bundle never loads @fastify/vite (nor vite).
    const { default: FastifyVite } = await import("@fastify/vite");
    await server.register(FastifyVite, {
      root,
      dev: true,
      spa: true,
    });
  } else {
    // Production mode: serve the pre-built client from disk
    await registerStaticClient(server, root);
  }

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

  if (isDev) {
    // SPA catch-all: dev server renders index.html via @fastify/vite
    server.setNotFoundHandler((_request, reply) => {
      return reply.html();
    });

    await server.vite.ready();
  } else {
    // SPA catch-all: serve the built index.html for any non-API route
    server.setNotFoundHandler(async (_request, reply) => {
      reply.type("text/html").send(await loadIndexHtml(root));
    });
  }
  return server;
}

async function startWithRetry(
  fastify: Awaited<ReturnType<typeof buildServer>>,
  retries: number,
): Promise<void> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const address = await new Promise<string>((resolve, reject) => {
        fastify.listen({ port, host: "127.0.0.1" }, (err, addr) => {
          if (err) reject(err);
          else resolve(addr);
        });
      });

      // Attach WebSocket terminal server to the underlying HTTP server
      const wss = setupTerminalWebSocket(fastify.server);
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

const server = await buildServer();

// Graceful shutdown on SIGTERM (from node --watch or dev.mjs)
// so the port is released promptly for the next process.
process.on("SIGTERM", async () => {
  killAllTerminals();

  try {
    await server.close();
  } catch {}
  process.exit(0);
});

await startWithRetry(server, 5);
