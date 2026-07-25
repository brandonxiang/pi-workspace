import type { FastifyInstance } from "fastify";
import {
  type SessionStatus,
  type SessionStatusMap,
  VALID_STATUSES,
  isValidStatusTransition,
} from "../utils/pi-sessions.js";

export interface SessionStatusApi {
  readStatuses: () => SessionStatusMap;
  writeStatuses: (statuses: SessionStatusMap) => void;
}

export function registerSessionStatusRoutes(server: FastifyInstance, api: SessionStatusApi) {
  server.patch("/api/pi-sessions/:sessionId/status", async (request, reply) => {
    const { sessionId } = request.params as { sessionId?: string };
    const { status } = request.body as { status?: string };

    if (!sessionId?.trim()) {
      reply.code(400);
      return { error: "sessionId is required" };
    }

    if (!status || !VALID_STATUSES.has(status as SessionStatus)) {
      reply.code(400);
      return {
        error:
          "Invalid status value. Must be one of: initializing, in_progress, pending_review, completed",
      };
    }

    const statuses = api.readStatuses();
    const currentStatus: SessionStatus = statuses[sessionId] || "pending_review";
    const targetStatus = status as SessionStatus;

    if (!isValidStatusTransition(currentStatus, targetStatus)) {
      reply.code(400);
      return {
        error: `Invalid transition from ${currentStatus} to ${targetStatus}`,
        currentStatus,
      };
    }

    statuses[sessionId] = targetStatus;
    api.writeStatuses(statuses);

    return { status: targetStatus };
  });
}
