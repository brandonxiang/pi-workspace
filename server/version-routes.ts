import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import {
  VersionManagementError,
  type UpgradeTarget,
  type VersionsResponse
} from "./version-management.js";

type UpgradeResult = {
  target: UpgradeTarget;
  ok: true;
  currentVersion: string | null;
  restartRequired: boolean;
  message: string;
};

export type VersionManagerApi = {
  getVersions(): Promise<VersionsResponse>;
  upgrade(target: string): Promise<UpgradeResult>;
};

export function registerVersionRoutes(
  server: FastifyInstance,
  manager: VersionManagerApi,
  options: { actionToken?: string } = {}
) {
  const actionToken = options.actionToken || randomUUID();

  server.get("/api/versions", async (_request, reply) => {
    try {
      return { ...(await manager.getVersions()), actionToken };
    } catch {
      reply.code(500);
      return { error: "Failed to check versions." };
    }
  });

  server.post("/api/versions/:target/upgrade", async (request, reply) => {
    const { target } = request.params as { target?: string };
    if (request.headers["x-pi-workspace-action-token"] !== actionToken) {
      reply.code(403);
      return { error: "Version upgrade permission denied." };
    }

    try {
      return await manager.upgrade(target || "");
    } catch (error) {
      if (error instanceof VersionManagementError) {
        reply.code(error.code === "INVALID_TARGET" ? 400 : error.code === "BUSY" ? 409 : 500);
        return { error: error.message };
      }

      reply.code(500);
      return { error: "Failed to upgrade the selected component." };
    }
  });
}
