/// <reference types="node" />

import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vite-plus/test";

const cliSource = fileURLToPath(new URL("../bin/pi-workspace.mjs", import.meta.url));
const repoRoot = resolve(dirname(cliSource), "..");
const fixtureRoots: string[] = [];

function runCli(...args: string[]) {
  const fixtureRoot = mkdtempSync(resolve(tmpdir(), "pi-workspace-cli-"));
  const cliPath = resolve(fixtureRoot, "bin/pi-workspace.mjs");
  fixtureRoots.push(fixtureRoot);

  mkdirSync(dirname(cliPath), { recursive: true });
  copyFileSync(cliSource, cliPath);
  symlinkSync(resolve(repoRoot, "node_modules"), resolve(fixtureRoot, "node_modules"), "junction");
  writeFileSync(
    resolve(fixtureRoot, "package.json"),
    JSON.stringify({ name: "pi-workspace", version: "0.3.0", type: "module" }),
  );

  return spawnSync(process.execPath, [cliPath, ...args], {
    cwd: fixtureRoot,
    encoding: "utf8",
  });
}

afterEach(() => {
  for (const fixtureRoot of fixtureRoots.splice(0)) {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

describe("pi-workspace CLI", () => {
  it("omits the removed start and build subcommands from help", () => {
    const result = runCli("--help");

    expect(result.status).toBe(0);
    expect(result.stdout).toContain("Usage: pi-workspace [options] [command]");
    expect(result.stdout).not.toContain("pi-workspace start");
    expect(result.stdout).not.toContain("pi-workspace build");
    expect(result.stdout).toContain("check");
    expect(result.stdout).toContain("update");
  });

  it.each(["start", "build"])("rejects the removed %s subcommand", (command) => {
    const result = runCli(command);

    expect(result.status).toBe(1);
    expect(result.stderr).toContain(`Unknown argument: ${command}`);
  });

  it("keeps the version command available", () => {
    const result = runCli("--version");

    expect(result.status).toBe(0);
    expect(result.stdout.trim()).toBe("v0.3.0");
  });
});
