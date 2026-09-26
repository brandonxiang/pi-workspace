import type { ServerResponse } from "node:http";
import type { HttpResponse } from "./types.js";

/**
 * The `reply` half of the Fastify surface the routers use.
 *
 * Semantics mirrored from Fastify:
 *   - `code()` / `type()` are chainable
 *   - a handler's returned value is JSON-encoded by the caller
 *   - an explicit `type()` is written verbatim (no charset appended), while a
 *     bare string defaults to `text/plain; charset=utf-8`
 *   - after `hijack()` the adapter never writes, so the handler owns `raw`
 */
export class ReplyImpl implements HttpResponse {
  #status = 200;
  #contentType: string | null = null;
  #sent = false;
  #hijacked = false;

  constructor(private readonly res: ServerResponse) {}

  get raw(): ServerResponse {
    return this.res;
  }

  get statusCode(): number {
    return this.#status;
  }

  get sent(): boolean {
    return this.#sent;
  }

  get hijacked(): boolean {
    return this.#hijacked;
  }

  code(status: number): HttpResponse {
    this.#status = status;
    return this;
  }

  type(contentType: string): HttpResponse {
    this.#contentType = contentType;
    return this;
  }

  hijack(): void {
    this.#hijacked = true;
  }

  send(payload?: unknown): void {
    if (this.#sent || this.#hijacked) return;
    this.#sent = true;

    const headers: Record<string, string> = {};
    if (this.#contentType) headers["content-type"] = this.#contentType;

    if (payload === undefined || payload === null) {
      this.res.writeHead(this.#status, headers);
      this.res.end();
      return;
    }

    if (Buffer.isBuffer(payload)) {
      this.#write(headers, payload);
      return;
    }

    if (typeof payload === "string") {
      if (!this.#contentType) headers["content-type"] = "text/plain; charset=utf-8";
      this.#write(headers, payload);
      return;
    }

    const body = JSON.stringify(payload);
    if (!this.#contentType) headers["content-type"] = "application/json; charset=utf-8";
    this.#write(headers, body);
  }

  #write(headers: Record<string, string>, body: string | Buffer): void {
    headers["content-length"] = String(Buffer.byteLength(body));
    this.res.writeHead(this.#status, headers);
    this.res.end(body);
  }
}
