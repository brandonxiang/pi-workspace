# Spec: Pi Workspace Performance Optimization Roadmap

## Assumptions

1. This is a browser-based React application with a Fastify + Node server.
2. The immediate goal is to identify high-value performance work, not to implement it in this pass.
3. The most important user-visible performance surfaces are initial load, Pi session switching, and streaming responsiveness during long conversations.
4. We can accept moderate refactors in the client render tree and server session-loading paths, but should avoid changing the underlying `@earendil-works/pi-coding-agent` session model unless profiling proves it is the bottleneck.

## Objective

Create a practical performance roadmap for Pi Workspace that prioritizes the work most likely to improve:

- initial page interactivity
- Pi session list and session detail loading
- responsiveness while assistant output is streaming
- scalability as the number of sessions and transcript length grow

Success means we can point to a short, evidence-backed backlog with clear acceptance criteria instead of doing generic "performance cleanup."

## Current Decisions

- Prioritize `#1` first load and `#1` session switching UX over lower-signal micro-optimizations.
- Stay dependency-light: prefer local helpers and existing build/runtime tools over adding profiling or caching packages.
- Treat session metadata caching as the first implementation slice because it improves both API efficiency and session-switch responsiveness without architectural churn.

## Tech Stack

- Client: React, Vite, TypeScript, Ant Design, `@ant-design/x`
- Server: Fastify, Node.js, TypeScript, rolldown
- Session SDK: `@earendil-works/pi-coding-agent`
- Terminal: `@xterm/xterm`, `@xterm/addon-fit`
- Tests: Vitest

## Commands

- Install: `pnpm install`
- Dev: `pnpm run dev`
- Test: `pnpm run test`
- Typecheck: `pnpm run typecheck`
- Build: `pnpm run build`
- Production start: `pnpm start`

## Project Structure

- `client/` -> React SPA UI, including chat, Pi sessions, markdown rendering, terminal panel
- `server/` -> Fastify API routes, chat streaming, Pi session loading and local actions
- `shared/` -> Shared slash-command logic used by client and server
- `tasks/` -> Specs and planning artifacts
- `docs/` -> Domain and ADR documentation
- `vite.config.ts` -> client build and chunking strategy
- `rolldown.server.config.mjs` -> server bundling

## Code Style

Prefer small pure helpers for state transforms, then wire them into React with explicit memoization only where the render cost is real.

```ts
export function groupPiHistoryMessages(messages: PiHistoryMessage[]): PiHistoryTranscriptEntry[] {
  const entries: PiHistoryTranscriptEntry[] = [];
  let activeToolGroup: Extract<PiHistoryTranscriptEntry, { role: "tool-group" }> | null = null;

  for (const message of messages) {
    if (message.role === "tool") {
      activeToolGroup ??= {
        id: `tool-group-${message.id}`,
        role: "tool-group",
        messages: [],
        timestamp: message.timestamp,
      };
      activeToolGroup.messages.push(message);
      continue;
    }

    if (activeToolGroup) {
      entries.push(activeToolGroup);
      activeToolGroup = null;
    }

    entries.push(message);
  }

  if (activeToolGroup) entries.push(activeToolGroup);
  return entries;
}
```

Key conventions:

- Keep client render helpers deterministic and cheap.
- Put expensive parsing, grouping, and normalization behind stable boundaries.
- Prefer lazy loading for optional UI surfaces.
- Avoid work that scales with total transcript/session count on every streaming delta.

## Testing Strategy

- Unit tests: Vitest for client and server helpers
- Build verification: `pnpm run build`
- Runtime verification for UI-facing changes: `pnpm run dev` and manual browser validation
- Performance verification for implementation work:
  - compare production build artifact sizes before/after
  - manually test long Pi transcripts and frequent streaming updates
  - measure session-switch latency against a seeded dataset

For performance-specific changes, prefer targeted regression tests around:

- transcript grouping and streaming state transforms
- session loading and context usage loading logic
- route-level or panel-level lazy loading behavior

## Boundaries

- Always:
  - keep provider keys on the server
  - preserve `/api/chat` streaming behavior
  - run `pnpm run build` before handoff
  - preserve current user-visible behavior unless the optimization explicitly changes UX
- Ask first:
  - replacing Ant Design / `@ant-design/x`
  - changing session persistence layout on disk
  - adding new build tooling such as a bundle visualizer or profiling dependency
- Never:
  - expose model credentials to the client
  - remove streaming updates to make traces "look faster"
  - optimize by dropping Pi session correctness or history fidelity

## Current Baseline

Measured from `pnpm run build` on 2026-07-07:

- `dist/client/assets/ui-vendor-rOhA_4VJ.js`: 1477.12 kB raw, 498.61 kB gzip
- `dist/client/assets/terminal-BO4C1tZF.js`: 341.53 kB raw, 86.62 kB gzip
- `dist/client/assets/MarkdownContent-mUKQTBlD.js`: 135.71 kB raw, 39.95 kB gzip
- `dist/client/assets/index-B6bNbtg2.js`: 69.36 kB raw, 20.47 kB gzip

Observed code-level hotspots:

- `vite.config.ts` groups all `antd` and `@ant-design` code into one `ui-vendor` chunk.
- `client/App.tsx` rebuilds the full Pi transcript bubble list when streaming draft state changes.
- `client/MarkdownContent.tsx` pulls in `@ant-design/x` code highlighting for any multiline code block.
- server session detail and context usage paths repeatedly call `SessionManager.listAll()`.

## Implemented In This Pass

Implemented on 2026-07-08:

- Added a shared async snapshot cache for Pi session catalog metadata in `server/pi-sessions.ts`.
- Switched Pi session project listing, detail lookup, and context lookup onto the shared cached session catalog.
- Invalidated the session catalog cache after session creation and rename so metadata stays fresh.
- Added a lightweight client-side Pi session detail cache so revisiting a previously loaded session can keep prior content visible while refresh happens in the background.
- Changed the session panel rendering so an already loaded session is not replaced by the full-page Pi session loading state during a revisit refresh.

Net effect:

- less repeated `SessionManager.listAll()` churn on the server
- fewer "Loading Pi session history…" flashes when bouncing between previously opened sessions
- no new runtime dependencies

## Performance Opportunities

### 1. Break up the eager `ui-vendor` chunk

Evidence:

- `vite.config.ts` places all `antd` and `@ant-design` modules into `ui-vendor`.
- The largest client chunk is nearly 500 kB gzip.

Why it matters:

- This is the clearest first-load bottleneck in the current build.
- It likely loads UI code that is only needed for settings modals, suggestions, or secondary panels.
- This is now the highest-priority remaining performance task.

Candidate changes:

- split `antd` primitives from `@ant-design/x`
- lazy load modal-heavy settings flows
- lazy load slash suggestions and other secondary UI affordances
- verify whether some `@ant-design/x` pieces can move out of the first paint path

### 2. Stop rebuilding the entire transcript during streaming

Evidence:

- `client/App.tsx` recomputes grouped history and bubble items in `piHistoryBubbleItems`.
- That memo depends on streaming draft items, so every delta can rebuild all prior history.

Why it matters:

- Small chats will feel fine, but long Pi transcripts will accumulate avoidable render cost.
- This directly affects "typing" smoothness while the assistant is streaming.

Candidate changes:

- separate stable history items from ephemeral streaming items
- memoize grouped transcript entries from persisted history only
- append streaming draft UI outside the history mapping path
- consider list virtualization only if the transcript still lags after structural fixes

### 3. Reduce server-side session scan churn on selection

Evidence:

- `server/pi-sessions.ts` calls `SessionManager.listAll()` in both `loadPiSessionDetailById` and `loadPiSessionContextById`.
- `/api/sessions/:sessionId/context-usage` may also construct a temporary agent session when there is no cache hit.

Why it matters:

- Session switching cost will grow with the total number of sessions.
- The user pays for repeated disk scanning and session reconstruction on a very common path.

Candidate changes:

- cache the session index returned by `SessionManager.listAll()`
- reuse session metadata between detail and context-usage requests
- return context-usage with the main detail payload when feasible
- add expiry/invalidation rules around cache freshness

Status:

- Phase 1 complete: session catalog snapshot caching is implemented.
- Remaining follow-up: consider folding context-usage hydration into the main detail path if profiling shows that temporary session reconstruction is still noticeable.

### 4. Make markdown code highlighting cheaper

Evidence:

- `client/MarkdownContent.tsx` imports `@ant-design/x/es/code-highlighter`.
- The markdown chunk is 135.71 kB raw even though many assistant messages are plain prose.

Why it matters:

- The markdown renderer is a common path for assistant messages.
- Full highlighting is disproportionately expensive if only a minority of responses contain fenced code.

Candidate changes:

- lazy load the highlighter only when fenced code is actually present
- switch to a lighter syntax-highlighting path
- render plain `<code>` for simple blocks and defer rich highlighting behind interaction if necessary

### 5. Defer non-critical startup fetches and large optional surfaces

Evidence:

- The initial app effect fetches `/api/models`, `/api/skills`, `/api/cwd`, and `/api/pi-sessions` immediately.
- Some of that data is only needed for settings or slash-command enrichment.

Why it matters:

- Even if requests are parallel, they still add startup competition and app initialization work.

Candidate changes:

- fetch models on settings open or first composer use
- fetch skills only when slash suggestions are invoked
- keep `/api/pi-sessions` and essential route hydration as the primary startup path

### 6. Prepare for large session lists

Evidence:

- `client/PiSessionSection.tsx` derives order, expansion, and visible sessions from full project arrays each render.
- Menu items and rows are rebuilt for every visible session.

Why it matters:

- This is not the first optimization to do, but it becomes noticeable when the workspace accumulates many sessions.

Candidate changes:

- memoize row-level rendering
- precompute archive-filtered project collections higher in the tree
- add virtualization if real datasets show sidebar slowdowns

Status:

- Partial progress: previously opened session details are now cached on the client, which reduces panel churn during revisits.
- Remaining work is mainly for very large project/session counts.

### 7. Throttle expensive terminal resize behavior

Evidence:

- `client/TerminalPanel.tsx` calls `fitAddon.fit()` on every `ResizeObserver` notification.

Why it matters:

- This only affects terminal mode, but resizes can be noisy and xterm fit operations are not free.

Candidate changes:

- throttle or `requestAnimationFrame`-gate resize fitting
- avoid reconnecting or refitting unless container dimensions actually changed

## Success Criteria

- First-load critical JS is reduced enough that no single eagerly loaded client chunk exceeds 250 kB gzip.
- Streaming a long Pi response does not require remapping the entire persisted transcript on every delta.
- Selecting an existing Pi session performs at most one indexed session lookup path, not repeated full session catalog scans.
- Markdown rendering keeps plain-text assistant responses off the expensive syntax-highlighting path.
- Optional startup data is deferred so initial load focuses on route hydration and active session content.
- Every optimization phase can be verified with `pnpm run build` plus one focused runtime check.

## Progress Against Success Criteria

- `Selecting an existing Pi session performs at most one indexed session lookup path, not repeated full session catalog scans.`
  Status: partially achieved. The shared server-side session catalog cache now removes repeated catalog scans inside the same freshness window.
- `Optional startup data is deferred so initial load focuses on route hydration and active session content.`
  Status: not started.
- `First-load critical JS is reduced enough that no single eagerly loaded client chunk exceeds 250 kB gzip.`
  Status: not started; still blocked by the `ui-vendor` chunk.

## Open Questions

1. For the next pass, should we focus entirely on first-load chunk splitting, or also defer non-critical startup fetches in the same change?
2. Do you want session detail caching to remain in-memory only, or eventually persist across reloads?
3. Is context-usage hydration noticeable enough in real use that it should be optimized before transcript rendering?
