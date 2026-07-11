import { describe, expect, it } from "vitest";
import type { PiSessionProject } from "./types.js";
import { resolveInitialPiSessionSelection } from "./pi-session-launch.js";

function makeProject(
  path: string,
  sessions: Array<{ id: string; modified: string }>,
): PiSessionProject {
  return {
    name: path.split("/").at(-1) || path,
    path,
    sessions: sessions.map((session, index) => ({
      id: session.id,
      name: `Session ${index + 1}`,
      firstMessage: `First message ${index + 1}`,
      messageCount: 1,
      created: session.modified,
      modified: session.modified,
    })),
  };
}

describe("resolveInitialPiSessionSelection", () => {
  it("restores the stored Pi Session when it still exists", () => {
    const projects: PiSessionProject[] = [
      makeProject("/Users/test/github/alpha", [
        { id: "alpha-new", modified: "2026-06-20T12:00:00.000Z" },
      ]),
      makeProject("/Users/test/github/pi-workspace", [
        { id: "stored-session", modified: "2026-06-19T12:00:00.000Z" },
        { id: "other-session", modified: "2026-06-18T12:00:00.000Z" },
      ]),
    ];

    expect(
      resolveInitialPiSessionSelection({
        storedSessionId: "stored-session",
        storedProjectPath: "/Users/test/github/pi-workspace",
        projects,
      }),
    ).toEqual({
      kind: "pi",
      sessionId: "stored-session",
    });
  });

  it("falls back to the newest Pi Session in the stored project when the stored Session is gone", () => {
    const projects: PiSessionProject[] = [
      makeProject("/Users/test/github/alpha", [
        { id: "alpha-new", modified: "2026-06-20T12:00:00.000Z" },
      ]),
      makeProject("/Users/test/github/pi-workspace", [
        { id: "project-newest", modified: "2026-06-19T12:00:00.000Z" },
        { id: "project-older", modified: "2026-06-18T12:00:00.000Z" },
      ]),
    ];

    expect(
      resolveInitialPiSessionSelection({
        storedSessionId: "missing-session",
        storedProjectPath: "/Users/test/github/pi-workspace",
        projects,
      }),
    ).toEqual({
      kind: "pi",
      sessionId: "project-newest",
    });
  });

  it("returns the empty state when neither the stored Session nor its project has any Pi Sessions", () => {
    const projects: PiSessionProject[] = [
      makeProject("/Users/test/github/alpha", [
        { id: "alpha-new", modified: "2026-06-20T12:00:00.000Z" },
      ]),
    ];

    expect(
      resolveInitialPiSessionSelection({
        storedSessionId: "missing-session",
        storedProjectPath: "/Users/test/github/pi-workspace",
        projects,
      }),
    ).toEqual({
      kind: "empty",
    });
  });
});
