import { describe, expect, it } from "vitest";
import {
  createPiSessionDetailCache,
  getCachedPiSessionDetailForSelection
} from "./pi-session-detail-cache";
import type { PiSessionDetailResponse } from "./types";

function createDetail(sessionId: string, content: string): PiSessionDetailResponse {
  return {
    session: {
      id: sessionId,
      name: `Session ${sessionId}`,
      cwd: "/tmp/workspace",
      projectName: "workspace",
      created: "2026-01-01T00:00:00.000Z",
      modified: "2026-01-01T00:00:00.000Z"
    },
    messages: [
      {
        id: `${sessionId}-assistant`,
        role: "assistant",
        content,
        provider: "openai",
        model: "gpt-4o-mini",
        timestamp: 1
      }
    ]
  };
}

describe("createPiSessionDetailCache", () => {
  it("stores loaded details by session id", () => {
    const cache = createPiSessionDetailCache();
    const detail = createDetail("session-1", "First answer");

    cache.set(detail);

    expect(cache.get("session-1")).toEqual(detail);
  });
});

describe("getCachedPiSessionDetailForSelection", () => {
  it("keeps the current detail when selecting the already active session", () => {
    const current = createDetail("session-1", "First answer");
    const cache = createPiSessionDetailCache();

    expect(
      getCachedPiSessionDetailForSelection({
        currentDetail: current,
        cache,
        sessionId: "session-1"
      })
    ).toBe(current);
  });

  it("returns a cached detail when revisiting a previously loaded session", () => {
    const current = createDetail("session-2", "Second answer");
    const cached = createDetail("session-1", "First answer");
    const cache = createPiSessionDetailCache();
    cache.set(cached);

    expect(
      getCachedPiSessionDetailForSelection({
        currentDetail: current,
        cache,
        sessionId: "session-1"
      })
    ).toEqual(cached);
  });

  it("returns null when the selected session has not been cached yet", () => {
    const current = createDetail("session-2", "Second answer");
    const cache = createPiSessionDetailCache();

    expect(
      getCachedPiSessionDetailForSelection({
        currentDetail: current,
        cache,
        sessionId: "session-3"
      })
    ).toBeNull();
  });
});
