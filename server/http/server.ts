import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { ReplyImpl } from "./reply.js";
import { matchRoute, type Route } from "./router.js";
import { createStaticHandler, type StaticHandler } from "./static.js";
import type {
  HttpRequest,
  HttpServer,
  InjectOptions,
  InjectResponse,
  RouteHandler,
} from "./types.js";

/** Matches the limit the server was previously configured with on Fastify. */
const BODY_LIMIT = 8 * 1024 * 1024;

class RequestBodyError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "RequestBodyError";
  }
}

export function createHttpServer(): HttpServer {
  const routes: Route[] = [];
  let notFoundHandler: RouteHandler | null = null;
  let staticHandler: StaticHandler | null = null;
  let listeningAddress: string | null = null;

  const server = createServer((request, response) => {
    void dispatch(request, response);
  });

  function register(method: string, path: string, handler: RouteHandler): void {
    routes.push({ method, segments: path.split("/"), handler });
  }

  async function dispatch(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const method = (request.method ?? "GET").toUpperCase();
    const url = request.url ?? "/";
    const pathname = url.split("?")[0];
    const reply = new ReplyImpl(response);
    const match = matchRoute(routes, method, pathname);

    let body: unknown;
    try {
      body = await readBody(request);
    } catch (error) {
      const status = error instanceof RequestBodyError ? error.status : 400;
      reply.code(status).send({
        statusCode: status,
        error: status === 413 ? "Payload Too Large" : "Bad Request",
        message: error instanceof Error ? error.message : "Invalid request body",
      });
      return;
    }

    const httpRequest: HttpRequest = {
      method,
      url,
      headers: normalizeHeaders(request.headers),
      params: match?.params ?? {},
      body,
      raw: request,
    };

    try {
      if (match) {
        await runHandler(match.handler, httpRequest, reply);
        return;
      }

      if (staticHandler && (await staticHandler(httpRequest, reply))) return;

      if (notFoundHandler) {
        await runHandler(notFoundHandler, httpRequest, reply);
        return;
      }

      reply.code(404).send({
        message: `Route ${method}:${pathname} not found`,
        error: "Not Found",
        statusCode: 404,
      });
    } catch (error) {
      if (reply.hijacked || reply.sent) return;

      reply.code(500).send({
        statusCode: 500,
        error: "Internal Server Error",
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async function runHandler(
    handler: RouteHandler,
    request: HttpRequest,
    reply: ReplyImpl,
  ): Promise<void> {
    const result = await handler(request, reply);
    if (!reply.hijacked && !reply.sent) reply.send(result);
  }

  function listen(port: number, host: string): Promise<string> {
    return new Promise((resolve, reject) => {
      const onError = (error: Error) => {
        server.off("listening", onListening);
        reject(error);
      };
      const onListening = () => {
        server.off("error", onError);
        const address = server.address();

        if (address === null || typeof address === "string") {
          resolve(`http://${host}:${port}`);
          return;
        }

        listeningAddress = `http://${address.address}:${address.port}`;
        resolve(listeningAddress);
      };

      server.once("error", onError);
      server.once("listening", onListening);
      server.listen(port, host);
    });
  }

  return {
    get: (path, handler) => register("GET", path, handler),
    post: (path, handler) => register("POST", path, handler),
    put: (path, handler) => register("PUT", path, handler),
    patch: (path, handler) => register("PATCH", path, handler),
    delete: (path, handler) => register("DELETE", path, handler),

    setStaticRoot: (root) => {
      staticHandler = root ? createStaticHandler(root) : null;
    },

    setNotFoundHandler: (handler) => {
      notFoundHandler = handler;
    },

    listen,

    close: () =>
      new Promise((resolve, reject) => {
        listeningAddress = null;

        if (!server.listening) {
          resolve();
          return;
        }

        server.close((error) => (error ? reject(error) : resolve()));
        // Drop keep-alive sockets so `close()` settles instead of waiting for
        // the client's idle connections to time out.
        server.closeIdleConnections();
      }),

    inject: async (options: InjectOptions): Promise<InjectResponse> => {
      const origin = listeningAddress ?? (await listen(0, "127.0.0.1"));
      const headers: Record<string, string> = { ...options.headers };
      const rawBody = options.body !== undefined ? options.body : options.payload;

      let body: string | undefined;
      if (rawBody !== undefined) {
        body = typeof rawBody === "string" ? rawBody : JSON.stringify(rawBody);
        if (!hasHeader(headers, "content-type")) headers["content-type"] = "application/json";
      }

      const response = await fetch(new URL(options.url, origin), {
        method: options.method,
        headers,
        body,
      });
      const text = await response.text();

      return {
        statusCode: response.status,
        headers: Object.fromEntries(response.headers),
        body: text,
        json: () => JSON.parse(text),
      };
    },

    get raw() {
      return server;
    },
  };
}

async function readBody(request: IncomingMessage): Promise<unknown> {
  const method = (request.method ?? "GET").toUpperCase();
  if (method === "GET" || method === "HEAD") return undefined;

  const contentType = request.headers["content-type"];
  const chunks: Buffer[] = [];
  let size = 0;

  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;

    if (size > BODY_LIMIT) {
      // Drain instead of buffering further: the handler never sees this body,
      // and draining lets the client finish sending so it can read the 413.
      request.resume();
      throw new RequestBodyError(413, "Request body is too large");
    }

    chunks.push(buffer);
  }

  if (size === 0) {
    if (isJsonContentType(contentType)) {
      throw new RequestBodyError(
        400,
        "Body cannot be empty when content-type is set to 'application/json'",
      );
    }
    return undefined;
  }

  // The app's own client only ever sends JSON. Other content types are ignored
  // rather than rejected, which keeps bodyless DELETE/PATCH requests working.
  if (!isJsonContentType(contentType)) return undefined;

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    throw new RequestBodyError(400, "Invalid JSON body");
  }
}

/** Mirrors Fastify's default JSON parser, which also accepts `application/*+json`. */
function isJsonContentType(contentType: string | undefined): boolean {
  if (!contentType) return false;
  return /^application\/(?:[\w.+-]+\+)?json\b/i.test(contentType.trim());
}

function normalizeHeaders(headers: IncomingMessage["headers"]): Record<string, string | undefined> {
  const normalized: Record<string, string | undefined> = {};

  for (const [name, value] of Object.entries(headers)) {
    normalized[name.toLowerCase()] = Array.isArray(value) ? value.join(", ") : value;
  }

  return normalized;
}

function hasHeader(headers: Record<string, string>, name: string): boolean {
  const target = name.toLowerCase();
  return Object.keys(headers).some((key) => key.toLowerCase() === target);
}
