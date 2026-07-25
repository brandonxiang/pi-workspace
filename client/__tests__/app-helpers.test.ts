// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vite-plus/test";
import {
  getImageDataUrl,
  getModelKey,
  getWorkspaceName,
  isPanelModeShortcut,
  isSidebarToggleShortcut,
  isSteeringSubmitShortcut,
  parseModelKey,
  readEventStream,
  readStoredFollowUpQueues,
  readStoredFollowUpsForSession,
  readStoredThinkingLevel,
  writeStoredFollowUpsForSession,
} from "../app-helpers";

describe("getImageDataUrl", () => {
  it("returns a data URL from mime type and base64 data", () => {
    const result = getImageDataUrl({ mimeType: "image/png", data: "abc123" });
    expect(result).toBe("data:image/png;base64,abc123");
  });
});

describe("getModelKey", () => {
  it("combines provider and model with colon separator", () => {
    expect(getModelKey("openai", "gpt-4o")).toBe("openai:gpt-4o");
  });
});

describe("parseModelKey", () => {
  it("splits provider and model on colon", () => {
    expect(parseModelKey("anthropic:claude-3")).toEqual({
      provider: "anthropic",
      model: "claude-3",
    });
  });

  it("returns defaults when no colon is present", () => {
    expect(parseModelKey("invalid")).toEqual({
      provider: "openai",
      model: "gpt-4o-mini",
    });
  });
});

describe("isSidebarToggleShortcut", () => {
  it("matches Cmd+B", () => {
    expect(
      isSidebarToggleShortcut({
        key: "b",
        metaKey: true,
        ctrlKey: false,
        altKey: false,
        shiftKey: false,
      }),
    ).toBe(true);
  });

  it("does not match when Alt is pressed", () => {
    expect(
      isSidebarToggleShortcut({
        key: "b",
        metaKey: true,
        ctrlKey: false,
        altKey: true,
        shiftKey: false,
      }),
    ).toBe(false);
  });

  it("does not match when Shift is pressed", () => {
    expect(
      isSidebarToggleShortcut({
        key: "b",
        metaKey: true,
        ctrlKey: false,
        altKey: false,
        shiftKey: true,
      }),
    ).toBe(false);
  });

  it("does not match unrelated keys", () => {
    expect(
      isSidebarToggleShortcut({
        key: "a",
        metaKey: true,
        ctrlKey: false,
        altKey: false,
        shiftKey: false,
      }),
    ).toBe(false);
  });
});

describe("isPanelModeShortcut", () => {
  it("matches Ctrl+'", () => {
    expect(
      isPanelModeShortcut({
        key: "'",
        metaKey: false,
        ctrlKey: true,
        altKey: false,
        shiftKey: false,
      }),
    ).toBe(true);
  });

  it("does not match with Alt modifier", () => {
    expect(
      isPanelModeShortcut({
        key: "'",
        metaKey: false,
        ctrlKey: true,
        altKey: true,
        shiftKey: false,
      }),
    ).toBe(false);
  });
});

describe("isSteeringSubmitShortcut", () => {
  it("matches Cmd+Enter", () => {
    expect(isSteeringSubmitShortcut({ key: "Enter", metaKey: true, ctrlKey: false })).toBe(true);
  });

  it("matches Ctrl+Enter", () => {
    expect(isSteeringSubmitShortcut({ key: "Enter", metaKey: false, ctrlKey: true })).toBe(true);
  });

  it("does not match Enter alone", () => {
    expect(isSteeringSubmitShortcut({ key: "Enter", metaKey: false, ctrlKey: false })).toBe(false);
  });
});

describe("getWorkspaceName", () => {
  it("extracts the last directory name from a path", () => {
    expect(getWorkspaceName("/Users/user/github/my-project")).toBe("my-project");
  });

  it("handles trailing slash", () => {
    expect(getWorkspaceName("/Users/user/github/my-project/")).toBe("my-project");
  });

  it("returns 'workspace' for empty path", () => {
    expect(getWorkspaceName("")).toBe("workspace");
  });
});

describe("readStoredThinkingLevel", () => {
  beforeEach(() => localStorage.clear());

  it("returns stored thinking level", () => {
    localStorage.setItem("my-pi-thinking-level", "low");
    expect(readStoredThinkingLevel()).toBe("low");
  });

  it("returns 'high' when nothing is stored", () => {
    expect(readStoredThinkingLevel()).toBe("high");
  });

  it("returns 'high' when localStorage throws", () => {
    const getItem = vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("Storage error");
    });
    expect(readStoredThinkingLevel()).toBe("high");
    getItem.mockRestore();
  });
});

describe("follow-up queue storage", () => {
  beforeEach(() => localStorage.clear());

  it("readStoredFollowUpQueues returns empty object when nothing stored", () => {
    expect(readStoredFollowUpQueues()).toEqual({});
  });

  it("writes and reads follow-up queues", () => {
    const messages = [{ id: "1", content: "hello" }];
    writeStoredFollowUpsForSession("session-1", messages);
    expect(readStoredFollowUpsForSession("session-1")).toEqual(messages);
  });

  it("removes queue when writing empty array", () => {
    writeStoredFollowUpsForSession("session-1", [{ id: "1", content: "hello" }]);
    writeStoredFollowUpsForSession("session-1", []);
    expect(readStoredFollowUpsForSession("session-1")).toEqual([]);
  });
});

describe("readEventStream", () => {
  it("parses SSE events from response body", async () => {
    const encoder = new TextEncoder();
    const body = new ReadableStream({
      start(controller) {
        controller.enqueue(
          encoder.encode(
            'data: {"type":"delta","delta":"Hello"}\n\ndata: {"type":"delta","delta":" World"}\n\n',
          ),
        );
        controller.close();
      },
    });

    const events: unknown[] = [];
    await readEventStream({ body, ok: true } as Response, (event) => {
      events.push(event);
    });

    expect(events).toEqual([
      { type: "delta", delta: "Hello" },
      { type: "delta", delta: " World" },
    ]);
  });

  it("throws when response has no body", async () => {
    await expect(readEventStream({} as Response, vi.fn())).rejects.toThrow(
      "No response stream returned.",
    );
  });
});
