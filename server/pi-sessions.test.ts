import { describe, expect, it } from "vitest";
import {
  buildPiSessionDetail,
  findSessionById,
  groupSessionsByProject,
  inferBranchModel,
  normalizeBranchEntries,
  truncateFirstMessage
} from "./pi-sessions.js";

interface SessionInfoFixture {
  id: string;
  cwd: string;
  path: string;
  name?: string;
  created: Date;
  modified: Date;
  messageCount: number;
  firstMessage: string;
  allMessagesText: string;
}

interface SessionEntryFixture {
  type: string;
  id: string;
  parentId: string | null;
  timestamp: string;
  [key: string]: unknown;
}

function makeSession(overrides: Partial<SessionInfoFixture>): SessionInfoFixture {
  return {
    id: "test-session-id",
    cwd: "/Users/test/github/my-pi",
    path: "/some/path.jsonl",
    created: new Date("2026-06-01T00:00:00Z"),
    modified: new Date("2026-06-13T12:00:00Z"),
    messageCount: 10,
    firstMessage: "Hello, can you help me with X?",
    allMessagesText: "",
    ...overrides
  };
}

function makeEntry(overrides: Partial<SessionEntryFixture>): SessionEntryFixture {
  return {
    type: "message",
    id: "entry-id",
    parentId: null,
    timestamp: "2026-06-13T12:00:00.000Z",
    ...overrides
  };
}

describe("groupSessionsByProject", () => {
  it("groups sessions by project directory name", () => {
    const sessions = [
      makeSession({
        id: "session-1",
        cwd: "/Users/test/github/my-pi",
        firstMessage: "First message in my-pi",
        modified: new Date("2026-06-10T12:00:00Z")
      }),
      makeSession({
        id: "session-2",
        cwd: "/Users/test/github/my-pi",
        firstMessage: "Second message in my-pi",
        modified: new Date("2026-06-13T12:00:00Z")
      }),
      makeSession({
        id: "session-3",
        cwd: "/Users/test/github/geo-position",
        firstMessage: "Message in geo-position"
      })
    ];

    const result = groupSessionsByProject(sessions);

    expect(result).toHaveLength(2);

    const myPi = result.find((p) => p.name === "my-pi")!;
    expect(myPi).toBeDefined();
    expect(myPi.path).toBe("/Users/test/github/my-pi");
    expect(myPi.sessions).toHaveLength(2);
    expect(myPi.sessions[0].id).toBe("session-2"); // most recently modified first
    expect(myPi.sessions[1].id).toBe("session-1");

    const geo = result.find((p) => p.name === "geo-position")!;
    expect(geo).toBeDefined();
    expect(geo.sessions).toHaveLength(1);
  });

  it("sorts projects alphabetically by name", () => {
    const sessions = [
      makeSession({ cwd: "/Users/test/github/zed", id: "zed" }),
      makeSession({ cwd: "/Users/test/github/abc", id: "abc" }),
      makeSession({ cwd: "/Users/test/github/my-pi", id: "my-pi" })
    ];

    const result = groupSessionsByProject(sessions);

    expect(result.map((p) => p.name)).toEqual(["abc", "my-pi", "zed"]);
  });

  it("sorts sessions within each project by modified time descending", () => {
    const sessions = [
      makeSession({
        id: "old",
        cwd: "/Users/test/github/my-pi",
        modified: new Date("2026-06-01T00:00:00Z")
      }),
      makeSession({
        id: "new",
        cwd: "/Users/test/github/my-pi",
        modified: new Date("2026-06-13T00:00:00Z")
      }),
      makeSession({
        id: "mid",
        cwd: "/Users/test/github/my-pi",
        modified: new Date("2026-06-10T00:00:00Z")
      })
    ];

    const result = groupSessionsByProject(sessions);

    const project = result[0];
    expect(project.sessions.map((s) => s.id)).toEqual(["new", "mid", "old"]);
  });

  it("extracts project name from various cwd formats", () => {
    const cases = [
      { cwd: "/Users/test/github/my-pi", expected: "my-pi" },
      { cwd: "/home/user/projects/some-tool", expected: "some-tool" },
      { cwd: "/Users/test/work/client-project", expected: "client-project" }
    ];

    const sessions = cases.map((c, i) =>
      makeSession({ cwd: c.cwd, id: `s-${i}` })
    );

    const result = groupSessionsByProject(sessions);

    expect(result).toHaveLength(3);
    for (const c of cases) {
      const project = result.find((p) => p.name === c.expected);
      expect(project).toBeDefined();
      expect(project!.path).toBe(c.cwd);
    }
  });

  it("handles empty session list", () => {
    const result = groupSessionsByProject([]);
    expect(result).toEqual([]);
  });

  it("handles sessions with empty cwd", () => {
    const sessions = [
      makeSession({ cwd: "", id: "no-cwd" })
    ];

    const result = groupSessionsByProject(sessions);

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("(unknown)");
    expect(result[0].sessions).toHaveLength(1);
  });

  it("collapses projects with same name but different paths correctly", () => {
    const sessions = [
      makeSession({ id: "a", cwd: "/Users/test/github/my-pi" }),
      makeSession({ id: "b", cwd: "/Users/other/github/my-pi" })
    ];

    const result = groupSessionsByProject(sessions);

    // Two projects with same name but different paths should be separate groups
    expect(result).toHaveLength(2);
  });

  it("truncates long first messages", () => {
    const longMessage = "A".repeat(300);
    const result = truncateFirstMessage(longMessage);
    expect(result).toHaveLength(121); // 120 chars + "…"
    expect(result.endsWith("…")).toBe(true);
    expect(result.slice(0, 120)).toBe("A".repeat(120));
  });

  it("does not truncate short first messages", () => {
    const shortMessage = "Hello, world!";
    expect(truncateFirstMessage(shortMessage)).toBe(shortMessage);
  });
});

describe("findSessionById", () => {
  it("returns an exact session id match", () => {
    const sessions = [
      makeSession({ id: "019ec12b-alpha" }),
      makeSession({ id: "019ec12b-beta" })
    ];

    expect(findSessionById(sessions, "019ec12b-beta")?.id).toBe("019ec12b-beta");
  });

  it("does not match partial session ids", () => {
    const sessions = [
      makeSession({ id: "019ec12b-alpha" })
    ];

    expect(findSessionById(sessions, "019ec12b")).toBeNull();
  });
});

describe("normalizeBranchEntries", () => {
  it("normalizes user, assistant, tool and summary entries in branch order", () => {
    const entries = [
      makeEntry({
        id: "user-1",
        message: {
          role: "user",
          content: "Show me the saved session",
          timestamp: 1
        }
      }),
      makeEntry({
        id: "assistant-1",
        message: {
          role: "assistant",
          content: [
            { type: "thinking", thinking: "internal notes" },
            { type: "text", text: "I found the active branch." },
            {
              type: "toolCall",
              id: "tool-call-1",
              name: "read_file",
              arguments: { path: "/tmp/demo.ts" }
            }
          ],
          provider: "anthropic",
          model: "claude-sonnet-4-5",
          timestamp: 2
        }
      }),
      makeEntry({
        id: "tool-result-1",
        message: {
          role: "toolResult",
          toolCallId: "tool-call-1",
          toolName: "read_file",
          content: [{ type: "text", text: "export const demo = true;" }],
          isError: false,
          timestamp: 3
        }
      }),
      makeEntry({
        type: "compaction",
        id: "compaction-1",
        summary: "Older planning steps were compacted.",
        tokensBefore: 321
      }),
      makeEntry({
        type: "branch_summary",
        id: "branch-summary-1",
        summary: "A discarded branch explored another UI layout.",
        fromId: "assistant-1"
      }),
      makeEntry({
        id: "custom-display-1",
        message: {
          role: "custom",
          customType: "note",
          content: "Pinned checkpoint",
          display: true,
          timestamp: 4
        }
      }),
      makeEntry({
        id: "bash-1",
        message: {
          role: "bashExecution",
          command: "pnpm run test",
          output: "PASS server/pi-sessions.test.ts",
          exitCode: 0,
          cancelled: false,
          truncated: false,
          timestamp: 5
        }
      })
    ];

    expect(normalizeBranchEntries(entries)).toEqual([
      {
        id: "user-1",
        role: "user",
        content: "Show me the saved session",
        images: undefined,
        timestamp: 1
      },
      {
        id: "assistant-1",
        role: "assistant",
        content: "I found the active branch.",
        model: "claude-sonnet-4-5",
        provider: "anthropic",
        timestamp: 2
      },
      {
        id: "assistant-1:tool-call-1",
        role: "tool",
        toolName: "read_file",
        content: '{\n  "path": "/tmp/demo.ts"\n}',
        isError: false,
        expandable: true,
        timestamp: 2
      },
      {
        id: "tool-result-1",
        role: "tool",
        toolName: "read_file",
        content: "export const demo = true;",
        isError: false,
        expandable: true,
        timestamp: 3
      },
      {
        id: "compaction-1",
        role: "summary",
        summaryType: "compaction",
        title: "Compaction Summary",
        content: "Older planning steps were compacted.",
        timestamp: Date.parse("2026-06-13T12:00:00.000Z")
      },
      {
        id: "branch-summary-1",
        role: "summary",
        summaryType: "branch",
        title: "Branch Summary",
        content: "A discarded branch explored another UI layout.",
        timestamp: Date.parse("2026-06-13T12:00:00.000Z")
      },
      {
        id: "custom-display-1",
        role: "summary",
        summaryType: "custom",
        title: "Custom Note",
        content: "Pinned checkpoint",
        timestamp: 4
      },
      {
        id: "bash-1",
        role: "tool",
        toolName: "bash",
        content: "$ pnpm run test\nPASS server/pi-sessions.test.ts",
        isError: false,
        expandable: true,
        timestamp: 5
      }
    ]);
  });

  it("preserves user images and omits hidden custom messages and thinking-only assistant content", () => {
    const entries = [
      makeEntry({
        id: "user-image-1",
        message: {
          role: "user",
          content: [
            { type: "text", text: "Look at this screenshot" },
            { type: "image", data: "abc123", mimeType: "image/png" }
          ],
          timestamp: 10
        }
      }),
      makeEntry({
        id: "assistant-thinking-only",
        message: {
          role: "assistant",
          content: [{ type: "thinking", thinking: "not for display" }],
          provider: "openai",
          model: "gpt-4o-mini",
          timestamp: 11
        }
      }),
      makeEntry({
        id: "custom-hidden-1",
        message: {
          role: "custom",
          customType: "secret",
          content: "do not show",
          display: false,
          timestamp: 12
        }
      })
    ];

    expect(normalizeBranchEntries(entries)).toEqual([
      {
        id: "user-image-1",
        role: "user",
        content: "Look at this screenshot",
        images: [
          {
            id: "user-image-1-image-0",
            data: "abc123",
            mimeType: "image/png",
            name: "Pi session image 1"
          }
        ],
        timestamp: 10
      }
    ]);
  });
});

describe("buildPiSessionDetail", () => {
  it("uses the custom session name and derived project name in the detail payload", () => {
    const session = makeSession({
      id: "session-42",
      cwd: "/Users/test/github/my-pi",
      name: "Implement session viewer",
      firstMessage: "fallback title"
    });

    const detail = buildPiSessionDetail(session, [
      makeEntry({
        id: "user-1",
        message: {
          role: "user",
          content: "hi",
          timestamp: 1
        }
      })
    ]);

    expect(detail.session).toEqual({
      id: "session-42",
      name: "Implement session viewer",
      cwd: "/Users/test/github/my-pi",
      projectName: "my-pi",
      created: "2026-06-01T00:00:00.000Z",
      modified: "2026-06-13T12:00:00.000Z"
    });
    expect(detail.messages).toHaveLength(1);
  });
});

describe("inferBranchModel", () => {
  it("prefers the latest model_change entry on the active branch", () => {
    const entries = [
      makeEntry({
        type: "model_change",
        id: "model-1",
        provider: "openai",
        modelId: "gpt-4o-mini"
      }),
      makeEntry({
        id: "assistant-1",
        message: {
          role: "assistant",
          content: [{ type: "text", text: "first reply" }],
          provider: "openai",
          model: "gpt-4o-mini",
          timestamp: 1
        }
      }),
      makeEntry({
        type: "model_change",
        id: "model-2",
        provider: "anthropic",
        modelId: "claude-sonnet-4-5"
      })
    ];

    expect(inferBranchModel(entries)).toEqual({
      provider: "anthropic",
      modelId: "claude-sonnet-4-5"
    });
  });

  it("falls back to the latest assistant message model when no model_change exists", () => {
    const entries = [
      makeEntry({
        id: "assistant-1",
        message: {
          role: "assistant",
          content: [{ type: "text", text: "reply" }],
          provider: "google",
          model: "gemini-2.5-flash",
          timestamp: 1
        }
      })
    ];

    expect(inferBranchModel(entries)).toEqual({
      provider: "google",
      modelId: "gemini-2.5-flash"
    });
  });
});
