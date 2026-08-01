import path from "node:path";
import {
  createAgentSession,
  getAgentDir,
  SessionManager,
  SettingsManager,
} from "@earendil-works/pi-coding-agent";
import { createLocalModelRegistry, getMissingAuthMessage } from "./auth.js";
import { buildResourceLoader } from "./helpers.js";
import type { AgentSessionRecord, PiAgentSessionRecord } from "../model/index.js";
import {
  loadPiSessionContextById,
  loadPiSessionDetailById,
  findSessionById,
} from "./pi-sessions.js";

const sessions = new Map<string, AgentSessionRecord>();
// Cache Pi agent sessions keyed by Pi session ID so they persist across requests.
export const piSessions = new Map<string, PiAgentSessionRecord>();

export async function getOrCreateSession(
  sessionId: string,
  provider: string,
  modelId: string,
  systemPrompt: string,
) {
  const existing = sessions.get(sessionId);
  if (
    existing &&
    existing.provider === provider &&
    existing.model === modelId &&
    existing.systemPrompt === systemPrompt
  ) {
    return existing.session;
  }

  existing?.session.dispose();

  const { modelRuntime, modelRegistry } = await createLocalModelRegistry();
  const model = modelRegistry.find(provider, modelId);

  if (!model) {
    throw new Error(`Unknown model: ${provider}/${modelId}`);
  }

  if (!modelRegistry.hasConfiguredAuth(model)) {
    throw new Error(getMissingAuthMessage(provider));
  }

  const { session } = await createAgentSession({
    cwd: process.cwd(),
    agentDir: path.join(process.cwd(), ".my-pi-agent"),
    modelRuntime,
    model,
    resourceLoader: buildResourceLoader(systemPrompt),
    sessionManager: SessionManager.create(process.cwd()),
    settingsManager: SettingsManager.inMemory({
      compaction: { enabled: true },
      retry: { enabled: true, maxRetries: 1 },
    }),
  });

  sessions.set(sessionId, {
    session,
    provider,
    model: modelId,
    systemPrompt,
  });

  return session;
}

export async function createPersistedPiSession(
  piSessionId: string,
  provider?: string,
  modelId?: string,
) {
  // Reuse a cached Pi agent session if available.
  const cached = piSessions.get(piSessionId);
  if (cached) return cached;

  const context = await loadPiSessionContextById(piSessionId);
  if (!context) return null;

  const { modelRuntime, modelRegistry } = await createLocalModelRegistry();
  const resolvedProvider = provider || context.model?.provider;
  const resolvedModelId = modelId || context.model?.modelId;
  const model =
    resolvedProvider && resolvedModelId
      ? modelRegistry.find(resolvedProvider, resolvedModelId)
      : undefined;

  if (model && !modelRegistry.hasConfiguredAuth(model)) {
    throw new Error(getMissingAuthMessage(model.provider));
  }

  const { session } = await createAgentSession({
    cwd: context.session.cwd,
    modelRuntime,
    model,
    sessionManager: context.sessionManager,
    settingsManager: SettingsManager.create(context.session.cwd, getAgentDir()),
  });

  const record: PiAgentSessionRecord = {
    session,
    provider: model?.provider || resolvedProvider || "unknown",
    modelId: model?.id || resolvedModelId || "unknown",
  };

  piSessions.set(piSessionId, record);
  return record;
}

export async function persistSessionName(sessionId: string, name: string) {
  const trimmedName = name.trim();
  if (!trimmedName) {
    throw new Error("name is required");
  }

  const localSession = sessions.get(sessionId);
  if (localSession) {
    localSession.session.sessionManager.appendSessionInfo(trimmedName);
    return trimmedName;
  }

  const allSessions = await SessionManager.listAll();
  const match = findSessionById(allSessions, sessionId);
  if (!match) {
    throw new Error("Session not found");
  }

  const sessionManager = SessionManager.open(match.path);
  sessionManager.appendSessionInfo(trimmedName);
  return trimmedName;
}

export async function readSessionName(sessionId: string) {
  const localSession = sessions.get(sessionId);
  if (localSession) {
    return localSession.session.sessionManager.getSessionName() || "";
  }

  const detail = await loadPiSessionDetailById(sessionId);
  if (!detail) {
    throw new Error("Session not found");
  }

  return detail.session.name || "";
}
