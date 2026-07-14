#!/usr/bin/env node

import { spawn, execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Command } from "commander";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");
const pkgPath = resolve(projectRoot, "package.json");
const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
const cliName = "pi-workspace";
const currentVersion = pkg.version;
const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";

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

// ── CLI ──

function createProgram() {
  const program = new Command();

  program
    .name(cliName)
    .description("Start the built service")
    .usage("[options] [command]")
    .version(`v${currentVersion}`, "-v, --version", "Show the installed version")
    .helpOption("-h, --help", "Show this help message")
    .option("--port <number>", "Override PORT for the service")
    .argument("[command]")
    .addHelpText(
      "after",
      [
        "",
        "Commands:",
        "  check               Check whether a newer version is available",
        "  update              Check for updates and upgrade to the latest version",
        "  help                Show this help message",
      ].join("\n"),
    )
    .action(async (command) => {
      const { port } = program.opts();

      if (command === undefined) {
        const env = port ? { PORT: port } : {};

        await ensureBuild(env);
        await run(process.execPath, ["dist-server/index.mjs"], {
          ...env,
          NODE_ENV: "production",
        });
        return;
      }

      if (command === "help") {
        program.outputHelp();
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

      throw new Error(`Unknown argument: ${command}`);
    });

  return program;
}

// ── Entry point ──

async function main() {
  await createProgram().parseAsync(process.argv);
}

main().catch((error) => {
  console.error(`[${cliName}] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
