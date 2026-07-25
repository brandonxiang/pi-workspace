import type { FastifyInstance } from "fastify";
import {
  getModelSupportsImages,
  getPromptOrDefault,
  parseImages,
  type ImageContent,
} from "../utils/chat-validation.js";
import { createLocalModelRegistry } from "../utils/auth.js";
import { sendEvent } from "../utils/helpers.js";
import { getOrCreateSession, createPersistedPiSession } from "../utils/session-helpers.js";
import { buildAgentEndStreamEvent } from "../utils/chat-streaming.js";
import { setSessionLifecycleStatusDefault } from "../utils/pi-sessions.js";
import type { ChatRequest } from "../model/index.js";

export function registerChatRoutes(server: FastifyInstance) {
  server.post("/api/chat", async (request, reply) => {
    const body = request.body as ChatRequest;
    const requestedProvider = body.provider;
    const requestedModelId = body.model;
    let images: ImageContent[];
    try {
      images = parseImages(body.images);
    } catch (error) {
      reply.code(400);
      return {
        error: error instanceof Error ? error.message : "Invalid image attachment",
      };
    }
    const prompt = getPromptOrDefault(body.prompt, images);
    const sessionId = (request.headers["x-session-id"] as string | undefined) || "default";
    const piSessionId = request.headers["x-pi-session-id"] as string | undefined;
    const systemPrompt =
      body.systemPrompt?.trim() ||
      "You are My Pi, a concise online agent assistant. Ask clarifying questions when requirements are incomplete.";

    if (!prompt) {
      reply.code(400);
      return { error: "prompt is required" };
    }

    if (images.length > 0) {
      try {
        if (piSessionId) {
          const persistedSession = await createPersistedPiSession(
            piSessionId,
            requestedProvider,
            requestedModelId,
          );
          persistedSession?.session.dispose();

          if (!persistedSession) {
            reply.code(404);
            return { error: "Pi session not found" };
          }

          if (persistedSession.provider !== "unknown" && persistedSession.modelId !== "unknown") {
            const { modelRegistry } = await createLocalModelRegistry();
            const model = modelRegistry.find(persistedSession.provider, persistedSession.modelId);
            if (!model || !getModelSupportsImages(model)) {
              reply.code(400);
              return {
                error: `Model ${persistedSession.provider}/${persistedSession.modelId} does not support image input`,
              };
            }
          }
        } else {
          const provider = requestedProvider || "openai";
          const modelId = requestedModelId || "gpt-4o-mini";
          const { modelRegistry } = await createLocalModelRegistry();
          const model = modelRegistry.find(provider, modelId);
          if (!model || !getModelSupportsImages(model)) {
            reply.code(400);
            return {
              error: `Model ${provider}/${modelId} does not support image input`,
            };
          }
        }
      } catch (error) {
        reply.code(500);
        return {
          error: error instanceof Error ? error.message : "Failed to validate image model support",
        };
      }
    }

    // ── SSE streaming via raw response ──
    reply.hijack();
    const raw = reply.raw;
    raw.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    });

    try {
      const persistedSession = piSessionId
        ? await createPersistedPiSession(piSessionId, requestedProvider, requestedModelId)
        : null;

      if (piSessionId && !persistedSession) {
        sendEvent(raw, {
          type: "error",
          error: "Pi session not found",
        });
        return;
      }

      const provider = persistedSession?.provider || requestedProvider || "openai";
      const modelId = persistedSession?.modelId || requestedModelId || "gpt-4o-mini";
      const session =
        persistedSession?.session ||
        (await getOrCreateSession(sessionId, provider, modelId, systemPrompt));
      // Auto lifecycle: AI starts processing → in_progress
      if (piSessionId) {
        setSessionLifecycleStatusDefault(piSessionId, "in_progress");
      }

      let finalText = "";

      const unsubscribe = session.subscribe((event) => {
        if (event.type === "message_update" && event.assistantMessageEvent.type === "text_delta") {
          finalText += event.assistantMessageEvent.delta;
          sendEvent(raw, { type: "delta", delta: event.assistantMessageEvent.delta });
        }

        if (
          event.type === "message_update" &&
          event.assistantMessageEvent.type === "thinking_delta"
        ) {
          sendEvent(raw, { type: "thinking", delta: event.assistantMessageEvent.delta });
        }

        if (event.type === "tool_execution_start") {
          sendEvent(raw, {
            type: "tool_start",
            toolName: event.toolName,
            toolCallId: event.toolCallId,
            args: typeof event.args === "string" ? event.args : JSON.stringify(event.args ?? {}),
          });
        }

        if (event.type === "tool_execution_update") {
          sendEvent(raw, {
            type: "tool_delta",
            toolName: event.toolName,
            toolCallId: event.toolCallId,
            delta:
              typeof event.partialResult === "string"
                ? event.partialResult
                : JSON.stringify(event.partialResult ?? ""),
          });
        }

        if (event.type === "tool_execution_end") {
          sendEvent(raw, {
            type: "tool_end",
            toolName: event.toolName,
            toolCallId: event.toolCallId,
            content:
              typeof event.result === "string" ? event.result : JSON.stringify(event.result ?? ""),
            isError: event.isError,
          });
        }

        if (event.type === "agent_end") {
          sendEvent(
            raw,
            buildAgentEndStreamEvent({
              messages: event.messages,
              finalText,
              provider,
              model: modelId,
            }),
          );
        }
      });

      try {
        if (body.thinkingLevel) {
          session.setThinkingLevel(body.thinkingLevel);
        }

        await session.prompt(prompt, images.length > 0 ? { images } : undefined);
      } finally {
        unsubscribe();
        // Auto lifecycle: AI finished → pending_review
        if (piSessionId) {
          setSessionLifecycleStatusDefault(piSessionId, "pending_review");
        }
        // Pi sessions are cached in piSessions map, so do NOT dispose() here.
        // Only dispose in-memory (local) sessions that were created per-request.
        if (!piSessionId) {
          persistedSession?.session.dispose();
        }
      }
    } catch (error) {
      sendEvent(raw, {
        type: "error",
        error: error instanceof Error ? error.message : "Unexpected server error",
      });
    } finally {
      raw.end();
    }
  });

  server.post("/api/chat/steer", async (request, reply) => {
    const body = request.body as ChatRequest;
    const requestedProvider = body.provider;
    const requestedModelId = body.model;
    const piSessionId = request.headers["x-pi-session-id"] as string | undefined;
    let images: ImageContent[];

    try {
      images = parseImages(body.images);
    } catch (error) {
      reply.code(400);
      return {
        error: error instanceof Error ? error.message : "Invalid image attachment",
      };
    }

    const prompt = getPromptOrDefault(body.prompt, images);
    if (!piSessionId?.trim()) {
      reply.code(400);
      return { error: "Pi session id is required" };
    }
    if (!prompt) {
      reply.code(400);
      return { error: "prompt is required" };
    }

    try {
      const persistedSession = await createPersistedPiSession(
        piSessionId,
        requestedProvider,
        requestedModelId,
      );

      if (!persistedSession) {
        reply.code(404);
        return { error: "Pi session not found" };
      }

      await persistedSession.session.sendCustomMessage(
        {
          customType: "steering",
          content:
            images.length > 0 ? [{ type: "text" as const, text: prompt }, ...images] : prompt,
          display: true,
        },
        { deliverAs: "steer" },
      );
      return { ok: true };
    } catch (error) {
      reply.code(500);
      return {
        error: error instanceof Error ? error.message : "Failed to steer Pi session",
      };
    }
  });
}
