import type { FastifyInstance } from "fastify";
import {
  findAppSlashCommand,
  isServerAppSlashCommand,
  type AppSlashCommandName,
} from "../../shared/slash-commands.js";
import { executeServerLocalAction } from "../utils/pi-local-actions.js";
import {
  createPersistedPiSession,
  persistSessionName,
  readSessionName,
} from "../utils/session-helpers.js";
import type { LocalActionRequest } from "../model/index.js";

export function registerLocalActionRoutes(server: FastifyInstance) {
  server.post("/api/pi-local-actions", async (request, reply) => {
    const body = request.body as LocalActionRequest;
    const piSessionId = request.headers["x-pi-session-id"] as string | undefined;
    const command = body.action ? findAppSlashCommand(body.action) : null;

    if (!command || !isServerAppSlashCommand(command)) {
      reply.code(400);
      return { error: "Unsupported local action" };
    }

    if (!piSessionId?.trim()) {
      reply.code(400);
      return { error: "Pi session id is required" };
    }

    try {
      const persistedSession = await createPersistedPiSession(piSessionId);
      if (!persistedSession) {
        reply.code(404);
        return { error: "Pi session not found" };
      }

      const result = await executeServerLocalAction(
        command.name as Extract<AppSlashCommandName, "session" | "export" | "name" | "compact">,
        body.args || "",
        {
          compactSession: (customInstructions) =>
            persistedSession.session.compact(customInstructions),
          exportToHtml: () => persistedSession.session.exportToHtml(),
          exportToJsonl: () => persistedSession.session.exportToJsonl(),
          getSessionName: () => readSessionName(piSessionId),
          getSessionStats: () => persistedSession.session.getSessionStats(),
          setSessionName: (name) => persistSessionName(piSessionId, name).then(() => undefined),
        },
      );

      return { result };
    } catch (error) {
      reply.code(error instanceof Error && error.message === "Session not found" ? 404 : 500);
      return {
        error: error instanceof Error ? error.message : "Failed to run local action",
      };
    }
  });
}
