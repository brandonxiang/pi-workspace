import type { IncomingMessage, Server, ServerResponse } from "node:http";

/** A request as seen by route handlers. */
export interface HttpRequest {
  readonly method: string;
  /** Full request URL, including any query string. */
  readonly url: string;
  /** Lowercased header names; repeated headers are comma-joined. */
  readonly headers: Record<string, string | undefined>;
  /** Decoded `:param` values for the matched route, `{}` when unmatched. */
  readonly params: Record<string, string>;
  /** Parsed JSON body, or `undefined` when the request carries no body. */
  readonly body: unknown;
  /** Underlying Node request, for WebSocket upgrades and low-level access. */
  readonly raw: IncomingMessage;
}

export interface HttpResponse {
  /** Set the status code. Chainable, like Fastify's `reply.code()`. */
  code(status: number): HttpResponse;
  /** Set the content type verbatim, without appending a charset. Chainable. */
  type(contentType: string): HttpResponse;
  /** Send a body. Objects are JSON-encoded, strings are sent as-is. */
  send(payload?: unknown): void;
  /**
   * Take over the raw response. Once hijacked the adapter never writes to it,
   * so the handler owns everything through `reply.raw`.
   */
  hijack(): void;
  /** Underlying Node response. */
  readonly raw: ServerResponse;
  readonly statusCode: number;
  readonly sent: boolean;
  readonly hijacked: boolean;
}

/** Handlers may return a value or a promise of one; `unknown` covers both. */
export type RouteHandler = (request: HttpRequest, reply: HttpResponse) => unknown;

export interface InjectOptions {
  method: string;
  url: string;
  headers?: Record<string, string>;
  /** JSON request body. `payload` is accepted as an alias for Fastify parity. */
  body?: unknown;
  payload?: unknown;
}

export interface InjectResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
  /** Parsed JSON. Typed loosely to mirror light-my-request's `json()`. */
  json(): any;
}

/**
 * The HTTP surface the routers depend on. Deliberately mirrors the subset of
 * Fastify the codebase actually used: routing, JSON body parsing, `reply`
 * status/type/send/hijack, a not-found handler, and static file serving.
 */
export interface HttpServer {
  get(path: string, handler: RouteHandler): void;
  post(path: string, handler: RouteHandler): void;
  put(path: string, handler: RouteHandler): void;
  patch(path: string, handler: RouteHandler): void;
  delete(path: string, handler: RouteHandler): void;
  /**
   * Serve exact-path GET/HEAD requests from `root` before falling back to the
   * not-found handler. `null` disables static serving (the dev default).
   */
  setStaticRoot(root: string | null): void;
  /** Handles any request that neither a route nor a static file matched. */
  setNotFoundHandler(handler: RouteHandler): void;
  /** Resolves with the listening URL. */
  listen(port: number, host: string): Promise<string>;
  close(): Promise<void>;
  /**
   * Issue a request against the real routing pipeline in-process, starting an
   * ephemeral listener on first use. Test affordance replacing `server.inject()`.
   */
  inject(options: InjectOptions): Promise<InjectResponse>;
  /** Underlying Node server, used to attach WebSocket upgrade handling. */
  readonly raw: Server;
}
