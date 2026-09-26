import type { RouteHandler } from "./types.js";

export interface Route {
  readonly method: string;
  readonly segments: readonly string[];
  readonly handler: RouteHandler;
}

interface RouteMatch {
  readonly handler: RouteHandler;
  readonly params: Record<string, string>;
}

/**
 * Split a path into segments without dropping empty ones.
 *
 * This preserves two behaviours the previous Fastify router had:
 *   - an empty segment still matches a `:param`, so `/api/pi-sessions//status`
 *     routes with `sessionId === ""`
 *   - a trailing slash adds a trailing empty segment, so `/api/health/` does
 *     NOT match the `/api/health` route
 */
function splitPath(pathname: string): string[] {
  return pathname.split("/");
}

export function matchRoute(
  routes: readonly Route[],
  method: string,
  pathname: string,
): RouteMatch | null {
  const requestSegments = splitPath(pathname);

  for (const route of routes) {
    if (route.method !== method) continue;
    if (route.segments.length !== requestSegments.length) continue;

    const params: Record<string, string> = {};
    let matched = true;

    for (let i = 0; i < route.segments.length; i++) {
      const pattern = route.segments[i];
      const value = requestSegments[i];

      if (pattern.startsWith(":")) {
        params[pattern.slice(1)] = decodeParam(value);
      } else if (pattern !== value) {
        matched = false;
        break;
      }
    }

    if (matched) return { handler: route.handler, params };
  }

  return null;
}

/**
 * Decode a path param the way find-my-way does: `decodeURIComponent`, falling
 * back to the raw segment when the value is not valid percent-encoding.
 */
function decodeParam(value: string): string {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}
