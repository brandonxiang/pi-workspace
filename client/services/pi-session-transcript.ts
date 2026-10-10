import type { PiHistoryMessage } from "../types/index";

type PiThinkingMessage = Extract<PiHistoryMessage, { role: "thinking" }>;
type PiAssistantMessage = Extract<PiHistoryMessage, { role: "assistant" }>;
type PiToolMessage = Extract<PiHistoryMessage, { role: "tool" }>;
type PiAgentMessage = PiThinkingMessage | PiAssistantMessage | PiToolMessage;

export type PiHistoryTranscriptEntry =
  | PiHistoryMessage
  | {
      id: string;
      role: "assistant-turn";
      finalMessage: PiAssistantMessage;
      previousMessages: PiAssistantMessage[];
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

function isAssistantTurnBoundary(message: PiHistoryMessage) {
  return (
    message.role === "user" ||
    message.role === "steering" ||
    message.role === "local_result" ||
    message.role === "summary"
  );
}

export function groupPiHistoryMessages(messages: PiHistoryMessage[]): PiHistoryTranscriptEntry[] {
  const entries: PiHistoryTranscriptEntry[] = [];
  let pendingAgentMessages: PiAgentMessage[] = [];

  function flushPendingAgentMessages() {
    if (pendingAgentMessages.length === 0) return;

    const assistants = pendingAgentMessages.filter(
      (message): message is PiAssistantMessage => message.role === "assistant",
    );
    const finalMessage = assistants[assistants.length - 1];
    const thinking = mergeThinkingMessages(
      pendingAgentMessages.filter(
        (message): message is PiThinkingMessage => message.role === "thinking",
      ),
    );
    const tools = pendingAgentMessages.filter(
      (message): message is PiToolMessage => message.role === "tool",
    );

    // A buffer with no assistant text has no result to attach to; keep its
    // thinking and tools as standalone entries.
    if (!finalMessage) {
      if (thinking) {
        entries.push(thinking);
      }
      entries.push(...tools);
      pendingAgentMessages = [];
      return;
    }

    entries.push({
      id: `assistant-turn-${finalMessage.id}`,
      role: "assistant-turn",
      finalMessage,
      previousMessages: assistants.slice(0, -1),
      ...(thinking ? { thinking } : {}),
      tools,
      timestamp: finalMessage.timestamp,
    });

    pendingAgentMessages = [];
  }

  for (let index = 0; index < messages.length; index += 1) {
    const message = messages[index];

    if (message.role === "thinking") {
      pendingAgentMessages.push(message);
      continue;
    }

    if (message.role === "assistant") {
      pendingAgentMessages.push(message);
      continue;
    }

    if (message.role === "tool") {
      pendingAgentMessages.push(message);
      continue;
    }

    if (isAssistantTurnBoundary(message)) {
      flushPendingAgentMessages();
      entries.push(message);
      continue;
    }

    flushPendingAgentMessages();
    entries.push(message);
  }

  flushPendingAgentMessages();
  return entries;
}
