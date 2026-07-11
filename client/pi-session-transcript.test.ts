import { describe, expect, it } from "vite-plus/test";
import { groupPiHistoryMessages } from "./pi-session-transcript";
import type { PiHistoryMessage } from "./types";

describe("groupPiHistoryMessages", () => {
  it("groups adjacent tool records into a single transcript entry", () => {
    const messages: PiHistoryMessage[] = [
      {
        id: "user-1",
        role: "user",
        content: "Question",
        timestamp: 1,
      },
      {
        id: "tool-1",
        role: "tool",
        toolName: "read_file",
        content: "file output",
        isError: false,
        expandable: true,
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
      {
        id: "assistant-1",
        role: "assistant",
        content: "Answer",
        provider: "openai",
        model: "gpt-4o-mini",
        timestamp: 4,
      },
    ];

    expect(groupPiHistoryMessages(messages)).toEqual([
      messages[0],
      {
        id: "tool-group-tool-1",
        role: "tool-group",
        messages: [messages[1], messages[2]],
        timestamp: 2,
      },
      messages[3],
    ]);
  });

  it("keeps separate tool groups split by non-tool transcript items", () => {
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
      {
        id: "tool-group-tool-1",
        role: "tool-group",
        messages: [messages[0]],
        timestamp: 1,
      },
      messages[1],
      {
        id: "tool-group-tool-2",
        role: "tool-group",
        messages: [messages[2]],
        timestamp: 3,
      },
    ]);
  });
});
