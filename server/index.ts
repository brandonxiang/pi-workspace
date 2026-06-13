import Fastify from "fastify";
import FastifyVite from "@fastify/vite";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import {
  AuthStorage,
  createAgentSession,
  createExtensionRuntime,
  ModelRegistry,
  SessionManager,
  SettingsManager,
  type AgentSession,
  type ResourceLoader
} from "@earendil-works/pi-coding-agent";
import {
  getModelSupportsImages,
  getPromptOrDefault,
  parseImages,
  type ImageContent
} from "./chat-validation.js";
import { groupSessionsByProject } from "./pi-sessions.js";

interface ChatRequest {
  provider?: string;
  model?: string;
  systemPrompt?: string;
  prompt?: string;
  images?: ChatImage[];
}

interface AgentSessionRecord {
  session: AgentSession;
  provider: string;
  model: string;
  systemPrompt: string;
}

interface ChatImage {
  name?: string;
  mimeType?: string;
  data?: string;
  size?: number;
}

const providerApiKeyEnv: Record<string, string> = {
  openai: "OPENAI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
  google: "GOOGLE_API_KEY",
  mistral: "MISTRAL_API_KEY",
  openrouter: "OPENROUTER_API_KEY",
  commandcode: "COMMANDCODE_API_KEY"
};

const commandCodeProviderBaseUrl =
  process.env.COMMANDCODE_API_BASE || "https://api.commandcode.ai/provider";
const commandCodeModelsUrl =
  process.env.COMMANDCODE_MODELS_URL || "https://api.commandcode.ai/provider/v1/models";
const commandCodeOpenAiBaseUrl = `${commandCodeProviderBaseUrl.replace(/\/$/, "")}/v1`;
const commandCodeAnthropicBaseUrl = commandCodeProviderBaseUrl.replace(/\/$/, "");
const commandCodeDefaultMaxTokens = 65_536;

interface CommandCodeApiModel {
  id: string;
  name: string;
  context_length: number;
}

const port = Number(process.env.PORT || 8787);
const sessions = new Map<string, AgentSessionRecord>();

function sendEvent(res: import("node:http").ServerResponse, event: unknown) {
  res.write(`data: ${JSON.stringify(event)}\n\n`);
}

function buildResourceLoader(systemPrompt: string): ResourceLoader {
  return {
    getExtensions: () => ({ extensions: [], errors: [], runtime: createExtensionRuntime() }),
    getSkills: () => ({ skills: [], diagnostics: [] }),
    getPrompts: () => ({ prompts: [], diagnostics: [] }),
    getThemes: () => ({ themes: [], diagnostics: [] }),
    getAgentsFiles: () => ({ agentsFiles: [] }),
    getSystemPrompt: () => systemPrompt,
    getAppendSystemPrompt: () => [],
    extendResources: () => {},
    reload: async () => {}
  };
}

function configureRuntimeAuth(authStorage: AuthStorage) {
  for (const [provider, envName] of Object.entries(providerApiKeyEnv)) {
    const value = process.env[envName];
    if (value) authStorage.setRuntimeApiKey(provider, value);
  }

  const commandCodeApiKey = readCommandCodeApiKey();
  if (commandCodeApiKey) authStorage.setRuntimeApiKey("commandcode", commandCodeApiKey);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readStringField(value: unknown, key: string) {
  return isRecord(value) && typeof value[key] === "string" ? value[key] : undefined;
}

function readCommandCodeCredential(value: unknown) {
  if (!isRecord(value)) return undefined;

  if (value.type === "api") return readStringField(value, "key");
  if (value.type === "oauth") return readStringField(value, "access");

  return readStringField(value, "key") || readStringField(value, "access");
}

function readCommandCodeApiKey() {
  if (process.env.COMMANDCODE_API_KEY) return process.env.COMMANDCODE_API_KEY;

  const authPaths = [
    path.join(homedir(), ".commandcode", "auth.json"),
    path.join(homedir(), ".pi", "agent", "auth.json")
  ];

  for (const authPath of authPaths) {
    try {
      if (!existsSync(authPath)) continue;
      const parsed = JSON.parse(readFileSync(authPath, "utf-8")) as unknown;
      if (!isRecord(parsed)) continue;

      const apiKey =
        readStringField(parsed, "apiKey") ||
        readStringField(parsed, "commandcode") ||
        readCommandCodeCredential(parsed.commandcode) ||
        readCommandCodeCredential(parsed["command-code"]);

      if (apiKey) return apiKey;
    } catch {
      // Ignore malformed local auth files and let the normal missing-key path explain auth.
    }
  }

  return undefined;
}

function parseCommandCodeModels(value: unknown) {
  if (!isRecord(value) || value.object !== "list" || !Array.isArray(value.data)) {
    throw new Error("Unexpected Command Code model list response.");
  }

  return value.data
    .filter((model): model is CommandCodeApiModel => {
      if (!isRecord(model)) return false;
      return (
        typeof model.id === "string" &&
        typeof model.name === "string" &&
        typeof model.context_length === "number"
      );
    })
    .map((model) => {
      const isClaude = model.id.toLowerCase().startsWith("claude");

      return {
        id: model.id,
        name: `${model.name} (Command Code)`,
        api: isClaude ? "anthropic-messages" : "openai-completions",
        baseUrl: isClaude ? commandCodeAnthropicBaseUrl : commandCodeOpenAiBaseUrl,
        reasoning: true,
        input: ["text"] as ("text" | "image")[],
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
        contextWindow: model.context_length,
        maxTokens: Math.min(model.context_length, commandCodeDefaultMaxTokens),
        compat: isClaude
          ? undefined
          : {
              supportsDeveloperRole: false,
              supportsReasoningEffort: false,
              maxTokensField: "max_tokens" as const
            }
      };
    });
}

async function registerCommandCodeProvider(authStorage: AuthStorage, modelRegistry: ModelRegistry) {
  if (!authStorage.hasAuth("commandcode")) return;

  const response = await fetch(commandCodeModelsUrl, {
    headers: { accept: "application/json" }
  });
  if (!response.ok) {
    throw new Error(
      `Failed to fetch Command Code models: ${response.status} ${response.statusText}`
    );
  }

  const models = parseCommandCodeModels(await response.json());
  modelRegistry.registerProvider("commandcode", {
    name: "Command Code",
    baseUrl: commandCodeOpenAiBaseUrl,
    apiKey: "COMMANDCODE_API_KEY",
    authHeader: true,
    api: "openai-completions",
    headers: {
      "x-cli-environment": "production"
    },
    models
  });
}

async function createLocalModelRegistry() {
  const authStorage = AuthStorage.create();
  configureRuntimeAuth(authStorage);
  const modelRegistry = ModelRegistry.create(authStorage);
  await registerCommandCodeProvider(authStorage, modelRegistry);

  return {
    authStorage,
    modelRegistry
  };
}

async function getOrCreateSession(
  sessionId: string,
  provider: string,
  modelId: string,
  systemPrompt: string
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

  const { authStorage, modelRegistry } = await createLocalModelRegistry();
  const model = modelRegistry.find(provider, modelId);

  if (!model) {
    throw new Error(`Unknown model: ${provider}/${modelId}`);
  }

  if (!modelRegistry.hasConfiguredAuth(model)) {
    const envName = providerApiKeyEnv[provider] || `${provider.toUpperCase()}_API_KEY`;
    throw new Error(`Missing ${envName}`);
  }

  const { session } = await createAgentSession({
    cwd: process.cwd(),
    agentDir: path.join(process.cwd(), ".my-pi-agent"),
    authStorage,
    modelRegistry,
    model,
    thinkingLevel: "off",
    noTools: "all",
    resourceLoader: buildResourceLoader(systemPrompt),
    sessionManager: SessionManager.inMemory(process.cwd()),
    settingsManager: SettingsManager.inMemory({
      compaction: { enabled: false },
      retry: { enabled: true, maxRetries: 1 }
    })
  });

  sessions.set(sessionId, {
    session,
    provider,
    model: modelId,
    systemPrompt
  });

  return session;
}

async function buildServer() {
  const server = Fastify({
    bodyLimit: 8 * 1024 * 1024
  });

  await server.register(FastifyVite, {
    root: path.resolve(import.meta.dirname, ".."),
    dev: process.argv.includes("--dev"),
    spa: true
  });

  // ──────── API routes ────────

  server.get("/api/health", async (_request, _reply) => {
    return { ok: true };
  });

  server.get("/api/pi-sessions", async (_request, reply) => {
    try {
      const sessions = await SessionManager.listAll();
      const projects = groupSessionsByProject(sessions);
      return { projects };
    } catch (error) {
      reply.code(500);
      return {
        error: error instanceof Error ? error.message : "Failed to list Pi sessions"
      };
    }
  });

  server.get("/api/models", async (_request, reply) => {
    try {
      const { modelRegistry } = await createLocalModelRegistry();
      const models = modelRegistry.getAvailable().map((model) => ({
        provider: model.provider,
        model: model.id,
        label: `${model.name || model.id} (${model.provider})`,
        supportsImages: getModelSupportsImages(model)
      }));

      return { models };
    } catch (error) {
      reply.code(500);
      return {
        error: error instanceof Error ? error.message : "Failed to load models"
      };
    }
  });

  server.post("/api/chat", async (request, reply) => {
    const body = request.body as ChatRequest;
    const provider = body.provider || "openai";
    const modelId = body.model || "gpt-4o-mini";
    let images: ImageContent[];
    try {
      images = parseImages(body.images);
    } catch (error) {
      reply.code(400);
      return {
        error: error instanceof Error ? error.message : "Invalid image attachment"
      };
    }
    const prompt = getPromptOrDefault(body.prompt, images);
    const sessionId =
      (request.headers["x-session-id"] as string | undefined) || "default";
    const systemPrompt =
      body.systemPrompt?.trim() ||
      "You are My Pi, a concise online agent assistant. Ask clarifying questions when requirements are incomplete.";

    if (!prompt) {
      reply.code(400);
      return { error: "prompt is required" };
    }

    if (images.length > 0) {
      try {
        const { modelRegistry } = await createLocalModelRegistry();
        const model = modelRegistry.find(provider, modelId);
        if (!model || !getModelSupportsImages(model)) {
          reply.code(400);
          return {
            error: `Model ${provider}/${modelId} does not support image input`
          };
        }
      } catch (error) {
        reply.code(500);
        return {
          error:
            error instanceof Error ? error.message : "Failed to validate image model support"
        };
      }
    }

    // ── SSE streaming via raw response ──
    reply.hijack();
    const raw = reply.raw;
    raw.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive"
    });

    try {
      const session = await getOrCreateSession(
        sessionId,
        provider,
        modelId,
        systemPrompt
      );
      let finalText = "";

      const unsubscribe = session.subscribe((event) => {
        if (
          event.type === "message_update" &&
          event.assistantMessageEvent.type === "text_delta"
        ) {
          finalText += event.assistantMessageEvent.delta;
          sendEvent(raw, { type: "delta", delta: event.assistantMessageEvent.delta });
        }

        if (
          event.type === "message_update" &&
          event.assistantMessageEvent.type === "thinking_delta"
        ) {
          sendEvent(raw, { type: "thinking", delta: event.assistantMessageEvent.delta });
        }

        if (event.type === "agent_end") {
          sendEvent(raw, {
            type: "done",
            message: {
              role: "assistant",
              content: finalText,
              provider,
              model: modelId,
              timestamp: Date.now()
            }
          });
        }
      });

      try {
        await session.prompt(prompt, images.length > 0 ? { images } : undefined);
      } finally {
        unsubscribe();
      }
    } catch (error) {
      sendEvent(raw, {
        type: "error",
        error: error instanceof Error ? error.message : "Unexpected server error"
      });
    } finally {
      raw.end();
    }
  });

  // SPA catch-all: serve index.html for any non-API route
  server.setNotFoundHandler((_request, reply) => {
    return reply.html();
  });

  await server.vite.ready();
  return server;
}

const server = await buildServer();

server.listen({ port, host: "127.0.0.1" }, (error, address) => {
  if (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
  console.log(`My Pi server listening on ${address}`);
});
