#!/usr/bin/env node

import { spawn, execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");
const pkgPath = resolve(projectRoot, "package.json");
const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
const cliName = "pi-workspace";
const currentVersion = pkg.version;
const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";

// ── Help ──

function printHelp() {
  console.log(
    [
      `${cliName} v${currentVersion} - start the bundled pi-workspace service`,
      "",
      "Usage:",
      `  ${cliName}             Start the built service`,
      `  ${cliName} start       Start the built production server`,
      `  ${cliName} build       Build client and server bundles`,
      `  ${cliName} update      Check for updates and upgrade to the latest version`,
      `  ${cliName} --version   Show the installed version`,
      `  ${cliName} --help      Show this help message`,
      "",
      "Options:",
      "  --port <number>        Override PORT for the service",
    ].join("\n"),
  );
}

// ── Argument parser ──

function parseArgs(argv) {
  let command = "start";
  let port;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--help" || arg === "-h") {
      command = "help";
      continue;
    }

    if (arg === "--version" || arg === "-v") {
      command = "version";
      continue;
    }

    if (arg === "--port") {
      const value = argv[index + 1];
      if (!value || value.startsWith("-")) {
        throw new Error("Missing value for --port");
      }
      port = value;
      index += 1;
      continue;
    }

    if (
      arg === "start" ||
      arg === "build" ||
      arg === "help" ||
      arg === "check" ||
      arg === "update"
    ) {
      command = arg;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return { command, port };
}

// ── Process runner ──

function run(command, args, env = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      cwd: projectRoot,
      stdio: "inherit",
      env: { ...process.env, ...env },
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolvePromise();
        return;
      }

      reject(new Error(`${command} ${args.join(" ")} exited with code ${code ?? 1}`));
    });
  });
}

// ── Version helpers ──

function parseVersion(version) {
  const parts = version.replace(/^[vV]/, "").split(".");
  return parts.map((part) => {
    const num = Number.parseInt(part, 10);
    return Number.isNaN(num) ? 0 : num;
  });
}

function isNewerVersion(latest, current) {
  const l = parseVersion(latest);
  const c = parseVersion(current);

  for (let i = 0; i < Math.max(l.length, c.length); i++) {
    const lv = l[i] ?? 0;
    const cv = c[i] ?? 0;
    if (lv > cv) return true;
    if (lv < cv) return false;
  }

  return false;
}

// ── Update logic ──

function getPackageManager() {
  // Prefer pnpm if available (project uses pnpm as packageManager),
  // otherwise fall back to npm.
  try {
    execSync("pnpm --version", { stdio: "ignore" });
    return "pnpm";
  } catch {
    return npmCmd;
  }
}

async function fetchLatestVersion() {
  const result = execSync(`${npmCmd} view ${cliName} version`, { encoding: "utf8" });
  return result.trim();
}

function isGloballyInstalled() {
  return __dirname.includes("node_modules") && !__dirname.includes(projectRoot + "/node_modules");
}

async function checkForUpdate() {
  try {
    const latest = await fetchLatestVersion();

    if (!isNewerVersion(latest, currentVersion)) {
      console.log(`[${cliName}] You're on the latest version (v${currentVersion}).`);
      return null;
    }

    console.log(`[${cliName}] Update available: v${currentVersion} → v${latest}`);
    return latest;
  } catch (error) {
    throw new Error(
      `Failed to check for updates: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

async function handleUpdate() {
  const latestVersion = await checkForUpdate();
  if (!latestVersion) return;

  const global = isGloballyInstalled();

  if (global) {
    const pm = getPackageManager();
    const installArgs =
      pm === "pnpm" ? ["add", "-g", `${cliName}@latest`] : ["install", "-g", `${cliName}@latest`];

    console.log(
      `[${cliName}] Installing v${latestVersion} via \`${pm} ${installArgs.join(" ")}\`...`,
    );
    await run(pm, installArgs);
    console.log(`[${cliName}] Updated to v${latestVersion}.`);
  } else {
    // Local development copy – rebuild from source
    console.log(`[${cliName}] Local development copy detected. Rebuilding...`);
    console.log(`[${cliName}] Pulling latest source...`);
    await run("git", ["pull", "--rebase"]);
    const pm = getPackageManager();
    console.log(`[${cliName}] Installing dependencies...`);
    await run(pm, ["install"]);
    console.log(`[${cliName}] Building...`);
    await run(npmCmd, ["run", "build"]);
    console.log(`[${cliName}] Updated to v${latestVersion}.`);
  }
}

// ── Build guard ──

async function ensureBuild(env) {
  const hasServerBuild = existsSync(resolve(projectRoot, "dist-server", "index.mjs"));
  const hasClientBuild = existsSync(resolve(projectRoot, "dist", "client", "index.html"));

  if (hasServerBuild && hasClientBuild) return;

  const canBuildFromSource =
    existsSync(resolve(projectRoot, "server")) &&
    existsSync(resolve(projectRoot, "client")) &&
    existsSync(resolve(projectRoot, "package.json"));

  if (!canBuildFromSource) {
    throw new Error("Bundled build output is missing from this package.");
  }

  console.log(`[${cliName}] build output not found, running npm run build...`);
  await run(npmCmd, ["run", "build"], env);
}

// ── Entry point ──

async function main() {
  const { command, port } = parseArgs(process.argv.slice(2));

  if (command === "help") {
    printHelp();
    return;
  }

  if (command === "version") {
    console.log(`v${currentVersion}`);
    return;
  }

  if (command === "check") {
    await checkForUpdate();
    return;
  }

  if (command === "update") {
    await handleUpdate();
    return;
  }

  const env = port ? { PORT: port } : {};

  if (command === "build") {
    await run(npmCmd, ["run", "build"], env);
    return;
  }

  await ensureBuild(env);
  await run(process.execPath, ["dist-server/index.mjs"], {
    ...env,
    NODE_ENV: "production",
  });
}

main().catch((error) => {
  console.error(`[${cliName}] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
