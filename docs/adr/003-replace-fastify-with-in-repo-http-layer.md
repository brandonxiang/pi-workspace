# ADR-003: Replace Fastify with an In-Repo HTTP Layer

## Status

Accepted

## Date

2026-09-27

## Context

The Pi Agent Desktop server was built on Fastify, with `@fastify/static` serving
the built client and `@fastify/vite` providing hot reload during development.

The server exposes roughly twenty routes. Everything those routes actually need
from a framework is:

- method + path routing with `:param` segments
- JSON body parsing with a size limit
- `reply.code()` / `reply.type()` / `reply.send()`
- a not-found handler that returns the SPA shell

Fastify's other capabilities were never used. There were no route schemas, no
serialization schemas, no plugins, no hooks, and no logging — `fastify.log` and
pino were never called anywhere in `server/`, `client/`, or `shared/`. Those
unused capabilities were not free: Fastify and `@fastify/static` pulled in 99
transitive packages, including pino, ajv, fast-json-stringify, avvio,
find-my-way, and light-my-request.

Two parts of the framework were actively working against the app:

- **SSE had to bypass the framework.** The chat endpoint streams tokens to the
  browser, which required `reply.hijack()` to take over the raw response before
  writing to it. The code was already using Node's `ServerResponse` directly.
- **`@fastify/vite` mounted Vite's middleware on every request, ahead of
  routing.** Because Vite resolves extensionless URLs against the client root,
  any extensionless `/api/*` path that happened to match a real client module —
  `/api/versions` against `client/api/versions.ts`, `/api/skills` against
  `client/api/skills.ts` — was answered by Vite instead of reaching the API
  route. Working around this required a hand-written `dev-api-bypass` plugin in
  `vite.config.ts` that rewrote request URLs before they reached Vite.

The repository already leaned toward minimizing runtime dependencies so that
`npm install -g pi-workspace` stays fast for Workspace Operators, and had
previously kept `@fastify/vite` out of the production path for that reason.

## Decision

Own a thin HTTP layer in `server/http/` instead of depending on a framework.

```
server/http/
├── types.ts   — HttpRequest, HttpResponse, HttpServer, RouteHandler
├── router.ts  — route table and :param matching
├── reply.ts   — code / type / send / hijack
├── static.ts  — exact-path file serving
└── server.ts  — request pipeline, JSON body parsing, inject()
```

The `HttpServer` interface deliberately mirrors the subset of Fastify the
routers already used. Because the shape was preserved, the eleven files in
`server/router/` needed only their type import changed — no route logic moved.

The request pipeline is an explicit ordered fall-through, which is what removes
the need for the `dev-api-bypass` plugin:

```
matched route?  → run it
else            → static file (production only)
else            → not-found handler (SPA shell, or Vite in development)
```

API routes therefore match **before** Vite ever sees a request. Client modules
under `client/api/` can no longer shadow API paths, because precedence is a
property of the pipeline rather than of middleware registration order.

Development mode uses Vite's public middleware mode directly, replacing
`@fastify/vite`:

```ts
const vite = await createServer({
  configFile: path.join(root, "vite.config.ts"),
  server: { middlewareMode: true, hmr: { server: server.raw } },
  appType: "custom",
});
```

`server.setNotFoundHandler()` hands unhandled requests to `vite.middlewares`,
then transforms `client/index.html` through `vite.transformIndexHtml()` as the
SPA fallback.

`HttpServer.inject()` is provided to replace Fastify's `server.inject()` as the
in-process test affordance, so the existing route tests kept their shape.

The behaviors the new layer must preserve were captured from the real Fastify
server before the port, and are covered by `server/http/__tests__/server.test.ts`:

| Behavior                           | Expected                                                   |
| ---------------------------------- | ---------------------------------------------------------- |
| `:param` decoding                  | `/x/a%2Fb` → `params.p === "a/b"`                          |
| Empty segment                      | `/api/pi-sessions//status` matches with `sessionId === ""` |
| Trailing slash                     | `/api/health/` does **not** match `/api/health`            |
| Unknown method on a known path     | `404`, not `405`                                           |
| Query string                       | ignored for routing                                        |
| Header names                       | lowercased                                                 |
| Empty body with `application/json` | `400`                                                      |
| Malformed JSON                     | `400`                                                      |
| Body over 8 MB                     | `413`                                                      |
| Explicit `reply.type()`            | written verbatim, no charset appended                      |

## Alternatives Considered

### Keep Fastify

- Pros:
  - well-tested routing, body parsing, and error handling already in place
  - `server.inject()` makes route tests convenient
  - no new in-repo code to maintain
- Cons:
  - 99 transitive packages for a feature set the app does not use
  - the unused pino / ajv / fast-json-stringify compilers ship regardless
  - SSE must bypass the framework anyway
  - `@fastify/vite`'s middleware-before-routing model keeps the `client/api/`
    collision possible
- Rejected:
  - the framework was not earning its dependency weight, and two of the places
    it was used were workarounds for the framework itself

### Keep Fastify but drop `@fastify/vite`

- Pros:
  - smaller change; routing and tests stay untouched
- Cons:
  - mounting Vite's Connect middleware in Fastify still requires
    `@fastify/middie` or a hand-written bridge
  - the `dev-api-bypass` plugin would still be needed, since middleware still
    runs ahead of routing
- Rejected:
  - it trades one dependency for another while keeping the underlying
    request-ordering problem

### Adopt a lighter framework (Hono, Express)

- Pros:
  - smaller than Fastify, and Hono has a modern API
- Cons:
  - still a dependency, and still a framework whose response helpers must be
    reconciled with raw `ServerResponse` for SSE
  - no reuse benefit: the router files would need the same adaptation work as
    the in-repo layer
- Rejected:
  - the route surface is small enough that a framework is not the deciding
    factor, and the ordering guarantee we needed is easier to own than to
    negotiate

## Consequences

### Positive

- Runtime dependencies dropped from six to four: `@earendil-works/pi-ai`,
  `@earendil-works/pi-coding-agent`, `node-pty`, `ws`
- The lockfile shed 532 lines of the Fastify closure
- API precedence is structural, so `client/api/versions.ts` and
  `client/api/skills.ts` coexist with `/api/versions` and `/api/skills`
- The `dev-api-bypass` plugin was deleted along with the class of bug it patched
- SSE no longer needs to escape a framework; `reply.raw` is the response
- Route tests now run against a real HTTP pipeline without a test-only mock path

### Negative

- The repository now owns routing edge cases that Fastify had already solved:
  URL decoding fallbacks, body-limit behavior, and malformed-JSON handling
- `inject()` is a test affordance that lives in production code, justified only
  by parity with the interface it replaced
- Development hot reload depends on Vite's public middleware API; a breaking
  Vite change would surface only in `--dev`
- If a future route needs a framework feature that was deliberately not ported
  — schema validation, serialization, content negotiation — it must be built
  rather than imported

### Follow-up Notes

- `server/http/` is the intended extension point. Add capabilities to the
  `HttpServer` interface rather than reaching for a framework again.
- The route tests under `server/__tests__/` were previously excluded from
  typechecking. `tsconfig.server.json` now includes `server/**/*.ts` so they
  are covered; keep it that way.
- If the route surface ever grows to need schemas, validation, and a plugin
  ecosystem, revisit this decision rather than extending the adapter
  indefinitely.
