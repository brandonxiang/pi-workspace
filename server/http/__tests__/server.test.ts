import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vite-plus/test";
import { createHttpServer } from "../server.js";
import type { HttpServer } from "../types.js";

const servers: HttpServer[] = [];
const tempDirs: string[] = [];

function makeServer(): HttpServer {
  const server = createHttpServer();
  servers.push(server);
  return server;
}

function makeTempDir(): string {
  const dir = mkdtempSync(path.join(tmpdir(), "pi-http-"));
  tempDirs.push(dir);
  return dir;
}

/** A server that serves `dir` and reports fall-through via its not-found body. */
function makeStaticServer(dir: string): HttpServer {
  const server = makeServer();
  server.setStaticRoot(dir);
  server.setNotFoundHandler(async () => ({ fallthrough: true }));
  return server;
}

afterEach(async () => {
  await Promise.all(servers.splice(0).map((server) => server.close()));
  for (const dir of tempDirs.splice(0)) rmSync(dir, { recursive: true, force: true });
});

describe("routing", () => {
  it("routes by method and path", async () => {
    const server = makeServer();
    server.get("/api/health", async () => ({ ok: true }));

    const response = await server.inject({ method: "GET", url: "/api/health" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true });
  });

  it("decodes percent-encoded params", async () => {
    const server = makeServer();
    server.get("/x/:p", async (request) => ({ p: request.params.p }));

    expect((await server.inject({ method: "GET", url: "/x/a%2Fb" })).json()).toEqual({ p: "a/b" });
    expect((await server.inject({ method: "GET", url: "/x/a%20b" })).json()).toEqual({ p: "a b" });
  });

  it("matches an empty segment to a param", async () => {
    const server = makeServer();
    server.patch("/api/pi-sessions/:sessionId/status", async (request) => ({
      sessionId: request.params.sessionId,
    }));

    const response = await server.inject({ method: "PATCH", url: "/api/pi-sessions//status" });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ sessionId: "" });
  });

  it("does not match a trailing slash", async () => {
    const server = makeServer();
    server.get("/api/health", async () => ({ ok: true }));
    server.setNotFoundHandler(async () => ({ fallthrough: true }));

    const response = await server.inject({ method: "GET", url: "/api/health/" });

    expect(response.json()).toEqual({ fallthrough: true });
  });

  it("ignores the query string when matching", async () => {
    const server = makeServer();
    server.get("/api/health", async () => ({ ok: true }));

    expect((await server.inject({ method: "GET", url: "/api/health?x=1" })).statusCode).toBe(200);
  });

  it("ignores the method case for registration", async () => {
    const server = makeServer();
    server.post("/api/echo", async () => ({ ok: true }));

    expect((await server.inject({ method: "POST", url: "/api/echo" })).statusCode).toBe(200);
  });

  it("returns 404 for an unmatched path when no not-found handler is set", async () => {
    const server = makeServer();
    server.get("/api/health", async () => ({ ok: true }));

    const response = await server.inject({ method: "GET", url: "/nope" });

    expect(response.statusCode).toBe(404);
    expect(response.json().error).toBe("Not Found");
  });

  it("returns 404 for a known path with the wrong method", async () => {
    const server = makeServer();
    server.get("/api/health", async () => ({ ok: true }));

    const response = await server.inject({ method: "DELETE", url: "/api/health" });

    expect(response.statusCode).toBe(404);
  });

  it("falls through to the not-found handler", async () => {
    const server = makeServer();
    server.setNotFoundHandler(async (_request, reply) => reply.type("text/html").send("<html>"));

    const response = await server.inject({ method: "GET", url: "/some/deep/route" });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toBe("text/html");
    expect(response.body).toBe("<html>");
  });
});

describe("reply", () => {
  it("applies a code set before returning a value", async () => {
    const server = makeServer();
    server.get("/api/bad", async (_request, reply) => {
      reply.code(400);
      return { error: "bad" };
    });

    const response = await server.inject({ method: "GET", url: "/api/bad" });

    expect(response.statusCode).toBe(400);
    expect(response.headers["content-type"]).toBe("application/json; charset=utf-8");
    expect(response.json()).toEqual({ error: "bad" });
  });

  it("writes an explicit content type verbatim, without a charset", async () => {
    const server = makeServer();
    server.get("/api/html", async (_request, reply) => reply.type("text/html").send("<h1>hi</h1>"));

    const response = await server.inject({ method: "GET", url: "/api/html" });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toBe("text/html");
    expect(response.body).toBe("<h1>hi</h1>");
  });

  it("supports chaining code and type", async () => {
    const server = makeServer();
    server.get("/api/teapot", async (_request, reply) =>
      reply.code(418).type("text/plain").send("nope"),
    );

    const response = await server.inject({ method: "GET", url: "/api/teapot" });

    expect(response.statusCode).toBe(418);
    expect(response.headers["content-type"]).toBe("text/plain");
  });

  it("sets content-length", async () => {
    const server = makeServer();
    server.get("/api/health", async () => ({ ok: true }));

    const response = await server.inject({ method: "GET", url: "/api/health" });

    expect(response.headers["content-length"]).toBe(String(Buffer.byteLength('{"ok":true}')));
  });

  it("returns 500 when a handler throws", async () => {
    const server = makeServer();
    server.get("/api/boom", async () => {
      throw new Error("kaboom");
    });

    const response = await server.inject({ method: "GET", url: "/api/boom" });

    expect(response.statusCode).toBe(500);
    expect(response.json()).toMatchObject({ statusCode: 500, message: "kaboom" });
  });

  it("lets a hijacked handler own the raw response", async () => {
    const server = makeServer();
    server.get("/api/sse", async (_request, reply) => {
      reply.hijack();
      const raw = reply.raw;
      raw.writeHead(200, { "content-type": "text/event-stream; charset=utf-8" });
      raw.write("data: one\n\n");
      raw.end();
    });

    const response = await server.inject({ method: "GET", url: "/api/sse" });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toBe("text/event-stream; charset=utf-8");
    expect(response.body).toBe("data: one\n\n");
  });
});

describe("request body", () => {
  it("parses a JSON object body", async () => {
    const server = makeServer();
    server.post("/api/echo", async (request) => ({ body: request.body }));

    const response = await server.inject({ method: "POST", url: "/api/echo", body: { a: 1 } });

    expect(response.json()).toEqual({ body: { a: 1 } });
  });

  it("accepts `payload` as an alias for `body`", async () => {
    const server = makeServer();
    server.post("/api/echo", async (request) => ({ body: request.body }));

    const response = await server.inject({ method: "POST", url: "/api/echo", payload: { b: 2 } });

    expect(response.json()).toEqual({ body: { b: 2 } });
  });

  it("leaves body undefined when no body is sent", async () => {
    const server = makeServer();
    server.post("/api/echo", async (request) => ({ present: request.body !== undefined }));

    expect((await server.inject({ method: "POST", url: "/api/echo" })).json()).toEqual({
      present: false,
    });
  });

  it("rejects an empty body sent as application/json", async () => {
    const server = makeServer();
    server.post("/api/echo", async () => ({ ok: true }));

    const response = await server.inject({
      method: "POST",
      url: "/api/echo",
      headers: { "content-type": "application/json" },
      body: "",
    });

    expect(response.statusCode).toBe(400);
  });

  it("rejects malformed JSON", async () => {
    const server = makeServer();
    server.post("/api/echo", async () => ({ ok: true }));

    const response = await server.inject({
      method: "POST",
      url: "/api/echo",
      headers: { "content-type": "application/json" },
      body: "{oops",
    });

    expect(response.statusCode).toBe(400);
    expect(response.json().message).toContain("Invalid JSON");
  });

  it("rejects a body over the size limit", async () => {
    const server = makeServer();
    server.post("/api/echo", async () => ({ ok: true }));

    const response = await server.inject({
      method: "POST",
      url: "/api/echo",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ big: "x".repeat(9 * 1024 * 1024) }),
    });

    expect(response.statusCode).toBe(413);
  });

  it("lowercases header names", async () => {
    const server = makeServer();
    server.post("/api/echo", async (request) => ({
      token: request.headers["x-action-token"],
      allLowercase: Object.keys(request.headers).every((key) => key === key.toLowerCase()),
    }));

    const response = await server.inject({
      method: "POST",
      url: "/api/echo",
      headers: { "X-Action-Token": "secret" },
    });

    expect(response.json()).toEqual({ token: "secret", allLowercase: true });
  });
});

describe("static files", () => {
  it("serves an exact-path file with a content type", async () => {
    const dir = makeTempDir();
    mkdirSync(path.join(dir, "assets"), { recursive: true });
    writeFileSync(path.join(dir, "assets", "app.js"), "console.log(1)");

    const server = makeServer();
    server.setStaticRoot(dir);

    const response = await server.inject({ method: "GET", url: "/assets/app.js" });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toBe("text/javascript; charset=utf-8");
    expect(response.body).toBe("console.log(1)");
  });

  it("falls through for / and /index.html so the SPA shell is served", async () => {
    const dir = makeTempDir();
    writeFileSync(path.join(dir, "index.html"), "<html>shell</html>");

    const server = makeServer();
    server.setStaticRoot(dir);
    server.setNotFoundHandler(async (_request, reply) => reply.type("text/html").send("SPA"));

    expect((await server.inject({ method: "GET", url: "/" })).body).toBe("SPA");
    expect((await server.inject({ method: "GET", url: "/index.html" })).body).toBe("SPA");
  });

  it("falls through when the file does not exist", async () => {
    const server = makeStaticServer(makeTempDir());

    expect((await server.inject({ method: "GET", url: "/missing.js" })).json()).toEqual({
      fallthrough: true,
    });
  });

  it("refuses to serve files outside the root", async () => {
    const dir = makeTempDir();
    writeFileSync(path.join(dir, "..", "secret-http-test.txt"), "secret");
    const server = makeStaticServer(dir);

    const response = await server.inject({ method: "GET", url: "/..%2Fsecret-http-test.txt" });

    expect(response.json()).toEqual({ fallthrough: true });
    rmSync(path.join(dir, "..", "secret-http-test.txt"), { force: true });
  });

  it("only serves GET and HEAD", async () => {
    const dir = makeTempDir();
    writeFileSync(path.join(dir, "app.js"), "x");
    const server = makeStaticServer(dir);

    expect((await server.inject({ method: "POST", url: "/app.js" })).json()).toEqual({
      fallthrough: true,
    });
  });
});
