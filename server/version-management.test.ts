import { describe, expect, it, vi } from "vite-plus/test";
import {
  VersionManagementError,
  createVersionManager,
  isNewerVersion,
  normalizeVersion,
  resolveGlobalPiCommand,
  runCommand,
  type CommandRunner,
} from "./version-management.js";

describe("version parsing", () => {
  it("normalizes CLI version output", () => {
    expect(normalizeVersion("v0.80.3\n")).toBe("0.80.3");
    expect(normalizeVersion("0.2.0\r\n")).toBe("0.2.0");
  });

  it("compares semantic version components", () => {
    expect(isNewerVersion("0.80.6", "0.80.3")).toBe(true);
    expect(isNewerVersion("0.80.3", "0.80.3")).toBe(false);
    expect(isNewerVersion("0.79.9", "0.80.3")).toBe(false);
  });
});

describe("resolveGlobalPiCommand", () => {
  it("skips project node_modules bins and resolves the global Pi executable", () => {
    const executablePaths = new Set([
      "/workspace/node_modules/.bin/pi",
      "/Users/test/.local/bin/pi",
    ]);

    expect(
      resolveGlobalPiCommand("/workspace/node_modules/.bin:/Users/test/.local/bin:/usr/bin", {
        delimiter: ":",
        isExecutable: (candidate) => executablePaths.has(candidate),
      }),
    ).toBe("/Users/test/.local/bin/pi");
  });
});

describe("runCommand", () => {
  it("includes sanitized stderr and the exit code when a command fails", async () => {
    const result = runCommand(
      process.execPath,
      ["-e", 'process.stderr.write("\\u001b[31mpermission denied\\u001b[0m\\n"); process.exit(7)'],
      { timeoutMs: 5_000, maxOutputBytes: 4_096 },
    );

    await expect(result).rejects.toMatchObject({
      code: "COMMAND_FAILED",
      message: "The version command failed with exit code 7: permission denied",
      logDetail: "permission denied",
    });
  });
});

describe("createVersionManager", () => {
  it("returns independent Pi and pi-workspace version status", async () => {
    const runCommand: CommandRunner = vi.fn(async (command, args) => {
      if (command === "pi" && args[0] === "--version") {
        return { stdout: "0.80.3\n", stderr: "" };
      }
      throw new Error(`Unexpected command: ${command}`);
    });
    const manager = createVersionManager({
      runCommand,
      fetchLatestVersion: vi.fn(async (packageName) =>
        packageName === "@earendil-works/pi-coding-agent" ? "0.80.6" : "0.2.0",
      ),
      readWorkspaceVersion: vi.fn(async () => "0.1.0"),
      workspaceBinPath: "/app/bin/pi-workspace.mjs",
      nodePath: "/usr/bin/node",
    });

    await expect(manager.getVersions()).resolves.toEqual({
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
    });
  });

  it("keeps the current Pi version when its latest-version check fails", async () => {
    const manager = createVersionManager({
      runCommand: vi.fn(async () => ({ stdout: "v0.80.3\n", stderr: "" })),
      fetchLatestVersion: vi.fn(async (packageName) => {
        if (packageName === "@earendil-works/pi-coding-agent") {
          throw new Error("registry unavailable");
        }
        return "0.2.0";
      }),
      readWorkspaceVersion: vi.fn(async () => "0.2.0"),
      workspaceBinPath: "/app/bin/pi-workspace.mjs",
      nodePath: "/usr/bin/node",
    });

    const result = await manager.getVersions();

    expect(result.pi).toEqual({
      currentVersion: "0.80.3",
      latestVersion: null,
      updateAvailable: null,
      error: "Unable to check the latest Pi version.",
    });
    expect(result.piWorkspace.updateAvailable).toBe(false);
  });

  it("isolates invalid CLI version output to the affected component", async () => {
    const manager = createVersionManager({
      runCommand: vi.fn(async () => ({ stdout: "pi version unknown\n", stderr: "" })),
      fetchLatestVersion: vi.fn(async (packageName) =>
        packageName === "@earendil-works/pi-coding-agent" ? "0.80.6" : "0.2.0",
      ),
      readWorkspaceVersion: vi.fn(async () => "0.2.0"),
      workspaceBinPath: "/app/bin/pi-workspace.mjs",
      nodePath: "/usr/bin/node",
    });

    const result = await manager.getVersions();

    expect(result.pi).toEqual({
      currentVersion: null,
      latestVersion: "0.80.6",
      updateAvailable: null,
      error: "Unable to read the current Pi version.",
    });
    expect(result.piWorkspace).toMatchObject({
      currentVersion: "0.2.0",
      latestVersion: "0.2.0",
      updateAvailable: false,
    });
  });

  it("maps upgrade targets to fixed CLI commands", async () => {
    const runCommand = vi.fn<CommandRunner>(async () => ({ stdout: "updated", stderr: "" }));
    const manager = createVersionManager({
      runCommand,
      fetchLatestVersion: vi.fn(async () => "0.80.6"),
      readWorkspaceVersion: vi.fn(async () => "0.2.0"),
      workspaceBinPath: "/app/bin/pi-workspace.mjs",
      nodePath: "/usr/bin/node",
    });

    await manager.upgrade("pi");
    await manager.upgrade("pi-workspace");

    expect(runCommand).toHaveBeenNthCalledWith(1, "pi", ["update"], {
      maxOutputBytes: 65_536,
      timeoutMs: 10 * 60_000,
    });
    expect(runCommand).toHaveBeenNthCalledWith(
      2,
      "/usr/bin/node",
      ["/app/bin/pi-workspace.mjs", "update"],
      { maxOutputBytes: 65_536, timeoutMs: 10 * 60_000 },
    );
  });

  it("retries a Pi permission failure with non-interactive sudo", async () => {
    const runCommand = vi.fn<CommandRunner>(async (command) => {
      if (command !== "sudo") {
        throw new VersionManagementError(
          "COMMAND_FAILED",
          "The version command failed with exit code 1: permission denied",
          "permission denied",
        );
      }
      return { stdout: "updated", stderr: "" };
    });
    const manager = createVersionManager({
      runCommand,
      fetchLatestVersion: vi.fn(async () => "0.80.6"),
      readWorkspaceVersion: vi.fn(async () => "0.2.0"),
      workspaceBinPath: "/app/bin/pi-workspace.mjs",
      nodePath: "/usr/bin/node",
      piCommand: "/Users/test/.local/bin/pi",
    });

    await expect(manager.upgrade("pi")).resolves.toMatchObject({ ok: true });
    expect(runCommand).toHaveBeenNthCalledWith(
      2,
      "sudo",
      ["-n", "/Users/test/.local/bin/pi", "update"],
      { maxOutputBytes: 65_536, timeoutMs: 10 * 60_000 },
    );
  });

  it("retries a pi-workspace permission failure through its current CLI with sudo", async () => {
    const runCommand = vi.fn<CommandRunner>(async (command) => {
      if (command !== "sudo") {
        throw new VersionManagementError(
          "COMMAND_FAILED",
          "The version command failed with exit code 1: EACCES",
          "EACCES",
        );
      }
      return { stdout: "updated", stderr: "" };
    });
    const manager = createVersionManager({
      runCommand,
      fetchLatestVersion: vi.fn(async () => "0.80.6"),
      readWorkspaceVersion: vi.fn(async () => "0.2.0"),
      workspaceBinPath: "/app/bin/pi-workspace.mjs",
      nodePath: "/usr/bin/node",
    });

    await manager.upgrade("pi-workspace");

    expect(runCommand).toHaveBeenNthCalledWith(
      2,
      "sudo",
      ["-n", "/usr/bin/node", "/app/bin/pi-workspace.mjs", "update"],
      { maxOutputBytes: 65_536, timeoutMs: 10 * 60_000 },
    );
  });

  it("tells the user to authorize sudo when no cached credential is available", async () => {
    const runCommand = vi.fn<CommandRunner>(async (command) => {
      if (command === "sudo") {
        throw new VersionManagementError(
          "COMMAND_FAILED",
          "The version command failed with exit code 1: sudo: a password is required",
          "sudo: a password is required",
        );
      }
      throw new VersionManagementError(
        "COMMAND_FAILED",
        "The version command failed with exit code 1: permission denied",
        "permission denied",
      );
    });
    const manager = createVersionManager({
      runCommand,
      fetchLatestVersion: vi.fn(async () => "0.80.6"),
      readWorkspaceVersion: vi.fn(async () => "0.2.0"),
      workspaceBinPath: "/app/bin/pi-workspace.mjs",
      nodePath: "/usr/bin/node",
      piCommand: "/Users/test/.local/bin/pi",
    });

    await expect(manager.upgrade("pi")).rejects.toMatchObject({
      code: "COMMAND_FAILED",
      message: "Administrator permission is required. Run `sudo -v` in a terminal, then try again.",
    });
  });

  it("uses the resolved global Pi command for checks and upgrades", async () => {
    const runCommand = vi.fn<CommandRunner>(async () => ({ stdout: "0.80.3", stderr: "" }));
    const manager = createVersionManager({
      runCommand,
      fetchLatestVersion: vi.fn(async () => "0.80.6"),
      readWorkspaceVersion: vi.fn(async () => "0.2.0"),
      workspaceBinPath: "/app/bin/pi-workspace.mjs",
      nodePath: "/usr/bin/node",
      piCommand: "/Users/test/.local/bin/pi",
    });

    await manager.getVersions();
    await manager.upgrade("pi");

    expect(runCommand).toHaveBeenCalledWith("/Users/test/.local/bin/pi", ["--version"], {
      timeoutMs: 15_000,
      maxOutputBytes: 4_096,
    });
    expect(runCommand).toHaveBeenCalledWith("/Users/test/.local/bin/pi", ["update"], {
      timeoutMs: 10 * 60_000,
      maxOutputBytes: 65_536,
    });
  });

  it("keeps pi-workspace status available when the global Pi CLI is missing", async () => {
    const manager = createVersionManager({
      runCommand: vi.fn(async () => ({ stdout: "", stderr: "" })),
      fetchLatestVersion: vi.fn(async () => "0.2.0"),
      readWorkspaceVersion: vi.fn(async () => "0.2.0"),
      workspaceBinPath: "/app/bin/pi-workspace.mjs",
      nodePath: "/usr/bin/node",
      piCommand: null,
    });

    const result = await manager.getVersions();

    expect(result.pi).toMatchObject({
      currentVersion: null,
      updateAvailable: null,
      error: "Unable to read the current Pi version.",
    });
    expect(result.piWorkspace).toMatchObject({
      currentVersion: "0.2.0",
      latestVersion: "0.2.0",
      updateAvailable: false,
    });
  });

  it("rejects unknown upgrade targets", async () => {
    const manager = createVersionManager({
      runCommand: vi.fn(async () => ({ stdout: "", stderr: "" })),
      fetchLatestVersion: vi.fn(async () => "0.80.6"),
      readWorkspaceVersion: vi.fn(async () => "0.2.0"),
      workspaceBinPath: "/app/bin/pi-workspace.mjs",
      nodePath: "/usr/bin/node",
    });

    await expect(manager.upgrade("other")).rejects.toMatchObject({
      code: "INVALID_TARGET",
    });
  });

  it("allows only one upgrade at a time", async () => {
    let finishFirstUpgrade: (() => void) | undefined;
    const runCommand = vi.fn<CommandRunner>(
      () =>
        new Promise((resolve) => {
          finishFirstUpgrade = () => resolve({ stdout: "updated", stderr: "" });
        }),
    );
    const manager = createVersionManager({
      runCommand,
      fetchLatestVersion: vi.fn(async () => "0.80.6"),
      readWorkspaceVersion: vi.fn(async () => "0.2.0"),
      workspaceBinPath: "/app/bin/pi-workspace.mjs",
      nodePath: "/usr/bin/node",
    });

    const firstUpgrade = manager.upgrade("pi");
    await expect(manager.upgrade("pi-workspace")).rejects.toEqual(
      new VersionManagementError("BUSY", "Another upgrade is already running."),
    );

    finishFirstUpgrade?.();
    await firstUpgrade;
  });

  it("logs the target and command output when an upgrade fails", async () => {
    const logError = vi.fn();
    const manager = createVersionManager({
      runCommand: vi.fn(async () => {
        throw new VersionManagementError(
          "COMMAND_FAILED",
          "The version command failed with exit code 1: package registry unavailable",
          "package registry unavailable",
        );
      }),
      fetchLatestVersion: vi.fn(async () => "0.80.6"),
      readWorkspaceVersion: vi.fn(async () => "0.2.0"),
      workspaceBinPath: "/app/bin/pi-workspace.mjs",
      nodePath: "/usr/bin/node",
      logError,
    });

    await expect(manager.upgrade("pi")).rejects.toThrow("package registry unavailable");
    expect(logError).toHaveBeenCalledWith(
      "[version-upgrade] pi failed: package registry unavailable",
    );
  });
});
