/**
 * Post-install script for pi-workspace.
 *
 * npm does not preserve executable permissions on prebuilt native binaries
 * when extracting tarballs. This script ensures node-pty's spawn-helper
 * binary is executable so terminal functionality works out of the box.
 */

import { chmodSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { platform, arch } from "node:os";

const __dirname = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(__dirname, "..");

function fixNodePtyPermissions() {
  const ptyDir = resolve(projectRoot, "node_modules", "node-pty");

  if (!existsSync(ptyDir)) {
    // node-pty not installed (e.g. devDependencies only install)
    return;
  }

  const prebuildDir = resolve(ptyDir, "prebuilds", `${platform()}-${arch()}`);
  const spawnHelper = resolve(prebuildDir, "spawn-helper");
  const ptyNode = resolve(prebuildDir, "pty.node");

  for (const file of [spawnHelper, ptyNode]) {
    if (existsSync(file)) {
      try {
        chmodSync(file, 0o755);
      } catch {
        // May fail on readonly filesystem, not critical
      }
    }
  }
}

fixNodePtyPermissions();
