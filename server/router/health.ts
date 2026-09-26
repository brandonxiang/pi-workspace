import type { HttpServer } from "../http/types.js";

export function registerHealthRoute(server: HttpServer) {
  server.get("/api/health", async (_request, _reply) => {
    return { ok: true };
  });
}
