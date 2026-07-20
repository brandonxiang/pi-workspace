import Fastify from "fastify";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import { registerPiPluginRoutes, type PiPluginDependencies } from "../pi-plugins.js";

function createDependencies(): PiPluginDependencies {
  return {
    packageManager: {
      listConfiguredPackages: () => [],
      resolve: vi.fn(async () => ({ extensions: [], skills: [], prompts: [], themes: [] })),
    },
    resourceLoader: {
      reload: vi.fn(async () => {}),
      getExtensions: () => ({ extensions: [], errors: [] }),
      getSkills: () => ({ skills: [], diagnostics: [] }),
      getPrompts: () => ({
        prompts: [
          {
            name: "release-notes",
            description: "Draft release notes",
            sourceInfo: {
              path: "/tmp/workspace/prompts/release-notes.md",
              source: "npm:@acme/pi-prompts",
              scope: "project",
              origin: "package",
            },
          },
        ],
        diagnostics: [],
      }),
      getThemes: () => ({ themes: [], diagnostics: [] }),
    },
  };
}

describe("pi plugin routes", () => {
  const servers: Array<ReturnType<typeof Fastify>> = [];

  afterEach(async () => {
    await Promise.all(servers.map((server) => server.close()));
    servers.splice(0);
  });

  it("returns plugin summaries from GET /api/pi-plugins", async () => {
    const server = Fastify();
    servers.push(server);
    registerPiPluginRoutes(server, { createDependencies });

    const response = await server.inject({ method: "GET", url: "/api/pi-plugins" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      plugins: [],
      commands: [
        {
          name: "release-notes",
          description: "Draft release notes",
          source: "prompt",
          scope: "project",
          origin: "package",
          path: "/tmp/workspace/prompts/release-notes.md",
          packageSource: "npm:@acme/pi-prompts",
        },
      ],
      diagnostics: [],
    });
  });

  it("loads commands with the selected Pi session cwd", async () => {
    const createDependenciesForCwd = vi.fn(() => createDependencies());
    const server = Fastify();
    servers.push(server);
    registerPiPluginRoutes(server, {
      createDependencies: createDependenciesForCwd,
      resolveSessionCwd: vi.fn(async () => "/tmp/workspace"),
    });

    const response = await server.inject({
      method: "GET",
      url: "/api/pi-sessions/session-1/commands",
    });

    expect(response.statusCode).toBe(200);
    expect(createDependenciesForCwd).toHaveBeenCalledWith("/tmp/workspace");
    expect(response.json().commands.map((command: { name: string }) => command.name)).toEqual([
      "release-notes",
    ]);
  });

  it("returns 404 when loading commands for an unknown Pi session", async () => {
    const server = Fastify();
    servers.push(server);
    registerPiPluginRoutes(server, {
      createDependencies,
      resolveSessionCwd: vi.fn(async () => null),
    });

    const response = await server.inject({
      method: "GET",
      url: "/api/pi-sessions/missing/commands",
    });

    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({ error: "Pi session not found" });
  });
});
