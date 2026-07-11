import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import path from "node:path";

export type UpgradeTarget = "pi" | "pi-workspace";

export type VersionStatus = {
  currentVersion: string | null;
  latestVersion: string | null;
  updateAvailable: boolean | null;
  error?: string;
};

export type VersionsResponse = {
  pi: VersionStatus;
  piWorkspace: VersionStatus;
};

export type CommandOptions = {
  timeoutMs: number;
  maxOutputBytes: number;
};

export type CommandResult = {
  stdout: string;
  stderr: string;
};

export type CommandRunner = (
  command: string,
  args: string[],
  options?: CommandOptions
) => Promise<CommandResult>;

export class VersionManagementError extends Error {
  constructor(
    public readonly code:
      | "BUSY"
      | "COMMAND_FAILED"
      | "INVALID_TARGET"
      | "OUTPUT_LIMIT"
      | "TIMEOUT",
    message: string
  ) {
    super(message);
    this.name = "VersionManagementError";
  }
}

export function normalizeVersion(output: string) {
  const match = output.trim().match(/^v?(\d+\.\d+\.\d+(?:[-+][0-9A-Za-z.-]+)?)$/);
  if (!match) throw new Error("Invalid version output");
  return match[1];
}

function versionParts(version: string) {
  return normalizeVersion(version)
    .split("-", 1)[0]
    .split(".")
    .map((part) => Number.parseInt(part, 10));
}

export function isNewerVersion(latest: string, current: string) {
  const latestParts = versionParts(latest);
  const currentParts = versionParts(current);

  for (let index = 0; index < Math.max(latestParts.length, currentParts.length); index += 1) {
    const latestPart = latestParts[index] ?? 0;
    const currentPart = currentParts[index] ?? 0;
    if (latestPart > currentPart) return true;
    if (latestPart < currentPart) return false;
  }

  return false;
}

type VersionManagerDependencies = {
  runCommand: CommandRunner;
  fetchLatestVersion(packageName: string): Promise<string>;
  readWorkspaceVersion(): Promise<string>;
  workspaceBinPath: string;
  nodePath: string;
};

async function buildVersionStatus(
  currentVersionPromise: Promise<string>,
  latestVersionPromise: Promise<string>,
  labels: { current: string; latest: string }
): Promise<VersionStatus> {
  const [currentResult, latestResult] = await Promise.allSettled([
    currentVersionPromise.then(normalizeVersion),
    latestVersionPromise.then(normalizeVersion)
  ]);
  const currentVersion =
    currentResult.status === "fulfilled" ? currentResult.value : null;
  const latestVersion =
    latestResult.status === "fulfilled" ? latestResult.value : null;
  const errors: string[] = [];

  if (currentResult.status === "rejected") errors.push(labels.current);
  if (latestResult.status === "rejected") errors.push(labels.latest);

  return {
    currentVersion,
    latestVersion,
    updateAvailable:
      currentVersion && latestVersion ? isNewerVersion(latestVersion, currentVersion) : null,
    ...(errors.length > 0 ? { error: errors.join(" ") } : {})
  };
}

export function createVersionManager(dependencies: VersionManagerDependencies) {
  let upgradeRunning = false;

  return {
    async getVersions(): Promise<VersionsResponse> {
      const [pi, piWorkspace] = await Promise.all([
        buildVersionStatus(
          dependencies
            .runCommand("pi", ["--version"], { timeoutMs: 15_000, maxOutputBytes: 4_096 })
            .then((result) => result.stdout),
          dependencies.fetchLatestVersion("@earendil-works/pi-coding-agent"),
          {
            current: "Unable to read the current Pi version.",
            latest: "Unable to check the latest Pi version."
          }
        ),
        buildVersionStatus(
          dependencies.readWorkspaceVersion(),
          dependencies.fetchLatestVersion("pi-workspace"),
          {
            current: "Unable to read the current pi-workspace version.",
            latest: "Unable to check the latest pi-workspace version."
          }
        )
      ]);

      return { pi, piWorkspace };
    },

    async upgrade(target: string) {
      if (target !== "pi" && target !== "pi-workspace") {
        throw new VersionManagementError("INVALID_TARGET", "Unsupported upgrade target.");
      }
      if (upgradeRunning) {
        throw new VersionManagementError("BUSY", "Another upgrade is already running.");
      }

      upgradeRunning = true;
      try {
        const definition =
          target === "pi"
            ? { command: "pi", args: ["update"] }
            : {
                command: dependencies.nodePath,
                args: [dependencies.workspaceBinPath, "update"]
              };
        await dependencies.runCommand(definition.command, definition.args, {
          timeoutMs: 10 * 60_000,
          maxOutputBytes: 65_536
        });

        return {
          target: target as UpgradeTarget,
          ok: true as const,
          currentVersion: null,
          restartRequired: target === "pi-workspace",
          message:
            target === "pi-workspace"
              ? "pi-workspace was upgraded. Restart it to use the new version."
              : "Pi was upgraded successfully."
        };
      } finally {
        upgradeRunning = false;
      }
    }
  };
}

export const runCommand: CommandRunner = (command, args, options) =>
  new Promise((resolve, reject) => {
    const timeoutMs = options?.timeoutMs ?? 15_000;
    const maxOutputBytes = options?.maxOutputBytes ?? 65_536;
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    let outputBytes = 0;
    let settled = false;
    let timeout: NodeJS.Timeout | undefined;

    const finishWithError = (error: VersionManagementError) => {
      if (settled) return;
      settled = true;
      if (timeout) clearTimeout(timeout);
      child.kill("SIGTERM");
      reject(error);
    };
    const appendOutput = (target: "stdout" | "stderr", chunk: Buffer) => {
      outputBytes += chunk.byteLength;
      if (outputBytes > maxOutputBytes) {
        finishWithError(
          new VersionManagementError("OUTPUT_LIMIT", "The version command produced too much output.")
        );
        return;
      }
      if (target === "stdout") stdout += chunk.toString();
      else stderr += chunk.toString();
    };
    timeout = setTimeout(() => {
      finishWithError(new VersionManagementError("TIMEOUT", "The version command timed out."));
    }, timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => appendOutput("stdout", chunk));
    child.stderr.on("data", (chunk: Buffer) => appendOutput("stderr", chunk));
    child.on("error", () => {
      finishWithError(
        new VersionManagementError("COMMAND_FAILED", "The version command could not be started.")
      );
    });
    child.on("close", (code) => {
      if (timeout) clearTimeout(timeout);
      if (settled) return;
      settled = true;
      if (code !== 0) {
        reject(new VersionManagementError("COMMAND_FAILED", "The version command failed."));
        return;
      }
      resolve({ stdout, stderr });
    });
  });

async function fetchLatestVersion(packageName: string) {
  const response = await fetch(
    `https://registry.npmjs.org/${encodeURIComponent(packageName)}/latest`,
    { headers: { accept: "application/json" } }
  );
  if (!response.ok) throw new Error("Registry request failed");
  const body = (await response.json()) as { version?: unknown };
  if (typeof body.version !== "string") throw new Error("Registry response did not include a version");
  return body.version;
}

export function createDefaultVersionManager() {
  const projectRoot = path.resolve(import.meta.dirname, "..");
  const packageJsonPath = path.join(projectRoot, "package.json");

  return createVersionManager({
    runCommand,
    fetchLatestVersion,
    async readWorkspaceVersion() {
      const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8")) as { version?: unknown };
      if (typeof packageJson.version !== "string") throw new Error("Missing package version");
      return packageJson.version;
    },
    workspaceBinPath: path.join(projectRoot, "bin", "pi-workspace.mjs"),
    nodePath: process.execPath
  });
}
