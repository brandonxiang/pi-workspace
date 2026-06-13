import { describe, expect, it } from "vitest";
import { groupSessionsByProject, truncateFirstMessage } from "./pi-sessions.js";

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
