// @vitest-environment jsdom

import { act } from "react-dom/test-utils";
import { createRoot, type Root } from "react-dom/client";
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import { PiSessionSection } from "../components/PiSessionSection";
import {
  filterProjectsByArchiveState,
  ensureExpandedProjectPaths,
  getVisibleProjectSessions,
  getStatusEmoji,
  getStatusTransitions,
  sortProjectsByOrder,
} from "../components/PiSessionSection";
import type { PiSessionProject } from "../types";

function createProject(
  path: string,
  sessionIds: string[],
  status: import("../types").SessionStatus = "in_progress",
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
      modified: new Date(2026, 0, index + 1).toISOString(),
      status,
    })),
  };
}

describe("sortProjectsByOrder", () => {
  it("reorders projects by stored order and keeps unknown paths out", () => {
    const projects = [
      createProject("/a", ["s1"]),
      createProject("/b", ["s2"]),
      createProject("/c", ["s3"]),
    ];

    expect(
      sortProjectsByOrder(projects, ["/c", "/missing", "/a"]).map((project) => project.path),
    ).toEqual(["/c", "/a", "/b"]);
  });
});

describe("ensureExpandedProjectPaths", () => {
  it("keeps stored expanded projects and auto-expands the selected session project", () => {
    const projects = [
      createProject("/a", ["s1"]),
      createProject("/b", ["s2"]),
      createProject("/c", ["s3"]),
    ];

    expect(ensureExpandedProjectPaths(projects, ["/a"], "s3")).toEqual(["/a", "/c"]);
  });

  it("falls back to the first project when nothing is expanded", () => {
    const projects = [createProject("/a", ["s1"]), createProject("/b", ["s2"])];

    expect(ensureExpandedProjectPaths(projects, [], null)).toEqual(["/a"]);
  });
});

describe("getVisibleProjectSessions", () => {
  it("limits visible sessions to ten by default", () => {
    const sessions = Array.from({ length: 14 }, (_, index) => `s${index + 1}`);

    expect(getVisibleProjectSessions(sessions, false)).toEqual({
      sessions: sessions.slice(0, 10),
      hiddenCount: 4,
    });
  });

  it("returns all sessions when expanded", () => {
    const sessions = Array.from({ length: 14 }, (_, index) => `s${index + 1}`);

    expect(getVisibleProjectSessions(sessions, true)).toEqual({
      sessions,
      hiddenCount: 0,
    });
  });
});

describe("filterProjectsByArchiveState", () => {
  it("returns only non-archived sessions for the home sidebar", () => {
    const projects = [createProject("/a", ["s1", "s2"]), createProject("/b", ["s3"])];

    expect(filterProjectsByArchiveState(projects, new Set(["s2", "s3"]), "visible")).toEqual([
      {
        ...projects[0],
        sessions: [projects[0].sessions[0]],
      },
    ]);
  });

  it("returns only archived sessions for the settings archived tab", () => {
    const projects = [createProject("/a", ["s1", "s2"]), createProject("/b", ["s3"])];

    expect(filterProjectsByArchiveState(projects, new Set(["s2", "s3"]), "archived")).toEqual([
      {
        ...projects[0],
        sessions: [projects[0].sessions[1]],
      },
      {
        ...projects[1],
        sessions: [projects[1].sessions[0]],
      },
    ]);
  });
});

describe("session status", () => {
  it("renders 🆕 for initializing, 🔄 for in_progress, 👀 for pending_review, ✅ for completed", () => {
    expect(getStatusEmoji("initializing")).toBe("🆕");
    expect(getStatusEmoji("in_progress")).toBe("🔄");
    expect(getStatusEmoji("pending_review")).toBe("👀");
    expect(getStatusEmoji("completed")).toBe("✅");
  });

  it("computes available transitions for each status", () => {
    expect(getStatusTransitions("initializing")).toEqual([]);

    expect(getStatusTransitions("in_progress")).toEqual([]);

    expect(getStatusTransitions("pending_review")).toEqual([
      { value: "completed", label: "Mark completed", emoji: "✅" },
    ]);

    expect(getStatusTransitions("completed")).toEqual([]);
  });
});

/* ─── Drag & drop project reordering (rendering) ─── */

const ORDER_STORAGE_KEY = "my-pi-pi-project-order";

function dispatchDragEvent(target: Element, type: string) {
  target.dispatchEvent(new Event(type, { bubbles: true, cancelable: true }));
}

describe("PiSessionSection drag & drop reordering", () => {
  const projects: PiSessionProject[] = [
    createProject("/alpha", ["a1"]),
    createProject("/beta", ["b1"]),
    createProject("/gamma", ["g1"]),
  ];

  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    localStorage.clear();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
  });

  function renderSidebar(isStreaming = false) {
    root.render(
      React.createElement(PiSessionSection, {
        locale: "en",
        projects,
        loading: false,
        error: null,
        isStreaming,
        selectedSessionId: null,
        archivedSessionIds: new Set<string>(),
        onSelectSession: vi.fn(),
        onRename: vi.fn(),
        onArchive: vi.fn(),
        onRestore: vi.fn(),
        onStatusChange: vi.fn(),
        onCreateSessionInProject: vi.fn(),
        onDeleteProject: vi.fn(),
        onRevealProject: vi.fn(),
      }),
    );
  }

  function projectGroups(): Element[] {
    return Array.from(container.querySelectorAll(".pi-project-group"));
  }

  function projectNames(): string[] {
    return projectGroups().map(
      (group) => group.querySelector(".pi-project-name")?.textContent ?? "",
    );
  }

  function storedOrder(): string[] {
    return JSON.parse(localStorage.getItem(ORDER_STORAGE_KEY) ?? "[]") as string[];
  }

  it("marks every project group draggable while idle", async () => {
    await act(async () => {
      renderSidebar();
    });

    for (const group of projectGroups()) {
      expect(group.getAttribute("draggable")).toBe("true");
    }
  });

  it("disables dragging while a session is streaming", async () => {
    await act(async () => {
      renderSidebar(true);
    });

    for (const group of projectGroups()) {
      expect(group.getAttribute("draggable")).toBe("false");
    }
  });

  it("reorders projects on drag and drop and persists the new order", async () => {
    await act(async () => {
      renderSidebar();
    });
    expect(projectNames()).toEqual(["alpha", "beta", "gamma"]);

    await act(async () => {
      const groups = projectGroups();
      dispatchDragEvent(groups[0], "dragstart");
      dispatchDragEvent(groups[1], "dragover");
    });

    expect(projectGroups()[1].className).toContain("pi-project-group-drag-over");

    await act(async () => {
      dispatchDragEvent(projectGroups()[1], "drop");
    });

    expect(projectNames()).toEqual(["beta", "alpha", "gamma"]);
    expect(projectGroups()[1].className).not.toContain("pi-project-group-drag-over");
    expect(storedOrder()).toEqual(["/beta", "/alpha", "/gamma"]);
  });

  it("ignores a drop on the source project itself", async () => {
    await act(async () => {
      renderSidebar();
    });

    await act(async () => {
      const groups = projectGroups();
      dispatchDragEvent(groups[0], "dragstart");
      dispatchDragEvent(groups[0], "drop");
    });

    expect(projectNames()).toEqual(["alpha", "beta", "gamma"]);
    expect(storedOrder()).toEqual(["/alpha", "/beta", "/gamma"]);
  });

  it("restores a persisted project order on mount", async () => {
    localStorage.setItem(ORDER_STORAGE_KEY, JSON.stringify(["/gamma", "/alpha", "/beta"]));

    await act(async () => {
      renderSidebar();
    });

    expect(projectNames()).toEqual(["gamma", "alpha", "beta"]);
  });
});
