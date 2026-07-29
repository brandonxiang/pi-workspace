/**
 * Post-install script for pi-workspace.
 *
 * npm does not preserve executable permissions on prebuilt native binaries
 * when extracting tarballs. This script ensures node-pty's spawn-helper
 * binary is executable so terminal functionality works out of the box.
 *
 * If the files are owned by root (e.g. installed via `sudo npm install -g`),
 * this script attempts `sudo chmod` if the normal chmod fails.
 */

import { chmodSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { platform, arch } from "node:os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");

function fixNodePtyPermissions() {
  const ptyDir = resolve(projectRoot, "node_modules", "node-pty");
  if (!existsSync(ptyDir)) return;

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
