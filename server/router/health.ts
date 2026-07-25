import type { FastifyInstance } from "fastify";

export function registerHealthRoute(server: FastifyInstance) {
  server.get("/api/health", async (_request, _reply) => {
    return { ok: true };
  });
}
