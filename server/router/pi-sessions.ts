import { existsSync, rmSync } from "node:fs";
import path from "node:path";
import type { FastifyInstance } from "fastify";
import {
  SessionManager,
  getAgentDir,
  createAgentSession,
  SettingsManager,
} from "@earendil-works/pi-coding-agent";
import {
  loadPiSessionProjects,
  loadPiSessionDetailById,
  loadPiSessionContextById,
  invalidatePiSessionCatalogCache,
} from "../utils/pi-sessions.js";
import { createLocalModelRegistry } from "../utils/auth.js";
import { piSessions } from "../utils/session-helpers.js";

export function registerPiSessionRoutes(server: FastifyInstance) {
  server.post("/api/pi-sessions", async (request, reply) => {
    const { cwd } = request.body as { cwd?: string };
    if (!cwd?.trim()) {
      reply.code(400);
      return { error: "cwd is required" };
    }

    try {
      const sm = SessionManager.create(cwd.trim());
      // Force-write the session header to disk so listAll() finds it.
      // SessionManager.create() defers writes until an assistant message appears.
      (sm as unknown as { _rewriteFile(): void })._rewriteFile();
      invalidatePiSessionCatalogCache();
      const projects = await loadPiSessionProjects();
      return { projects };
    } catch (error) {
      reply.code(500);
      return {
        error: error instanceof Error ? error.message : "Failed to create Pi session",
      };
    }
  });

  server.get("/api/pi-sessions", async (_request, reply) => {
    try {
      const projects = await loadPiSessionProjects();
      return { projects };
    } catch (error) {
      reply.code(500);
      return {
        error: error instanceof Error ? error.message : "Failed to list Pi sessions",
      };
    }
  });

  server.get("/api/pi-sessions/:sessionId", async (request, reply) => {
    const { sessionId } = request.params as { sessionId?: string };
    if (!sessionId?.trim()) {
      reply.code(400);
      return { error: "sessionId is required" };
    }

    try {
      const detail = await loadPiSessionDetailById(sessionId);
      if (!detail) {
        reply.code(404);
        return { error: "Pi session not found" };
      }

      return detail;
    } catch (error) {
      reply.code(500);
      return {
        error: error instanceof Error ? error.message : "Failed to load Pi session",
      };
    }
  });

  server.delete("/api/pi-sessions/:encodedProjectPath", async (request, reply) => {
    const { encodedProjectPath } = request.params as { encodedProjectPath?: string };
    if (!encodedProjectPath?.trim()) {
      reply.code(400);
      return { error: "projectPath is required" };
    }

    try {
      const projectPath = decodeURIComponent(encodedProjectPath);
      if (!projectPath.trim()) {
        reply.code(400);
        return { error: "Invalid project path" };
      }

      // Compute default session directory for this project
      const resolvedCwd = path.resolve(projectPath);
      const agentDir = getAgentDir();
      const safePath = `--${resolvedCwd.replace(/^[/\\]/, "").replace(/[/\\:]/g, "-")}--`;
      const sessionDir = path.join(agentDir, "sessions", safePath);

      if (existsSync(sessionDir)) {
        rmSync(sessionDir, { recursive: true, force: true });
      }

      // Clean up any Pi agent sessions cached in memory for this project
      const projectSessions = (await loadPiSessionProjects()).find((p) => p.path === projectPath);
      if (projectSessions) {
        for (const session of projectSessions.sessions) {
          piSessions.delete(session.id);
        }
      }

      invalidatePiSessionCatalogCache();
      return { ok: true };
    } catch (error) {
      reply.code(500);
      return {
        error: error instanceof Error ? error.message : "Failed to delete project",
      };
    }
  });

  server.get("/api/sessions/:sessionId/context-usage", async (request, reply) => {
    const { sessionId } = request.params as { sessionId?: string };
    if (!sessionId?.trim()) {
      reply.code(400);
      return { error: "sessionId is required" };
    }

    try {
      // Try the cached Pi agent session first (gives real-time usage)
      const cached = piSessions.get(sessionId);
      if (cached) {
        const contextUsage = cached.session.getContextUsage();
        return { contextUsage: contextUsage ?? null };
      }

      // Otherwise load from session file and create a temporary session
      const context = await loadPiSessionContextById(sessionId);
      if (!context) {
        reply.code(404);
        return { error: "Pi session not found" };
      }

      const { authStorage, modelRegistry } = await createLocalModelRegistry();
      const model =
        context.model?.provider && context.model?.modelId
          ? modelRegistry.find(context.model.provider, context.model.modelId)
          : undefined;

      const tempSession = await createAgentSession({
        cwd: context.session.cwd,
        authStorage,
        modelRegistry,
        model,
        sessionManager: context.sessionManager,
        settingsManager: SettingsManager.inMemory(),
      });

      const contextUsage = tempSession.session.getContextUsage();
      tempSession.session.dispose();

      return { contextUsage: contextUsage ?? null };
    } catch (error) {
      reply.code(500);
      return {
        error: error instanceof Error ? error.message : "Failed to get context usage",
      };
    }
  });
}
