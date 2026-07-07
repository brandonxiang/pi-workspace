import { describe, expect, it } from "vitest";
import {
  filterProjectsByArchiveState,
  ensureExpandedProjectPaths,
  getVisibleProjectSessions,
  sortProjectsByOrder
} from "./PiSessionSection";
import type { PiSessionProject } from "./types";

function createProject(
  path: string,
  sessionIds: string[]
): PiSessionProject {
  return {
    path,
    name: path.split("/").at(-1) ?? path,
    sessions: sessionIds.map((id, index) => ({
      id,
      name: `Session ${index + 1}`,
      firstMessage: `Message ${index + 1}`,
      messageCount: 1,
      created: new Date(2026, 0, index + 1).toISOString(),
      modified: new Date(2026, 0, index + 1).toISOString()
    }))
  };
}

describe("sortProjectsByOrder", () => {
  it("reorders projects by stored order and keeps unknown paths out", () => {
    const projects = [
      createProject("/a", ["s1"]),
      createProject("/b", ["s2"]),
      createProject("/c", ["s3"])
    ];

    expect(sortProjectsByOrder(projects, ["/c", "/missing", "/a"]).map((project) => project.path)).toEqual([
      "/c",
      "/a",
      "/b"
    ]);
  });
});

describe("ensureExpandedProjectPaths", () => {
  it("keeps stored expanded projects and auto-expands the selected session project", () => {
    const projects = [
      createProject("/a", ["s1"]),
      createProject("/b", ["s2"]),
      createProject("/c", ["s3"])
    ];

    expect(ensureExpandedProjectPaths(projects, ["/a"], "s3")).toEqual(["/a", "/c"]);
  });

  it("falls back to the first project when nothing is expanded", () => {
    const projects = [
      createProject("/a", ["s1"]),
      createProject("/b", ["s2"])
    ];

    expect(ensureExpandedProjectPaths(projects, [], null)).toEqual(["/a"]);
  });
});

describe("getVisibleProjectSessions", () => {
  it("limits visible sessions to ten by default", () => {
    const sessions = Array.from({ length: 14 }, (_, index) => `s${index + 1}`);

    expect(getVisibleProjectSessions(sessions, false)).toEqual({
      sessions: sessions.slice(0, 10),
      hiddenCount: 4
    });
  });

  it("returns all sessions when expanded", () => {
    const sessions = Array.from({ length: 14 }, (_, index) => `s${index + 1}`);

    expect(getVisibleProjectSessions(sessions, true)).toEqual({
      sessions,
      hiddenCount: 0
    });
  });
});

describe("filterProjectsByArchiveState", () => {
  it("returns only non-archived sessions for the home sidebar", () => {
    const projects = [
      createProject("/a", ["s1", "s2"]),
      createProject("/b", ["s3"])
    ];

    expect(
      filterProjectsByArchiveState(projects, new Set(["s2", "s3"]), "visible")
    ).toEqual([
      {
        ...projects[0],
        sessions: [projects[0].sessions[0]]
      }
    ]);
  });

  it("returns only archived sessions for the settings archived tab", () => {
    const projects = [
      createProject("/a", ["s1", "s2"]),
      createProject("/b", ["s3"])
    ];

    expect(
      filterProjectsByArchiveState(projects, new Set(["s2", "s3"]), "archived")
    ).toEqual([
      {
        ...projects[0],
        sessions: [projects[0].sessions[1]]
      },
      {
        ...projects[1],
        sessions: [projects[1].sessions[0]]
      }
    ]);
  });
});
