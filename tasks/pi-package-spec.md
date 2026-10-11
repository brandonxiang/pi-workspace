# Spec: pi-workspace as a Pi Package

## Status

Draft — blocked on [Open Decisions](#open-decisions). The implementation plan and
task list come after those are settled.

## Goal

Ship `pi-workspace` as one npm package that works in two modes:

- **CLI mode** — what exists today. `npm i -g pi-workspace` serves the browser
  workspace on `127.0.0.1:8787`.
- **Package mode** — new. `pi install npm:pi-workspace` makes Pi load resources
  from the same package, so a Workspace Operator can move the active Pi Session
  between the terminal TUI and the browser workspace.

The point of package mode is the handoff: a Session started in the TUI can be
continued in the rich browser UI, and the CLI's terminal panel already covers the
opposite direction.

## What a Pi package actually is

Verified against `@earendil-works/pi-coding-agent` 0.83.0
(`docs/packages.md`, `docs/extensions.md`).

- A package declares resources in `package.json` under a `pi` key, or relies on
  conventional directories:

  ```json
  {
    "name": "pi-workspace",
    "keywords": ["pi-package"],
    "pi": {
      "extensions": ["./extensions"],
      "skills": ["./skills"],
      "prompts": ["./prompts"],
      "themes": ["./themes"]
    }
  }
  ```

- Conventional fallbacks if no `pi` key: `extensions/`, `skills/`, `prompts/`,
  `themes/`.
- `keywords: ["pi-package"]` is what makes the package show up in the gallery at
  <https://pi.dev/packages>.
- Install is `pi install npm:pi-workspace`, which runs `npm install` in
  `~/.pi/agent/npm/` and records the package in `~/.pi/agent/settings.json`.
- Extensions are TypeScript loaded through jiti, so **no build step is needed**
  for package mode. A `.ts` file in `extensions/` is used as-is.

## Constraints that shape the design

These are the findings that make the design non-obvious.

### 1. Extension factories must not start background resources

`docs/extensions.md`:

> Extension factories may run in invocations that never start a session. Do not
> start background resources such as processes, sockets, file watchers, or timers
> from the factory. Defer background resource startup until `session_start` or
> the command/tool/event that needs the resource. Register an idempotent
> `session_shutdown` handler to close any session-scoped resources you start.

So an extension cannot start the workspace server at load time. It must start it
lazily — on the command that needs it — and tear it down on `session_shutdown`.

### 2. Core Pi packages must be peers, not bundled

`docs/packages.md`:

> Pi bundles core packages for extensions and skills. If you import any of these,
> list them in `peerDependencies` with a `"*"` range and do not bundle them:
> `@earendil-works/pi-ai`, `@earendil-works/pi-agent-core`,
> `@earendil-works/pi-coding-agent`, `@earendil-works/pi-tui`, `typebox`.

This collides with CLI mode, where the server imports
`@earendil-works/pi-coding-agent` at runtime and therefore needs it as a real
`dependency`.

There is a clean escape: **the extension only needs `import type`**, which jiti
erases. No runtime import means no second SDK instance, so the package can keep
the SDK in `dependencies` for the server without breaking package mode.

### 3. `node-pty` is a native module

`pi install` runs `npm install`, so the declared `dependencies` get built. If
`node-pty` stays in `dependencies`, every package-mode install compiles a native
module the extension never uses. It is not a no-op either — `node-pty` ships an
install script:

```
node scripts/prebuild.js || node-gyp rebuild
```

So a package-mode install would attempt a prebuild download and fall back to a
full `node-gyp` build, for a feature the handoff does not touch.

### 3b. The tarball would currently ship no resources at all

The published `files` array is:

```json
["bin", "dist-server", "dist", "scripts", "README.md", ".env.example"]
```

`extensions/` and `skills/` are absent. `pi install npm:pi-workspace` would
install a package whose `pi` manifest points at directories that are not in the
tarball, so package mode would silently load nothing. `extensions` and `skills`
must be added to `files` before any of this works.

### 4. Two writers on one Pi Session is a real risk

The server's `createPersistedPiSession()` appends to Pi session storage via
`SessionManager`. If the TUI holds a Session open while the browser workspace
also opens it, both can write. Nothing in the current design arbitrates that, and
package mode makes the overlap likely by design, because the whole point is
handing a live Session from one surface to the other.

This is the highest-risk unknown in the whole feature and needs a decision before
implementation, not after.

### 5. Version skew already exists

|                      | version |
| -------------------- | ------- |
| Installed `pi` CLI   | 0.84.0  |
| Project's pinned SDK | 0.83.0  |

A package's extension runs under whatever `pi` the Workspace Operator has, which
is why the peer range must be `"*"`. The bundled server pins its own SDK, so the
two can disagree.

### 6. Second server instance does not degrade gracefully

`server/index.ts` binds `PORT || 8787` and retries on `EADDRINUSE` five times,
then exits 1. An extension that wants to open the workspace needs to detect an
already-running instance rather than spawn a competing one.

## Proposed design

Package mode is a **thin extension that spawns the existing CLI**, not one that
imports the server.

```
extensions/workspace.ts        new — /workspace command, server lifecycle
skills/pi-workspace/SKILL.md   new — how the two surfaces relate
```

The extension:

1. Registers `/workspace` (and `/workspace terminal`) via `pi.registerCommand()`.
2. On invocation, probes `http://127.0.0.1:8787/api/health`, which already
   exists and returns `{"ok":true}`.
   - Reachable → reuse it.
   - Not reachable → ask via `ctx.ui.confirm()`, then spawn the CLI.
3. Spawns the CLI **from its own package root** rather than from `PATH`. Because
   the tarball ships `bin/` and `dist-server/`, an installed extension can
   resolve `bin/pi-workspace.mjs` relative to itself and run it with the current
   Node, so package mode works with no global install at all.
4. Opens `http://127.0.0.1:8787/sessions/<sessionId>?panel=chat`, reusing the
   existing deep-link format (`buildPiSessionUrl`).
5. Registers an idempotent `session_shutdown` handler that stops the server
   **only if this extension started it**.

Spawning rather than importing is what keeps `node-pty` and the SDK out of Pi's
module graph, and it sidesteps constraint 2 entirely.

## Alternatives Considered

### Import the server into the extension

- Pros: no child process, direct access to in-process state
- Cons: drags the SDK and `node-pty` into Pi's module graph, breaks the
  peer-dependency rule, and violates the factory lifecycle constraint
- Rejected: the extension would be far heavier than the feature it provides

### Publish two packages (CLI + thin package)

- Pros: each mode gets exactly the dependencies it needs; the Pi package would be
  nearly dependency-free; clean `peerDependencies`
- Cons: two publishes and two versions to keep in step; adds a workspace layout
- Rejected for now: real benefit, but the cost is not justified until the thin
  extension proves insufficient

### Extension is browser-open only, never starts a server

- Pros: simplest possible extension; no process management; no shutdown handling
- Cons: dead on arrival for anyone who has not already started the CLI, which is
  most people the feature is for
- Rejected: the handoff is only useful if it works from a cold start

### A `pi-workspace` skill without an extension

- Pros: no code, just documentation; zero risk
- Cons: a skill cannot open a browser or manage a server, so it cannot deliver
  the handoff
- Rejected: cannot satisfy the goal, though a skill is still worth shipping
  alongside the extension for orientation

## Open Decisions

These need answers before the implementation plan.

1. **What should package mode do?** The proposal is a `/workspace` handoff
   command plus an orientation skill. Is that the feature you want, or did you
   have a different contribution in mind (themes, prompt templates, agent tools)?
2. **How should the concurrent-write risk (constraint 4) be handled?**
   Options: hand off read-only, warn on overlap, take a session lock, or declare
   single-writer and accept the risk. This changes the design materially.
3. **Packaging shape:** one dual-mode package (simplest) or the two-package split
   (cleanest dependencies)?
4. **Should package mode require a global `pi-workspace` install**, or resolve
   the CLI from its own package root? The latter now looks clearly better — the
   tarball already ships `bin/` and `dist-server/`, so a self-relative spawn
   needs no global install and no `npx` network call. Confirm this is the
   intent.
5. **Version policy:** move the pinned SDK to 0.84.0 to match the installed `pi`,
   or keep 0.83.0 and rely on the `"*"` peer range?

## Non-Goals

- Replacing the TUI. Package mode hands off; it does not embed the workspace in
  the terminal.
- Remote or multi-user access. The server stays bound to `127.0.0.1` with no
  authentication, per ADR-003 and the README security section.
- Bundling the SDK for extensions, which `docs/packages.md` explicitly forbids.
