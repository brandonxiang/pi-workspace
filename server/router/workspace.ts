import { existsSync, readdirSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { execSync } from "node:child_process";
import type { FastifyInstance } from "fastify";

export function registerWorkspaceRoutes(server: FastifyInstance) {
  server.get("/api/cwd", async (_request, _reply) => {
    return { cwd: process.cwd() };
  });

  server.post("/api/resolve-workspace", async (request, reply) => {
    const { name } = request.body as { name?: string };
    if (!name?.trim()) {
      reply.code(400);
      return { error: "name is required" };
    }

    // Scan common project roots for a matching directory
    const homeDir = homedir();
    const roots = [
      path.join(homeDir, "github"),
      path.join(homeDir, "projects"),
      path.join(homeDir, "work"),
      homeDir,
    ];

    for (const root of roots) {
      const candidate = path.join(root, name.trim());
      if (existsSync(candidate)) {
        return { found: true, path: candidate };
      }
    }

    // If not found directly, scan roots for a match (case-insensitive)
    const lowerName = name.trim().toLowerCase();
    for (const root of roots) {
      try {
        const entries = readdirSync(root, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory() && entry.name.toLowerCase() === lowerName) {
            return { found: true, path: path.join(root, entry.name) };
          }
        }
      } catch {
        // Skip roots that don't exist
      }
    }

    reply.code(404);
    return { found: false, error: `Directory "${name}" not found in any workspace root` };
  });

  server.post("/api/reveal-project", async (request, reply) => {
    const { path: projectPath } = request.body as { path?: string };
    if (!projectPath?.trim()) {
      reply.code(400);
      return { error: "path is required" };
    }

    try {
      execSync(`open "${projectPath}"`, { timeout: 5000 });
      return { ok: true };
    } catch (error) {
      reply.code(500);
      return {
        error: error instanceof Error ? error.message : "Failed to reveal project",
      };
    }
  });
}
