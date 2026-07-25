import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vite-plus/test";
import Fastify from "fastify";
import {
  readSessionStatuses,
  writeSessionStatuses,
  mergeStatusIntoSessions,
  isValidStatusTransition,
  registerSessionStatusRoutes,
  setSessionLifecycleStatus,
  type SessionStatus,
  type SessionStatusMap,
} from "../pi-sessions.js";

/* ─── Pure logic tests (no I/O) ─── */

describe("isValidStatusTransition", () => {
  it("allows initializing → in_progress", () => {
    expect(isValidStatusTransition("initializing", "in_progress")).toBe(true);
  });

  it("allows in_progress → pending_review", () => {
    expect(isValidStatusTransition("in_progress", "pending_review")).toBe(true);
  });

  it("allows in_progress → completed", () => {
    expect(isValidStatusTransition("in_progress", "completed")).toBe(true);
  });

  it("allows pending_review → completed", () => {
    expect(isValidStatusTransition("pending_review", "completed")).toBe(true);
  });

  it("allows completed → in_progress (reopen)", () => {
    expect(isValidStatusTransition("completed", "in_progress")).toBe(true);
  });

  it("rejects initializing → completed (skip)", () => {
    expect(isValidStatusTransition("initializing", "completed")).toBe(false);
  });

  it("rejects initializing → pending_review (skip)", () => {
    expect(isValidStatusTransition("initializing", "pending_review")).toBe(false);
  });

  it("rejects pending_review → in_progress (backward)", () => {
    expect(isValidStatusTransition("pending_review", "in_progress")).toBe(false);
  });

  it("rejects same status transition", () => {
    expect(isValidStatusTransition("in_progress", "in_progress")).toBe(false);
  });

  it("rejects unknown status values", () => {
    expect(isValidStatusTransition("invalid" as SessionStatus, "in_progress")).toBe(false);
    expect(isValidStatusTransition("in_progress", "bogus" as SessionStatus)).toBe(false);
  });
});

describe("mergeStatusIntoSessions", () => {
  const sessions = [
    {
      id: "session-1",
      firstMessage: "hi",
      messageCount: 5,
      created: "2026-01-01",
      modified: "2026-01-02",
    },
    {
      id: "session-2",
      firstMessage: "hello",
      messageCount: 0,
      created: "2026-01-03",
      modified: "2026-01-03",
    },
    {
      id: "session-3",
      firstMessage: "hey",
      messageCount: 3,
      created: "2026-01-04",
      modified: "2026-01-05",
    },
  ] as Array<{
    id: string;
    firstMessage: string;
    messageCount: number;
    created: string;
    modified: string;
  }>;

  it("merges known statuses from the map", () => {
    const statuses: SessionStatusMap = { "session-1": "completed", "session-3": "pending_review" };
    const result = mergeStatusIntoSessions(sessions, statuses);

    expect(result[0].status).toBe("completed");
    expect(result[1].status).toBe("initializing"); // no messages → initializing
    expect(result[2].status).toBe("pending_review");
  });

  it("defaults sessions with no messages to initializing", () => {
    const result = mergeStatusIntoSessions(sessions, {});

    expect(result[0].status).toBe("pending_review"); // has messages, no stored status
    expect(result[1].status).toBe("initializing"); // 0 messages
    expect(result[2].status).toBe("pending_review"); // has messages
  });

  it("defaults sessions with messages to pending_review when no stored status", () => {
    const result = mergeStatusIntoSessions([sessions[0]], {});
    expect(result[0].status).toBe("pending_review");
  });

  it("does not mutate input objects", () => {
    const statuses: SessionStatusMap = { "session-1": "completed" };
    const originalId = sessions[0].id;
    const result = mergeStatusIntoSessions(sessions, statuses);
    expect(result[0]).not.toBe(sessions[0]); // different reference
    expect(sessions[0].id).toBe(originalId);
    expect((sessions[0] as Record<string, unknown>).status).toBeUndefined();
  });
});

/* ─── I/O tests with temp directory ─── */

describe("read/write session status file", () => {
  let tmpDir: string;

  beforeAll(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "pi-status-test-"));
  });

  afterAll(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("returns an empty map when the status file does not exist", () => {
    const result = readSessionStatuses(tmpDir);
    expect(result).toEqual({});
  });

  it("writes statuses and reads them back", () => {
    const statuses: SessionStatusMap = { "session-a": "completed", "session-b": "in_progress" };
    writeSessionStatuses(tmpDir, statuses);

    const result = readSessionStatuses(tmpDir);
    expect(result).toEqual(statuses);
  });

  it("preserves unknown values when merging with defaults", () => {
    const statuses: SessionStatusMap = { "session-x": "pending_review" };
    writeSessionStatuses(tmpDir, statuses);

    const result = readSessionStatuses(tmpDir);
    expect(result["session-x"]).toBe("pending_review");
  });

  it("overwrites existing status on write", () => {
    writeSessionStatuses(tmpDir, { "session-1": "in_progress" });
    writeSessionStatuses(tmpDir, { "session-1": "completed", "session-2": "pending_review" });

    const result = readSessionStatuses(tmpDir);
    expect(result["session-1"]).toBe("completed");
    expect(result["session-2"]).toBe("pending_review");
  });

  it("handles concurrent read/write of multiple sessions", () => {
    const statuses: SessionStatusMap = {};
    for (let i = 0; i < 100; i++) {
      statuses[`session-${i}`] =
        i % 3 === 0 ? "completed" : i % 3 === 1 ? "pending_review" : "in_progress";
    }
    writeSessionStatuses(tmpDir, statuses);
    const result = readSessionStatuses(tmpDir);
    expect(result).toEqual(statuses);
  });
});

/* ─── API route tests ─── */

describe("PATCH /api/pi-sessions/:sessionId/status", () => {
  let server: ReturnType<typeof Fastify>;
  let mockStatuses: SessionStatusMap;

  const mockApi = {
    readStatuses: vi.fn(() => ({ ...mockStatuses })),
    writeStatuses: vi.fn((statuses: SessionStatusMap) => {
      mockStatuses = { ...statuses };
    }),
  };

  beforeAll(() => {
    server = Fastify();
    registerSessionStatusRoutes(server, mockApi);
  });

  afterAll(async () => {
    await server.close();
  });

  beforeEach(() => {
    mockStatuses = {
      "session-1": "in_progress",
      "session-2": "pending_review",
      "session-3": "completed",
    };
    vi.clearAllMocks();
  });

  it("returns 400 for missing sessionId", async () => {
    const response = await server.inject({
      method: "PATCH",
      url: "/api/pi-sessions//status",
      body: { status: "completed" },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json()).toEqual({ error: "sessionId is required" });
  });

  it("returns 400 for missing status", async () => {
    const response = await server.inject({
      method: "PATCH",
      url: "/api/pi-sessions/session-1/status",
      body: {},
    });
    expect(response.statusCode).toBe(400);
  });

  it("returns 400 for invalid status value", async () => {
    const response = await server.inject({
      method: "PATCH",
      url: "/api/pi-sessions/session-1/status",
      body: { status: "bogus" },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error).toContain("Invalid status");
  });

  it("accepts in_progress → completed transition", async () => {
    const response = await server.inject({
      method: "PATCH",
      url: "/api/pi-sessions/session-1/status",
      body: { status: "completed" },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "completed" });
    expect(mockApi.writeStatuses).toHaveBeenCalled();
    expect(mockStatuses["session-1"]).toBe("completed");
  });

  it("accepts completed → in_progress (reopen)", async () => {
    const response = await server.inject({
      method: "PATCH",
      url: "/api/pi-sessions/session-3/status",
      body: { status: "in_progress" },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "in_progress" });
    expect(mockStatuses["session-3"]).toBe("in_progress");
  });

  it("returns 400 for invalid transition (completed → pending_review)", async () => {
    const response = await server.inject({
      method: "PATCH",
      url: "/api/pi-sessions/session-3/status",
      body: { status: "pending_review" },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error).toContain("Invalid transition");
    expect(response.json().currentStatus).toBe("completed");
    expect(mockStatuses["session-3"]).toBe("completed");
  });

  it("returns 400 for initializing → completed (skip)", async () => {
    mockStatuses = { "session-4": "initializing" };
    const response = await server.inject({
      method: "PATCH",
      url: "/api/pi-sessions/session-4/status",
      body: { status: "completed" },
    });
    expect(response.statusCode).toBe(400);
    expect(response.json().error).toContain("Invalid transition");
  });

  it("defaults unknown sessionId to pending_review for transition check", async () => {
    const response = await server.inject({
      method: "PATCH",
      url: "/api/pi-sessions/unknown-session/status",
      body: { status: "completed" },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ status: "completed" });
    expect(mockApi.writeStatuses).toHaveBeenCalled();
  });
});

/* ─── Auto lifecycle transitions ─── */

describe("setSessionLifecycleStatus", () => {
  let tmpDir: string;

  beforeAll(() => {
    tmpDir = mkdtempSync(join(tmpdir(), "pi-lifecycle-"));
  });

  afterAll(() => {
    rmSync(tmpDir, { recursive: true, force: true });
  });

  it("sets any session to in_progress regardless of current status", () => {
    writeSessionStatuses(tmpDir, { s1: "completed", s2: "initializing" });
    setSessionLifecycleStatus(tmpDir, "s1", "in_progress");
    setSessionLifecycleStatus(tmpDir, "s2", "in_progress");
    const result = readSessionStatuses(tmpDir);
    expect(result["s1"]).toBe("in_progress");
    expect(result["s2"]).toBe("in_progress");
  });

  it("sets any session to pending_review regardless of current status", () => {
    writeSessionStatuses(tmpDir, { s1: "completed", s2: "in_progress" });
    setSessionLifecycleStatus(tmpDir, "s1", "pending_review");
    setSessionLifecycleStatus(tmpDir, "s2", "pending_review");
    const result = readSessionStatuses(tmpDir);
    expect(result["s1"]).toBe("pending_review");
    expect(result["s2"]).toBe("pending_review");
  });

  it("does not affect other sessions", () => {
    writeSessionStatuses(tmpDir, { s1: "completed", s2: "pending_review", s3: "in_progress" });
    setSessionLifecycleStatus(tmpDir, "s2", "in_progress");
    const result = readSessionStatuses(tmpDir);
    expect(result["s1"]).toBe("completed");
    expect(result["s2"]).toBe("in_progress");
    expect(result["s3"]).toBe("in_progress");
  });

  it("handles a session not in the map", () => {
    setSessionLifecycleStatus(tmpDir, "new-session", "in_progress");
    const result = readSessionStatuses(tmpDir);
    expect(result["new-session"]).toBe("in_progress");
  });
});
