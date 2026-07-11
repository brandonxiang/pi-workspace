import { describe, expect, it, vi } from "vitest";
import {
  VersionManagementError,
  createVersionManager,
  isNewerVersion,
  normalizeVersion,
  type CommandRunner
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
        packageName === "@earendil-works/pi-coding-agent" ? "0.80.6" : "0.2.0"
      ),
      readWorkspaceVersion: vi.fn(async () => "0.1.0"),
      workspaceBinPath: "/app/bin/pi-workspace.mjs",
      nodePath: "/usr/bin/node"
    });

    await expect(manager.getVersions()).resolves.toEqual({
      pi: {
        currentVersion: "0.80.3",
        latestVersion: "0.80.6",
        updateAvailable: true
      },
      piWorkspace: {
        currentVersion: "0.1.0",
        latestVersion: "0.2.0",
        updateAvailable: true
      }
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
      nodePath: "/usr/bin/node"
    });

    const result = await manager.getVersions();

    expect(result.pi).toEqual({
      currentVersion: "0.80.3",
      latestVersion: null,
      updateAvailable: null,
      error: "Unable to check the latest Pi version."
    });
    expect(result.piWorkspace.updateAvailable).toBe(false);
  });

  it("isolates invalid CLI version output to the affected component", async () => {
    const manager = createVersionManager({
      runCommand: vi.fn(async () => ({ stdout: "pi version unknown\n", stderr: "" })),
      fetchLatestVersion: vi.fn(async (packageName) =>
        packageName === "@earendil-works/pi-coding-agent" ? "0.80.6" : "0.2.0"
      ),
      readWorkspaceVersion: vi.fn(async () => "0.2.0"),
      workspaceBinPath: "/app/bin/pi-workspace.mjs",
      nodePath: "/usr/bin/node"
    });

    const result = await manager.getVersions();

    expect(result.pi).toEqual({
      currentVersion: null,
      latestVersion: "0.80.6",
      updateAvailable: null,
      error: "Unable to read the current Pi version."
    });
    expect(result.piWorkspace).toMatchObject({
      currentVersion: "0.2.0",
      latestVersion: "0.2.0",
      updateAvailable: false
    });
  });

  it("maps upgrade targets to fixed CLI commands", async () => {
    const runCommand = vi.fn<CommandRunner>(async () => ({ stdout: "updated", stderr: "" }));
    const manager = createVersionManager({
      runCommand,
      fetchLatestVersion: vi.fn(async () => "0.80.6"),
      readWorkspaceVersion: vi.fn(async () => "0.2.0"),
      workspaceBinPath: "/app/bin/pi-workspace.mjs",
      nodePath: "/usr/bin/node"
    });

    await manager.upgrade("pi");
    await manager.upgrade("pi-workspace");

    expect(runCommand).toHaveBeenNthCalledWith(1, "pi", ["update"], {
      maxOutputBytes: 65_536,
      timeoutMs: 10 * 60_000
    });
    expect(runCommand).toHaveBeenNthCalledWith(
      2,
      "/usr/bin/node",
      ["/app/bin/pi-workspace.mjs", "update"],
      { maxOutputBytes: 65_536, timeoutMs: 10 * 60_000 }
    );
  });

  it("rejects unknown upgrade targets", async () => {
    const manager = createVersionManager({
      runCommand: vi.fn(async () => ({ stdout: "", stderr: "" })),
      fetchLatestVersion: vi.fn(async () => "0.80.6"),
      readWorkspaceVersion: vi.fn(async () => "0.2.0"),
      workspaceBinPath: "/app/bin/pi-workspace.mjs",
      nodePath: "/usr/bin/node"
    });

    await expect(manager.upgrade("other")).rejects.toMatchObject({
      code: "INVALID_TARGET"
    });
  });

  it("allows only one upgrade at a time", async () => {
    let finishFirstUpgrade: (() => void) | undefined;
    const runCommand = vi.fn<CommandRunner>(
      () =>
        new Promise((resolve) => {
          finishFirstUpgrade = () => resolve({ stdout: "updated", stderr: "" });
        })
    );
    const manager = createVersionManager({
      runCommand,
      fetchLatestVersion: vi.fn(async () => "0.80.6"),
      readWorkspaceVersion: vi.fn(async () => "0.2.0"),
      workspaceBinPath: "/app/bin/pi-workspace.mjs",
      nodePath: "/usr/bin/node"
    });

    const firstUpgrade = manager.upgrade("pi");
    await expect(manager.upgrade("pi-workspace")).rejects.toEqual(
      new VersionManagementError("BUSY", "Another upgrade is already running.")
    );

    finishFirstUpgrade?.();
    await firstUpgrade;
  });
});
