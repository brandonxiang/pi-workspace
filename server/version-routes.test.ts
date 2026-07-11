import Fastify from "fastify";
import { describe, expect, it, vi } from "vitest";
import { VersionManagementError, type VersionsResponse } from "./version-management.js";
import { registerVersionRoutes, type VersionManagerApi } from "./version-routes.js";

const versions: VersionsResponse = {
  pi: {
    currentVersion: "0.80.3",
    latestVersion: "0.80.6",
    updateAvailable: true,
  },
  piWorkspace: {
    currentVersion: "0.1.0",
    latestVersion: "0.2.0",
    updateAvailable: true,
  },
};

async function createServer(manager: VersionManagerApi) {
  const server = Fastify();
  registerVersionRoutes(server, manager, { actionToken: "test-action-token" });
  await server.ready();
  return server;
}

describe("version routes", () => {
  it("returns both component version statuses", async () => {
    const server = await createServer({
      getVersions: vi.fn(async () => versions),
      upgrade: vi.fn(),
    });

    const response = await server.inject({ method: "GET", url: "/api/versions" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ...versions, actionToken: "test-action-token" });
    await server.close();
  });

  it("upgrades only the target selected by the route", async () => {
    const upgrade = vi.fn(async () => ({
      target: "pi" as const,
      ok: true as const,
      currentVersion: null,
      restartRequired: false,
      message: "Pi was upgraded successfully.",
    }));
    const server = await createServer({
      getVersions: vi.fn(async () => versions),
      upgrade,
    });

    const response = await server.inject({
      method: "POST",
      url: "/api/versions/pi/upgrade",
      headers: { "x-pi-workspace-action-token": "test-action-token" },
      payload: { command: "rm", args: ["-rf"] },
    });

    expect(response.statusCode).toBe(200);
    expect(upgrade).toHaveBeenCalledWith("pi");
    expect(response.json()).toMatchObject({ target: "pi", ok: true });
    await server.close();
  });

  it("rejects upgrade requests without the local action token", async () => {
    const upgrade = vi.fn();
    const server = await createServer({
      getVersions: vi.fn(async () => versions),
      upgrade,
    });

    const response = await server.inject({
      method: "POST",
      url: "/api/versions/pi/upgrade",
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ error: "Version upgrade permission denied." });
    expect(upgrade).not.toHaveBeenCalled();
    await server.close();
  });

  it("rejects an unsupported target", async () => {
    const server = await createServer({
      getVersions: vi.fn(async () => versions),
      upgrade: vi.fn(async () => {
        throw new VersionManagementError("INVALID_TARGET", "Unsupported upgrade target.");
      }),
    });

    const response = await server.inject({
      method: "POST",
      url: "/api/versions/other/upgrade",
      headers: { "x-pi-workspace-action-token": "test-action-token" },
    });

    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: "Unsupported upgrade target." });
    await server.close();
  });

  it("returns conflict while another upgrade is running", async () => {
    const server = await createServer({
      getVersions: vi.fn(async () => versions),
      upgrade: vi.fn(async () => {
        throw new VersionManagementError("BUSY", "Another upgrade is already running.");
      }),
    });

    const response = await server.inject({
      method: "POST",
      url: "/api/versions/pi-workspace/upgrade",
      headers: { "x-pi-workspace-action-token": "test-action-token" },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({ error: "Another upgrade is already running." });
    await server.close();
  });
});
