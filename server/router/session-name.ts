import type { FastifyInstance } from "fastify";
import { persistSessionName } from "../utils/session-helpers.js";
import { invalidatePiSessionCatalogCache } from "../utils/pi-sessions.js";

export function registerSessionNameRoutes(server: FastifyInstance) {
  server.put("/api/sessions/:sessionId/name", async (request, reply) => {
    const { sessionId } = request.params as { sessionId?: string };
    const { name } = request.body as { name?: string };

    if (!sessionId?.trim()) {
      reply.code(400);
      return { error: "sessionId is required" };
    }
    if (!name?.trim()) {
      reply.code(400);
      return { error: "name is required" };
    }

    try {
      await persistSessionName(sessionId, name);
      invalidatePiSessionCatalogCache();
      return { ok: true };
    } catch (error) {
      reply.code(error instanceof Error && error.message === "Session not found" ? 404 : 500);
      return {
        error: error instanceof Error ? error.message : "Failed to rename session",
      };
    }
  });
}
