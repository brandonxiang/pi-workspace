/**
 * Post-install script for pi-workspace.
 *
 * npm does not preserve executable permissions on prebuilt native binaries
 * when extracting tarballs. This script ensures node-pty's spawn-helper
 * binary is executable so terminal functionality works out of the box.
 *
 * The dependency is located through Node's module resolver so the script works
 * under both npm's nested layout (`<root>/node_modules/node-pty`) and pnpm's
 * isolated layout, where node-pty lives outside the package's own
 * node_modules directory.
 *
 * If the files are owned by root (e.g. installed via `sudo npm install -g`),
 * this script attempts `sudo chmod` if the normal chmod fails.
 */

import { chmodSync, existsSync, readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { platform, arch } from "node:os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");
const require = createRequire(import.meta.url);

/**
 * Locate the installed node-pty package directory, or `null` when it is not
 * installed (e.g. an optional dependency skipped on this platform).
 */
function findNodePtyDir() {
  // npm-style path first: works without resolution and covers nested installs.
  const npmStyleDir = resolve(projectRoot, "node_modules", "node-pty");
  if (existsSync(resolve(npmStyleDir, "package.json"))) return npmStyleDir;

  try {
    // `require.resolve` follows pnpm's symlinks out of the package's own
    // node_modules, then we walk up to the directory owning node-pty's
    // package.json.
    let dir = dirname(require.resolve("node-pty"));
    while (dir !== dirname(dir)) {
      const pkgFile = resolve(dir, "package.json");
      if (existsSync(pkgFile)) {
        const pkg = JSON.parse(readFileSync(pkgFile, "utf8"));
        if (pkg.name === "node-pty") return dir;
      }
      dir = dirname(dir);
    }
  } catch {
    // node-pty is not installed - nothing to fix.
  }

  return null;
}

function fixNodePtyPermissions() {
  const ptyDir = findNodePtyDir();
  if (!ptyDir) return;

  const prebuildDir = resolve(ptyDir, "prebuilds", `${platform()}-${arch()}`);

  for (const file of ["spawn-helper", "pty.node"]) {
    const fullPath = resolve(prebuildDir, file);
    if (!existsSync(fullPath)) continue;

    try {
      chmodSync(fullPath, 0o755);
    } catch {
      // File may be owned by root (sudo install). Try via sudo.
      try {
        execSync(`sudo chmod 755 ${fullPath}`, { stdio: "ignore" });
      } catch {
        // Neither approach worked - the server will attempt a runtime fix
        // before spawning PTYs, so this is non-fatal.
      }
    }
  }
}

fixNodePtyPermissions();
