#!/usr/bin/env node

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");
const cliName = "pi-workspace";
const npmCmd = process.platform === "win32" ? "npm.cmd" : "npm";

function printHelp() {
  console.log(
    [
      `${cliName} - start the bundled pi-workspace service`,
      "",
      "Usage:",
      `  ${cliName}             Start the built service`,
      `  ${cliName} start       Start the built production server`,
      `  ${cliName} build       Build client and server bundles`,
      `  ${cliName} --help      Show this help message`,
      "",
      "Options:",
      "  --port <number>        Override PORT for the service"
    ].join("\n")
  );
}

function parseArgs(argv) {
  let command = "start";
  let port;

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];

    if (arg === "--help" || arg === "-h") {
      command = "help";
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

    if (arg === "start" || arg === "build" || arg === "help") {
      command = arg;
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  return { command, port };
}

function run(command, args, env = {}) {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      cwd: projectRoot,
      stdio: "inherit",
      env: { ...process.env, ...env }
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

async function main() {
  const { command, port } = parseArgs(process.argv.slice(2));

  if (command === "help") {
    printHelp();
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
    NODE_ENV: "production"
  });
}

main().catch((error) => {
  console.error(`[${cliName}] ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
