import { spawn } from "node:child_process";
import { accessSync, constants } from "node:fs";
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
  options?: CommandOptions,
) => Promise<CommandResult>;

export class VersionManagementError extends Error {
  constructor(
    public readonly code: "BUSY" | "COMMAND_FAILED" | "INVALID_TARGET" | "OUTPUT_LIMIT" | "TIMEOUT",
    message: string,
    public readonly logDetail?: string,
    public readonly interactiveSudoCommand?: string,
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
  piCommand?: string | null;
  logError?(message: string): void;
};

export function resolveGlobalPiCommand(
  pathValue: string | undefined,
  options: {
    delimiter?: string;
    isExecutable?(candidate: string): boolean;
  } = {},
) {
  const delimiter = options.delimiter || path.delimiter;
  const executableNames = process.platform === "win32" ? ["pi.cmd", "pi.exe", "pi"] : ["pi"];
  const isExecutable =
    typeof options.isExecutable === "function"
      ? (candidate: string) => options.isExecutable!(candidate)
      : (candidate: string) => {
          try {
            accessSync(candidate, constants.X_OK);
            return true;
          } catch {
            return false;
          }
        };

  for (const directory of (pathValue || "").split(delimiter)) {
    if (!directory) continue;
    const normalizedDirectory = directory.replace(/\\/g, "/").replace(/\/+$/, "");
    if (normalizedDirectory.endsWith("/node_modules/.bin")) continue;

    for (const executableName of executableNames) {
      const candidate = path.join(directory, executableName);
      if (isExecutable(candidate)) return candidate;
    }
  }

  return null;
}

function sanitizeCommandOutput(output: string, maxLength: number) {
  const sanitized = output
    .replace(new RegExp(String.fromCharCode(0x1b) + "\\[[0-?]*[ -/]*[@-~]", "g"), "")
    .replace(
      new RegExp(
        "[" +
          String.fromCharCode(
            0x00,
            0x01,
            0x02,
            0x03,
            0x04,
            0x05,
            0x06,
            0x07,
            0x08,
            0x0b,
            0x0c,
            0x0e,
            0x0f,
            0x10,
            0x11,
            0x12,
            0x13,
            0x14,
            0x15,
            0x16,
            0x17,
            0x18,
            0x19,
            0x1a,
            0x1b,
            0x1c,
            0x1d,
            0x1e,
            0x1f,
            0x7f,
          ) +
          "]",
      ),
      "",
    )
    .replace(/\s+/g, " ")
    .trim();

  return sanitized.length > maxLength ? `${sanitized.slice(0, maxLength - 1)}…` : sanitized;
}

function asVersionManagementError(error: unknown) {
  return error instanceof VersionManagementError
    ? error
    : new VersionManagementError("COMMAND_FAILED", "The version command failed.");
}

function isPermissionFailure(error: VersionManagementError) {
  const detail = `${error.message} ${error.logDetail || ""}`;
  return /\b(?:EACCES|EPERM)\b|permission denied|operation not permitted|install path is not writable|insufficient permissions?|requires? (?:root|administrator)|must be run as root/i.test(
    detail,
  );
}

function isSudoAuthorizationFailure(error: VersionManagementError) {
  const detail = `${error.message} ${error.logDetail || ""}`;
  return /password is required|no tty present|a terminal is required|authentication is required/i.test(
    detail,
  );
}

function buildInteractiveSudoCommand(command: string, args: string[]) {
  const quote = (value: string) => `'${value.replace(/'/g, `'\\''`)}'`;
  return `sudo ${[command, ...args].map(quote).join(" ")}`;
}

async function buildVersionStatus(
  currentVersionPromise: Promise<string>,
  latestVersionPromise: Promise<string>,
  labels: { current: string; latest: string },
): Promise<VersionStatus> {
  const [currentResult, latestResult] = await Promise.allSettled([
    currentVersionPromise.then(normalizeVersion),
    latestVersionPromise.then(normalizeVersion),
  ]);
  const currentVersion = currentResult.status === "fulfilled" ? currentResult.value : null;
  const latestVersion = latestResult.status === "fulfilled" ? latestResult.value : null;
  const errors: string[] = [];

  if (currentResult.status === "rejected") errors.push(labels.current);
  if (latestResult.status === "rejected") errors.push(labels.latest);

  return {
    currentVersion,
    latestVersion,
    updateAvailable:
      currentVersion && latestVersion ? isNewerVersion(latestVersion, currentVersion) : null,
    ...(errors.length > 0 ? { error: errors.join(" ") } : {}),
  };
}

export function createVersionManager(dependencies: VersionManagerDependencies) {
  let upgradeRunning = false;
  const piCommand = dependencies.piCommand === undefined ? "pi" : dependencies.piCommand;

  function requirePiCommand() {
    if (piCommand) return piCommand;
    throw new VersionManagementError("COMMAND_FAILED", "Global Pi CLI was not found.");
  }

  return {
    async getVersions(): Promise<VersionsResponse> {
      const [pi, piWorkspace] = await Promise.all([
        buildVersionStatus(
          Promise.resolve()
            .then(() =>
              dependencies.runCommand(requirePiCommand(), ["--version"], {
                timeoutMs: 15_000,
                maxOutputBytes: 4_096,
              }),
            )
            .then((result) => result.stdout),
          dependencies.fetchLatestVersion("@earendil-works/pi-coding-agent"),
          {
            current: "Unable to read the current Pi version.",
            latest: "Unable to check the latest Pi version.",
          },
        ),
        buildVersionStatus(
          dependencies.readWorkspaceVersion(),
          dependencies.fetchLatestVersion("pi-workspace"),
          {
            current: "Unable to read the current pi-workspace version.",
            latest: "Unable to check the latest pi-workspace version.",
          },
        ),
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
            ? { command: requirePiCommand(), args: ["update"] }
            : {
                command: dependencies.nodePath,
                args: [dependencies.workspaceBinPath, "update"],
              };
        const commandOptions = { timeoutMs: 10 * 60_000, maxOutputBytes: 65_536 };

        try {
          await dependencies.runCommand(definition.command, definition.args, commandOptions);
        } catch (initialError) {
          const managedInitialError = asVersionManagementError(initialError);
          if (!isPermissionFailure(managedInitialError)) throw managedInitialError;

          dependencies.logError?.(
            `[version-upgrade] ${target} permission denied; retrying with sudo -n: ${managedInitialError.logDetail || managedInitialError.message}`,
          );

          try {
            await dependencies.runCommand(
              "sudo",
              ["-n", definition.command, ...definition.args],
              commandOptions,
            );
          } catch (sudoError) {
            const managedSudoError = asVersionManagementError(sudoError);
            if (isSudoAuthorizationFailure(managedSudoError)) {
              throw new VersionManagementError(
                "COMMAND_FAILED",
                "Administrator permission is required. Run `sudo -v` in a terminal, then try again.",
                managedSudoError.logDetail,
                buildInteractiveSudoCommand(definition.command, definition.args),
              );
            }
            throw managedSudoError;
          }
        }

        return {
          target: target as UpgradeTarget,
          ok: true as const,
          currentVersion: null,
          restartRequired: target === "pi-workspace",
          message:
            target === "pi-workspace"
              ? "pi-workspace was upgraded. Restart it to use the new version."
              : "Pi was upgraded successfully.",
        };
      } catch (error) {
        const managedError = asVersionManagementError(error);
        dependencies.logError?.(
          `[version-upgrade] ${target} failed: ${managedError.logDetail || managedError.message}`,
        );
        throw managedError;
      } finally {
        upgradeRunning = false;
      }
    },
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
        const detail = sanitizeCommandOutput(stderr || stdout, 16_384);
        finishWithError(
          new VersionManagementError(
            "OUTPUT_LIMIT",
            "The version command produced too much output.",
            detail || undefined,
          ),
        );
        return;
      }
      if (target === "stdout") stdout += chunk.toString();
      else stderr += chunk.toString();
    };
    timeout = setTimeout(() => {
      const detail = sanitizeCommandOutput(stderr || stdout, 16_384);
      const publicDetail = sanitizeCommandOutput(stderr || stdout, 4_096);
      finishWithError(
        new VersionManagementError(
          "TIMEOUT",
          publicDetail
            ? `The version command timed out: ${publicDetail}`
            : "The version command timed out.",
          detail || undefined,
        ),
      );
    }, timeoutMs);

    child.stdout.on("data", (chunk: Buffer) => appendOutput("stdout", chunk));
    child.stderr.on("data", (chunk: Buffer) => appendOutput("stderr", chunk));
    child.on("error", (error) => {
      const detail = sanitizeCommandOutput(error.message, 16_384);
      finishWithError(
        new VersionManagementError(
          "COMMAND_FAILED",
          detail
            ? `The version command could not be started: ${sanitizeCommandOutput(detail, 4_096)}`
            : "The version command could not be started.",
          detail || undefined,
        ),
      );
    });
    child.on("close", (code) => {
      if (timeout) clearTimeout(timeout);
      if (settled) return;
      settled = true;
      if (code !== 0) {
        const detail = sanitizeCommandOutput(stderr || stdout, 16_384);
        const publicDetail = sanitizeCommandOutput(stderr || stdout, 4_096);
        reject(
          new VersionManagementError(
            "COMMAND_FAILED",
            publicDetail
              ? `The version command failed with exit code ${code ?? "unknown"}: ${publicDetail}`
              : `The version command failed with exit code ${code ?? "unknown"}.`,
            detail || undefined,
          ),
        );
        return;
      }
      resolve({ stdout, stderr });
    });
  });

async function fetchLatestVersion(packageName: string) {
  const response = await fetch(
    `https://registry.npmjs.org/${encodeURIComponent(packageName)}/latest`,
    { headers: { accept: "application/json" } },
  );
  if (!response.ok) throw new Error("Registry request failed");
  const body = (await response.json()) as { version?: unknown };
  if (typeof body.version !== "string")
    throw new Error("Registry response did not include a version");
  return body.version;
}

export function createDefaultVersionManager() {
  const projectRoot = path.resolve(import.meta.dirname, "..");
  const packageJsonPath = path.join(projectRoot, "package.json");

  return createVersionManager({
    runCommand,
    fetchLatestVersion,
    async readWorkspaceVersion() {
      const packageJson = JSON.parse(await readFile(packageJsonPath, "utf8")) as {
        version?: unknown;
      };
      if (typeof packageJson.version !== "string") throw new Error("Missing package version");
      return packageJson.version;
    },
    workspaceBinPath: path.join(projectRoot, "bin", "pi-workspace.mjs"),
    nodePath: process.execPath,
    piCommand: resolveGlobalPiCommand(process.env.PATH),
    logError: (message) => console.error(message),
  });
}
