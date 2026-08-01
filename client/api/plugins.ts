import type { PiPluginsResponse, PiPluginCommand } from "../types";

export interface SessionCommandsResponse {
  commands?: PiPluginCommand[];
  error?: string;
}

export async function fetchPiPlugins(reload = false): Promise<PiPluginsResponse> {
  const response = await fetch(reload ? "/api/pi-plugins/reload" : "/api/pi-plugins", {
    method: reload ? "POST" : "GET",
  });
  const body = (await response.json().catch(() => null)) as PiPluginsResponse & {
    error?: string;
  };
  if (!response.ok) throw new Error(body.error || "Failed to load Pi plugins");
  return body;
}

export type PiPluginsUpdateResult =
  | { ok: true; message: string; output?: string }
  | {
      ok: false;
      error: string;
      detail?: string;
      requiresInteractiveSudo?: boolean;
      interactiveCommand?: string;
    };

export async function updatePiPlugins(actionToken?: string): Promise<PiPluginsUpdateResult> {
  const response = await fetch("/api/pi-plugins/update", {
    method: "POST",
    headers: actionToken ? { "x-pi-workspace-action-token": actionToken } : {},
  });
  const body = (await response.json().catch(() => null)) as PiPluginsUpdateResult;
  if (!response.ok) {
    const failure = body as {
      error?: string;
      detail?: string;
      requiresInteractiveSudo?: boolean;
      interactiveCommand?: string;
    };
    return {
      ok: false,
      error: failure.error || "Failed to update Pi packages",
      detail: failure.detail,
      requiresInteractiveSudo: failure.requiresInteractiveSudo,
      interactiveCommand: failure.interactiveCommand,
    };
  }
  const success = body as { message?: string; output?: string };
  return { ok: true, message: success.message || "Pi packages updated.", output: success.output };
}

export async function fetchSessionCommands(sessionId: string): Promise<SessionCommandsResponse> {
  const response = await fetch(`/api/pi-sessions/${encodeURIComponent(sessionId)}/commands`);
  if (!response.ok) {
    if (response.status === 404) return { commands: [] };
    const body = (await response.json().catch(() => null)) as { error?: string };
    throw new Error(body?.error || "Failed to load session commands");
  }
  return (await response.json()) as SessionCommandsResponse;
}
