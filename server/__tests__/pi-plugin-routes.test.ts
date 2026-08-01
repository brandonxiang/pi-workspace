import Fastify from "fastify";
import { afterEach, describe, expect, it, vi } from "vite-plus/test";
import {
  createDefaultExtensionsUpdateRunner,
  PiUpdateError,
  registerPiPluginRoutes,
  type PiPluginDependencies,
} from "../router/pi-plugins.js";
import { VersionManagementError } from "../utils/version-management.js";

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
    registerPiPluginRoutes(server, { createDependencies, actionToken: "secret" });

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
      actionToken: "secret",
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

  it("rejects plugin updates without the action token", async () => {
    const server = Fastify();
    servers.push(server);
    registerPiPluginRoutes(server, {
      createDependencies,
      actionToken: "secret",
      runExtensionsUpdate: vi.fn(async () => ({
        ok: true as const,
        message: "Pi packages updated.",
      })),
    });

    const response = await server.inject({
      method: "POST",
      url: "/api/pi-plugins/update",
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toEqual({ error: "Pi package update permission denied." });
  });

  it("returns the update result when the runner succeeds", async () => {
    const runExtensionsUpdate = vi.fn(async () => ({
      ok: true as const,
      message: "Pi packages updated.",
      output: "Updated npm:@acme/pi-preview",
    }));
    const server = Fastify();
    servers.push(server);
    registerPiPluginRoutes(server, {
      createDependencies,
      actionToken: "secret",
      runExtensionsUpdate,
    });

    const response = await server.inject({
      method: "POST",
      url: "/api/pi-plugins/update",
      headers: { "x-pi-workspace-action-token": "secret" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      ok: true,
      message: "Pi packages updated.",
      output: "Updated npm:@acme/pi-preview",
    });
    expect(runExtensionsUpdate).toHaveBeenCalledTimes(1);
  });

  it("maps runner busy errors to 409", async () => {
    const server = Fastify();
    servers.push(server);
    registerPiPluginRoutes(server, {
      createDependencies,
      actionToken: "secret",
      runExtensionsUpdate: vi.fn(async () => {
        throw new PiUpdateError(409, "Another package update is already running.");
      }),
    });

    const response = await server.inject({
      method: "POST",
      url: "/api/pi-plugins/update",
      headers: { "x-pi-workspace-action-token": "secret" },
    });

    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({ error: "Another package update is already running." });
  });

  it("returns command failure details as 500", async () => {
    const server = Fastify();
    servers.push(server);
    registerPiPluginRoutes(server, {
      createDependencies,
      actionToken: "secret",
      runExtensionsUpdate: vi.fn(async () => {
        throw new PiUpdateError(500, "Pi package update failed.", "npm error EACCES");
      }),
    });

    const response = await server.inject({
      method: "POST",
      url: "/api/pi-plugins/update",
      headers: { "x-pi-workspace-action-token": "secret" },
    });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({
      error: "Pi package update failed.",
      detail: "npm error EACCES",
    });
  });

  it("exposes the interactive sudo command when the update needs authorization", async () => {
    const server = Fastify();
    servers.push(server);
    registerPiPluginRoutes(server, {
      createDependencies,
      actionToken: "secret",
      runExtensionsUpdate: vi.fn(async () => {
        throw new PiUpdateError(
          500,
          "Administrator permission is required. Run `sudo -v` in a terminal, then try again.",
          undefined,
          "sudo '/usr/local/bin/pi' 'update' '--extensions'",
        );
      }),
    });

    const response = await server.inject({
      method: "POST",
      url: "/api/pi-plugins/update",
      headers: { "x-pi-workspace-action-token": "secret" },
    });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toEqual({
      error: "Administrator permission is required. Run `sudo -v` in a terminal, then try again.",
      requiresInteractiveSudo: true,
      interactiveCommand: "sudo '/usr/local/bin/pi' 'update' '--extensions'",
    });
  });

  it("exposes the action token from the plugins list response", async () => {
    const server = Fastify();
    servers.push(server);
    registerPiPluginRoutes(server, { createDependencies, actionToken: "secret" });

    const response = await server.inject({ method: "GET", url: "/api/pi-plugins" });

    expect(response.statusCode).toBe(200);
    expect(response.json().actionToken).toBe("secret");
  });

  it("default update runner rejects when the Pi CLI is missing", async () => {
    const runner = createDefaultExtensionsUpdateRunner({
      runCommand: vi.fn(),
      resolvePiCommand: () => null,
    });

    await expect(runner()).rejects.toThrow(/Global Pi CLI was not found/);
  });

  it("default update runner runs pi update --extensions on success", async () => {
    const runCommand = vi.fn(async () => ({
      stdout: "\u001b[32mUpdated 2 packages\u001b[0m",
      stderr: "",
    }));
    const runner = createDefaultExtensionsUpdateRunner({
      runCommand,
      resolvePiCommand: () => "/usr/local/bin/pi",
    });

    const result = await runner();

    expect(runCommand).toHaveBeenCalledWith(
      "/usr/local/bin/pi",
      ["update", "--extensions"],
      expect.objectContaining({ timeoutMs: 10 * 60_000 }),
    );
    expect(result).toEqual({
      ok: true,
      message: "Pi packages updated.",
      output: "Updated 2 packages",
    });
  });

  it("default update runner surfaces command failures", async () => {
    const runner = createDefaultExtensionsUpdateRunner({
      runCommand: vi.fn(async () => {
        throw new VersionManagementError(
          "COMMAND_FAILED",
          "The version command failed.",
          "npm error EACCES",
        );
      }),
      resolvePiCommand: () => "/usr/local/bin/pi",
    });

    await expect(runner()).rejects.toMatchObject({
      statusCode: 500,
      detail: "npm error EACCES",
    });
  });

  it("default update runner retries permission failures with non-interactive sudo", async () => {
    const runCommand = vi.fn(async (command: string) => {
      if (command === "sudo") {
        return { stdout: "Updated npm:@acme/pi-preview", stderr: "" };
      }
      throw new VersionManagementError(
        "COMMAND_FAILED",
        "The version command failed with exit code 1: EACCES",
        "EACCES: permission denied, mkdir '/Users/x/.pi/agent/npm'",
      );
    });
    const runner = createDefaultExtensionsUpdateRunner({
      runCommand,
      resolvePiCommand: () => "/usr/local/bin/pi",
    });

    const result = await runner();

    expect(runCommand).toHaveBeenNthCalledWith(
      1,
      "/usr/local/bin/pi",
      ["update", "--extensions"],
      expect.anything(),
    );
    expect(runCommand).toHaveBeenNthCalledWith(
      2,
      "sudo",
      ["-n", "/usr/local/bin/pi", "update", "--extensions"],
      expect.anything(),
    );
    expect(result).toEqual({
      ok: true,
      message: "Pi packages updated.",
      output: "Updated npm:@acme/pi-preview",
    });
  });

  it("default update runner exposes an interactive sudo command when sudo needs a password", async () => {
    const runCommand = vi.fn(async (command: string) => {
      if (command === "sudo") {
        throw new VersionManagementError(
          "COMMAND_FAILED",
          "The version command failed with exit code 1: sudo: a password is required",
          "sudo: a password is required",
        );
      }
      throw new VersionManagementError(
        "COMMAND_FAILED",
        "The version command failed with exit code 1: EACCES",
        "EACCES: permission denied, mkdir '/Users/x/.pi/agent/npm'",
      );
    });
    const runner = createDefaultExtensionsUpdateRunner({
      runCommand,
      resolvePiCommand: () => "/usr/local/bin/pi",
    });

    await expect(runner()).rejects.toMatchObject({
      statusCode: 500,
      interactiveSudoCommand: "sudo '/usr/local/bin/pi' 'update' '--extensions'",
      detail: undefined,
    });
  });

  it("default update runner serializes concurrent runs with a busy error", async () => {
    let release: (() => void) | undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const runCommand = vi.fn(async () => {
      await gate;
      return { stdout: "ok", stderr: "" };
    });
    const runner = createDefaultExtensionsUpdateRunner({
      runCommand,
      resolvePiCommand: () => "/usr/local/bin/pi",
    });

    const first = runner();
    await expect(runner()).rejects.toMatchObject({ statusCode: 409 });
    release?.();
    await expect(first).resolves.toEqual({
      ok: true,
      message: "Pi packages updated.",
      output: "ok",
    });
  });
});
