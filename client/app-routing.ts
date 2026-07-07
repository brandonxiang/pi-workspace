export type PanelMode = "chat" | "terminal";

export type AppRoute =
  | { kind: "home"; panel: PanelMode | null }
  | { kind: "settings"; panel: PanelMode | null }
  | { kind: "pi-session"; sessionId: string; panel: PanelMode | null };

export function readPanelMode(value: string | null): PanelMode | null {
  return value === "chat" || value === "terminal" ? value : null;
}

export function resolvePanelMode(
  routePanel: PanelMode | null,
  storedPanel: string | null
): PanelMode {
  return routePanel ?? readPanelMode(storedPanel) ?? "chat";
}

export function parseAppRoute(url: URL): AppRoute {
  const panel = readPanelMode(url.searchParams.get("panel"));
  if (url.pathname === "/settings") {
    return {
      kind: "settings",
      panel
    };
  }

  const match = /^\/sessions\/([^/]+)$/.exec(url.pathname);

  if (match) {
    return {
      kind: "pi-session",
      sessionId: decodeURIComponent(match[1]),
      panel
    };
  }

  return {
    kind: "home",
    panel
  };
}

export function buildHomeUrl(panel: PanelMode) {
  return `/?panel=${panel}`;
}

export function buildSettingsUrl(panel: PanelMode) {
  return `/settings?panel=${panel}`;
}

export function buildPiSessionUrl(sessionId: string, panel: PanelMode) {
  return `/sessions/${encodeURIComponent(sessionId)}?panel=${panel}`;
}
