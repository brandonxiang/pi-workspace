import { describe, expect, it } from "vite-plus/test";
import {
  buildHomeUrl,
  buildPiSessionUrl,
  buildSettingsUrl,
  parseAppRoute,
  resolvePanelMode,
} from "./app-routing";

describe("app-routing", () => {
  it("parses a Pi session route with terminal mode", () => {
    const route = parseAppRoute(new URL("https://example.test/sessions/session-1?panel=terminal"));

    expect(route).toEqual({
      kind: "pi-session",
      sessionId: "session-1",
      panel: "terminal",
    });
  });

  it("treats unknown paths as the home route", () => {
    const route = parseAppRoute(new URL("https://example.test/not-a-real-route?panel=chat"));

    expect(route).toEqual({
      kind: "home",
      panel: "chat",
    });
  });

  it("parses the settings route with panel mode", () => {
    const route = parseAppRoute(new URL("https://example.test/settings?panel=terminal"));

    expect(route).toEqual({
      kind: "settings",
      panel: "terminal",
    });
  });

  it("ignores invalid panel query values", () => {
    const route = parseAppRoute(new URL("https://example.test/sessions/session-1?panel=invalid"));

    expect(route).toEqual({
      kind: "pi-session",
      sessionId: "session-1",
      panel: null,
    });
  });

  it("builds session and home URLs with panel mode", () => {
    expect(buildPiSessionUrl("session-1", "chat")).toBe("/sessions/session-1?panel=chat");
    expect(buildHomeUrl("terminal")).toBe("/?panel=terminal");
    expect(buildSettingsUrl("chat")).toBe("/settings?panel=chat");
  });

  it("resolves panel mode from route first, then stored value, then chat", () => {
    expect(resolvePanelMode("terminal", "chat")).toBe("terminal");
    expect(resolvePanelMode(null, "terminal")).toBe("terminal");
    expect(resolvePanelMode(null, null)).toBe("chat");
  });
});
