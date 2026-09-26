import { readFile } from "node:fs/promises";
import path from "node:path";
import type { HttpRequest, HttpResponse } from "./types.js";

const MIME_TYPES: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".gif": "image/gif",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".mjs": "text/javascript; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".ttf": "font/ttf",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

/** Returns `true` when the request was served, `false` to fall through. */
export type StaticHandler = (request: HttpRequest, reply: HttpResponse) => Promise<boolean>;

/**
 * Serve exact-path files from `root`, replacing `@fastify/static` configured
 * with `wildcard: false, index: false`.
 *
 * `/`, `/index.html`, and any path ending in `/` deliberately fall through so
 * the SPA not-found handler serves the app shell instead of a raw file.
 */
export function createStaticHandler(root: string): StaticHandler {
  const resolvedRoot = path.resolve(root);

  return async (request, reply) => {
    if (request.method !== "GET" && request.method !== "HEAD") return false;

    const pathname = decodePath(request.url.split("?")[0]);
    if (pathname === "/" || pathname === "/index.html" || pathname.endsWith("/")) return false;

    // Resolve against the root and reject anything that escapes it.
    const target = path.resolve(resolvedRoot, `.${pathname}`);
    if (target !== resolvedRoot && !target.startsWith(resolvedRoot + path.sep)) return false;

    let data: Buffer;
    try {
      data = await readFile(target);
    } catch {
      return false;
    }

    reply.hijack();
    reply.raw.writeHead(200, {
      "content-type": MIME_TYPES[path.extname(target).toLowerCase()] ?? "application/octet-stream",
      "content-length": String(data.length),
      "cache-control": "public, max-age=0",
    });
    reply.raw.end(request.method === "HEAD" ? undefined : data);
    return true;
  };
}

function decodePath(pathname: string): string {
  try {
    return decodeURIComponent(pathname);
  } catch {
    return pathname;
  }
}
