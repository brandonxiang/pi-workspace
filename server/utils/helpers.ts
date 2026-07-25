import type { ServerResponse } from "node:http";
import { createExtensionRuntime, type ResourceLoader } from "@earendil-works/pi-coding-agent";

export function sendEvent(res: ServerResponse, event: unknown) {
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

export function buildResourceLoader(systemPrompt: string): ResourceLoader {
  return {
    getExtensions: () => ({ extensions: [], errors: [], runtime: createExtensionRuntime() }),
    getSkills: () => ({ skills: [], diagnostics: [] }),
    getPrompts: () => ({ prompts: [], diagnostics: [] }),
    getThemes: () => ({ themes: [], diagnostics: [] }),
    getAgentsFiles: () => ({ agentsFiles: [] }),
    getSystemPrompt: () => systemPrompt,
    getAppendSystemPrompt: () => [],
    extendResources: () => {},
    reload: async () => {},
  };
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function readStringField(value: unknown, key: string) {
  return isRecord(value) && typeof value[key] === "string" ? value[key] : undefined;
}
