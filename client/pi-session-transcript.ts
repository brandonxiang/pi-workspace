import type { PiHistoryMessage } from "./types";

export type PiHistoryTranscriptEntry =
  | PiHistoryMessage
  | {
      id: string;
      role: "tool-group";
      messages: Extract<PiHistoryMessage, { role: "tool" }>[];
      timestamp: number;
    };

export function groupPiHistoryMessages(messages: PiHistoryMessage[]): PiHistoryTranscriptEntry[] {
  const entries: PiHistoryTranscriptEntry[] = [];
  let activeToolGroup: Extract<PiHistoryTranscriptEntry, { role: "tool-group" }> | null = null;

  function flushToolGroup() {
    if (!activeToolGroup) return;
    entries.push(activeToolGroup);
    activeToolGroup = null;
  }

  for (const message of messages) {
    if (message.role === "tool") {
      if (!activeToolGroup) {
        activeToolGroup = {
          id: `tool-group-${message.id}`,
          role: "tool-group",
          messages: [message],
          timestamp: message.timestamp,
        };
      } else {
        activeToolGroup.messages.push(message);
      }

      continue;
    }

    flushToolGroup();
    entries.push(message);
  }

  flushToolGroup();
  return entries;
}
