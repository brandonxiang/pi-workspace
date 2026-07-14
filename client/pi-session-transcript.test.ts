import { describe, expect, it } from "vite-plus/test";
import { groupPiHistoryMessages } from "./pi-session-transcript";
import type { PiHistoryMessage } from "./types";

describe("groupPiHistoryMessages", () => {
  it("groups Pi assistant final output, thinking, and tool records into a single turn", () => {
    const messages: PiHistoryMessage[] = [
      {
        id: "user-1",
        role: "user",
        content: "Question",
        timestamp: 1,
      },
      {
        id: "thinking-1",
        role: "thinking",
        content: "Plan A",
        timestamp: 2,
      },
      {
        id: "assistant-1",
        role: "assistant",
        content: "Answer",
        provider: "openai",
        model: "gpt-4o-mini",
        timestamp: 3,
      },
      {
        id: "tool-1",
        role: "tool",
        toolName: "read_file",
        content: "file output",
        isError: false,
        expandable: true,
        timestamp: 4,
      },
      {
        id: "tool-2",
        role: "tool",
        toolName: "search",
        content: "search output",
        isError: false,
        expandable: true,
        timestamp: 5,
      },
    ];

    expect(groupPiHistoryMessages(messages)).toEqual([
      messages[0],
      {
        id: "assistant-turn-assistant-1",
        role: "assistant-turn",
        finalMessage: messages[2],
        thinking: messages[1],
        tools: [messages[3], messages[4]],
        timestamp: 3,
      },
    ]);
  });

  it("keeps unrelated tool records split from the next assistant turn", () => {
    const messages: PiHistoryMessage[] = [
      {
        id: "tool-1",
        role: "tool",
        toolName: "read_file",
        content: "file output",
        isError: false,
        expandable: true,
        timestamp: 1,
      },
      {
        id: "assistant-1",
        role: "assistant",
        content: "Answer",
        provider: "openai",
        model: "gpt-4o-mini",
        timestamp: 2,
      },
      {
        id: "tool-2",
        role: "tool",
        toolName: "search",
        content: "search output",
        isError: false,
        expandable: true,
        timestamp: 3,
      },
    ];

    expect(groupPiHistoryMessages(messages)).toEqual([
      messages[0],
      {
        id: "assistant-turn-assistant-1",
        role: "assistant-turn",
        finalMessage: messages[1],
        tools: [messages[2]],
        timestamp: 2,
      },
    ]);
  });

  it("merges multiple thinking records into a single assistant turn", () => {
    const messages: PiHistoryMessage[] = [
      {
        id: "thinking-1",
        role: "thinking",
        content: "Plan A",
        timestamp: 1,
      },
      {
        id: "thinking-2",
        role: "thinking",
        content: " + Plan B",
        timestamp: 2,
      },
      {
        id: "assistant-1",
        role: "assistant",
        content: "Final answer",
        provider: "openai",
        model: "gpt-4o-mini",
        timestamp: 3,
      },
    ];

    expect(groupPiHistoryMessages(messages)).toEqual([
      {
        id: "assistant-turn-assistant-1",
        role: "assistant-turn",
        finalMessage: messages[2],
        thinking: {
          id: "thinking-group-thinking-1",
          role: "thinking",
          content: "Plan A + Plan B",
          timestamp: 1,
        },
        tools: [],
        timestamp: 3,
      },
    ]);
  });
});
