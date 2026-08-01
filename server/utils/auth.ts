import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import path from "node:path";
import { ModelRegistry, ModelRuntime, readStoredCredential } from "@earendil-works/pi-coding-agent";
import type { CommandCodeApiModel } from "../model/index.js";

const commandCodeProviderBaseUrl =
  process.env.COMMANDCODE_API_BASE || "https://api.commandcode.ai/provider";
const commandCodeModelsUrl =
  process.env.COMMANDCODE_MODELS_URL || "https://api.commandcode.ai/provider/v1/models";
const commandCodeOpenAiBaseUrl = `${commandCodeProviderBaseUrl.replace(/\/$/, "")}/v1`;
const commandCodeAnthropicBaseUrl = commandCodeProviderBaseUrl.replace(/\/$/, "");
const commandCodeDefaultMaxTokens = 65_536;

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
  const authPaths = [
    path.join(homedir(), ".commandcode", "auth.json"),
    path.join(homedir(), ".pi", "agent", "auth.json"),
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

export async function configureRuntimeAuth(modelRuntime: ModelRuntime) {
  const commandCodeApiKey = readCommandCodeApiKey();
  if (commandCodeApiKey) {
    await modelRuntime.setRuntimeApiKey("commandcode", commandCodeApiKey);
  }
}

export function getMissingAuthMessage(provider: string) {
  if (provider === "commandcode") {
    return "Missing local Command Code auth. Sign in with Command Code CLI or add ~/.commandcode/auth.json.";
  }

  return `Missing local ${provider} auth. Sign in with Pi CLI or add credentials to ~/.pi/agent/auth.json.`;
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
              maxTokensField: "max_tokens" as const,
            },
      };
    });
}

async function registerCommandCodeProvider(
  modelRuntime: ModelRuntime,
  modelRegistry: ModelRegistry,
) {
  // Mirror the old hasAuth guard: only fetch and register the provider when a
  // local Command Code credential exists (key file or auth.json entry).
  if (!readCommandCodeApiKey() && !readStoredCredential("commandcode")) return;

  const response = await fetch(commandCodeModelsUrl, {
    headers: { accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(
      `Failed to fetch Command Code models: ${response.status} ${response.statusText}`,
    );
  }

  const models = parseCommandCodeModels(await response.json());
  modelRegistry.registerProvider("commandcode", {
    name: "Command Code",
    baseUrl: commandCodeOpenAiBaseUrl,
    apiKey: "local-commandcode-auth",
    authHeader: true,
    api: "openai-completions",
    headers: {
      "x-cli-environment": "production",
    },
    models,
  });
}

export async function createLocalModelRegistry() {
  const modelRuntime = await ModelRuntime.create();
  await configureRuntimeAuth(modelRuntime);
  const modelRegistry = new ModelRegistry(modelRuntime);
  await registerCommandCodeProvider(modelRuntime, modelRegistry);

  return {
    modelRuntime,
    modelRegistry,
  };
}
