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

export async function fetchSessionCommands(sessionId: string): Promise<SessionCommandsResponse> {
  const response = await fetch(`/api/pi-sessions/${encodeURIComponent(sessionId)}/commands`);
  if (!response.ok) {
    if (response.status === 404) return { commands: [] };
    const body = (await response.json().catch(() => null)) as { error?: string };
    throw new Error(body?.error || "Failed to load session commands");
  }
  return (await response.json()) as SessionCommandsResponse;
}
