import { chmodSync, existsSync } from "node:fs";
import type { Server } from "node:http";
import { platform, arch } from "node:os";
import { resolve } from "node:path";
import { spawn } from "node-pty";
import { WebSocketServer } from "ws";

const terminalPtyMap = new Map<import("ws").WebSocket, import("node-pty").IPty>();
let terminalWss: WebSocketServer | null = null;

/**
 * npm does not preserve executable permissions on prebuilt native binaries
 * when extracting tarballs. This ensures node-pty's spawn-helper binary is
 * executable before any PTY is spawned.
 */
function fixNodePtyPermissions() {
  const prebuildDir = resolve(
    import.meta.dirname,
    "..",
    "..",
    "node_modules",
    "node-pty",
    "prebuilds",
    `${platform()}-${arch()}`,
  );

  for (const file of ["spawn-helper", "pty.node"]) {
    const fullPath = resolve(prebuildDir, file);
    if (existsSync(fullPath)) {
      try {
        chmodSync(fullPath, 0o755);
      } catch {
        // May not have permission (e.g., root-owned files installed via sudo).
        // The spawn will fail later with a clear error message.
      }
    }
  }
}

/**
 * Auto-launch a Pi CLI command in the terminal.
 * Accepts a `cmd` query param — executes it ~600ms after shell starts.
 */
export function setupTerminalWebSocket(httpServer: Server) {
  fixNodePtyPermissions();
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on("upgrade", (request, socket, head) => {
    const url = new URL(request.url || "/", `http://${request.headers.host || "localhost"}`);
    if (url.pathname !== "/api/terminal") return;

    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request);
    });
  });

  wss.on("connection", (ws, req) => {
    const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
    const cwd = url.searchParams.get("cwd") || process.cwd();
    const cmd = url.searchParams.get("cmd") || "";
    const shell = process.env.SHELL || "/bin/zsh";

    let pty: import("node-pty").IPty | null = null;

    try {
      pty = spawn(shell, [], {
        cwd,
        name: "xterm-256color",
        env: { ...process.env } as Record<string, string>,
      });
    } catch (err) {
      ws.close(1011, `Failed to spawn PTY: ${err instanceof Error ? err.message : String(err)}`);
      return;
    }

    terminalPtyMap.set(ws, pty);

    pty.onData((data) => {
      if (ws.readyState === 1 /* OPEN */) {
        ws.send(data);
      }
    });

    // Auto-execute initial command after shell prompt appears
    if (cmd) {
      let cmdSent = false;
      const cmdTimer = setTimeout(() => {
        if (pty && !cmdSent) {
          cmdSent = true;
          pty.write(cmd + "\n");
        }
      }, 600);
      // Clear on WS close
      ws.on("close", () => clearTimeout(cmdTimer));
      ws.on("error", () => clearTimeout(cmdTimer));
    }

    ws.on("message", (raw) => {
      if (!pty) return;

      try {
        const parsed = JSON.parse(
          // eslint-disable-next-line @typescript-eslint/no-base-to-string
          typeof raw === "string" ? raw : Buffer.isBuffer(raw) ? raw.toString() : String(raw),
        );
        if (
          parsed.type === "resize" &&
          typeof parsed.cols === "number" &&
          typeof parsed.rows === "number"
        ) {
          pty.resize(parsed.cols, parsed.rows);
        } else if (parsed.type === "input" && typeof parsed.data === "string") {
          pty.write(parsed.data);
        }
      } catch {
        // If parsing fails, treat as raw input (plain text from non-JSON clients)
        pty.write(
          // eslint-disable-next-line @typescript-eslint/no-base-to-string
          typeof raw === "string" ? raw : Buffer.isBuffer(raw) ? raw.toString() : String(raw),
        );
      }
    });

    ws.on("close", () => {
      terminalPtyMap.delete(ws);
      if (pty) {
        try {
          pty.kill();
        } catch {
          // PTY already dead
        }
      }
      pty = null;
    });

    ws.on("error", () => {
      terminalPtyMap.delete(ws);
      if (pty) {
        try {
          pty.kill();
        } catch {}
      }
      pty = null;
    });
  });

  return wss;
}

export function killAllTerminals() {
  for (const pty of terminalPtyMap.values()) {
    try {
      pty.kill();
    } catch {}
  }
  terminalPtyMap.clear();
}

export function getTerminalWss() {
  return terminalWss;
}

export function setTerminalWss(wss: WebSocketServer | null) {
  terminalWss = wss;
}
