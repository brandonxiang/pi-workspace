import type { PiHistoryMessage } from "./types";

type PiThinkingMessage = Extract<PiHistoryMessage, { role: "thinking" }>;
type PiAssistantMessage = Extract<PiHistoryMessage, { role: "assistant" }>;
type PiToolMessage = Extract<PiHistoryMessage, { role: "tool" }>;

export type PiHistoryTranscriptEntry =
  | PiHistoryMessage
  | {
      id: string;
      role: "assistant-turn";
      finalMessage: PiAssistantMessage;
      thinking?: PiThinkingMessage;
      tools: PiToolMessage[];
      timestamp: number;
    };

function mergeThinkingMessages(messages: PiThinkingMessage[]): PiThinkingMessage | undefined {
  if (messages.length === 0) return undefined;
  if (messages.length === 1) return messages[0];

  return {
    id: `thinking-group-${messages[0].id}`,
    role: "thinking",
    content: messages.map((message) => message.content).join(""),
    timestamp: messages[0].timestamp,
  };
}

export function groupPiHistoryMessages(messages: PiHistoryMessage[]): PiHistoryTranscriptEntry[] {
  const entries: PiHistoryTranscriptEntry[] = [];
  let pendingThinking: PiThinkingMessage[] = [];

  function flushPendingThinking() {
    const mergedThinking = mergeThinkingMessages(pendingThinking);
    if (mergedThinking) {
      entries.push(mergedThinking);
    }
    pendingThinking = [];
  }

  for (let index = 0; index < messages.length; index += 1) {
    const message = messages[index];

    if (message.role === "thinking") {
      pendingThinking.push(message);
      continue;
    }

    if (message.role === "assistant") {
      const tools: PiToolMessage[] = [];
      let lookaheadIndex = index + 1;

      while (lookaheadIndex < messages.length && messages[lookaheadIndex].role === "tool") {
        tools.push(messages[lookaheadIndex] as PiToolMessage);
        lookaheadIndex += 1;
      }

      entries.push({
        id: `assistant-turn-${message.id}`,
        role: "assistant-turn",
        finalMessage: message,
        thinking: mergeThinkingMessages(pendingThinking),
        tools,
        timestamp: message.timestamp,
      });
      pendingThinking = [];
      index = lookaheadIndex - 1;
      continue;
    }

    flushPendingThinking();
    entries.push(message);
  }

  flushPendingThinking();
  return entries;
}
