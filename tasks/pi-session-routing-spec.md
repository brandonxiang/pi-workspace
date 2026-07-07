# Spec: Pi Session Routing

## Assumptions

1. 这是一个单页 Web 应用，当前没有正式的客户端路由系统，地址栏尚未表达右侧正在查看哪个 Pi session。
2. 本次改造的核心目标是让“当前视图”“当前面板模式”和“当前 Pi session”可被 URL 表达、刷新恢复和分享，而不是重做整套页面信息架构。
3. 现有 `PiSessionSection`、`/api/pi-sessions` 和 `/api/pi-sessions/:sessionId` 行为应继续保留；路由层是在其上增加状态同步。
4. 默认不新增 `react-router` 等依赖，优先使用浏览器 `history.pushState`、`replaceState` 和 `popstate`，除非维护者明确希望引入路由库。
5. 现阶段只有一种需要被路径表达的业务实体：Pi session；面板模式使用查询参数表达；“空状态”也需要有明确路由表示。

这些假设如果不对，我会据此调整 spec。

## Objective

为当前浏览器界面加入最小但可靠的客户端路由系统，让用户能直接从 URL 看出自己正在查看哪个 Pi session，以及当前处于对话模式还是终端模式，并在刷新、前进后退、复制链接后保持同一上下文。

目标用户是在本机同时使用 Pi CLI 和本 Web UI 的开发者。成功体验应满足：

- 打开一个 Pi session 后，地址栏能显示该 session 的身份。
- 地址栏能够区分当前是 `chat` 还是 `terminal` 面板模式。
- 刷新页面后，应用优先按 URL 恢复当前 session，而不是只依赖 `localStorage`。
- 浏览器前进 / 后退能在最近访问的 session 或空状态之间切换。
- 当 URL 指向一个不存在的 session 时，界面给出明确错误，不会 silently fallback 到别的 session。

### In Scope

- 设计并实现当前 SPA 的路由解析与写回。
- 为“空状态”和“Pi session 详情”定义稳定 URL。
- 为 `chat` / `terminal` 面板模式定义稳定查询参数。
- 将当前 `activePanelView` 与浏览器历史同步。
- 在应用启动时优先从 URL 恢复选中 session。
- 为非法或失效的 `sessionId` 提供错误态与恢复路径。
- 为路由解析和历史回退补充测试。

### Out of Scope

- 引入多页面架构或服务端页面路由。
- 为本地 chat session 单独建立一套新资源模型。
- session 搜索、过滤、分享权限、鉴权。
- 变更现有 `/api/chat` SSE 流式协议。
- 重新设计侧边栏或消息渲染。

## Tech Stack

| Layer | Technology |
|---|---|
| Client | React 19 + TypeScript |
| UI | Ant Design X + existing CSS |
| Server | Fastify + existing Pi session APIs |
| Session SDK | `@earendil-works/pi-coding-agent@0.75.5` |
| Tests | Vitest + jsdom |

路由实现默认建立在浏览器原生 History API 之上，不新增客户端路由依赖。

## Commands

```bash
pnpm install
pnpm run dev
pnpm run test
pnpm run typecheck
pnpm run build
npm run build
```

## Project Structure

```text
client/
  App.tsx                      # Owns active view state and will become the routing integration point
  main.tsx                     # App bootstrap; no route logic expected here initially
  PiSessionSection.tsx         # Emits Pi session selection events
  App.test.tsx                 # Route parsing, URL sync, back/forward behavior tests
  types.ts                     # Existing Pi session types, likely unchanged or minimally extended
  styles.css                   # Optional route-related error / metadata styling
  app-routing.ts               # New: URL parse/build helpers for current view state
server/
  index.ts                     # Existing Pi session APIs; no new route-serving layer expected
tasks/
  pi-session-routing-spec.md
```

If the route helper stays small, it may live inside `client/App.tsx`; otherwise extract it to `client/app-routing.ts` to keep parsing pure and testable.

## URL Design

Default route shapes:

- `/` or `/?panel=chat|terminal`:
  Empty launcher state. No Pi session selected.
- `/sessions/:sessionId` or `/sessions/:sessionId?panel=chat|terminal`:
  Pi session history view for the exact session ID, optionally specifying which panel mode to open.

Behavior rules:

- Selecting a Pi session pushes `/sessions/:sessionId` and preserves the current `panel` query.
- Initial hydration reads `location.pathname` and `location.search` before consulting `localStorage`.
- If URL and `localStorage` disagree, URL wins for that browser tab.
- If `panel` is absent from the URL, fall back to the stored panel mode and finally to the current default (`chat`).
- Changing panel mode updates the current URL so the active route remains shareable.
- Clearing the current selection or landing in launcher mode replaces the URL with `/` plus the current `panel` query when explicit mode preservation is needed.
- Browser back/forward replays route state via `popstate` without full-page reload.
- Unknown routes should normalize to `/` while preserving a valid `panel` query when present.
- A route that looks like `/sessions/:sessionId` but fails to load should keep its URL and show an inline error.

## Code Style

Keep routing logic in small pure functions, and keep side effects inside React effects or event handlers.

```typescript
type AppRoute =
  | { kind: "home"; panel: PanelMode | null }
  | { kind: "pi-session"; sessionId: string; panel: PanelMode | null };

export function parseAppRoute(url: URL): AppRoute {
  const panel = readPanelMode(url.searchParams.get("panel"));
  const match = /^\/sessions\/([^/]+)$/.exec(url.pathname);
  if (match) {
    return { kind: "pi-session", sessionId: decodeURIComponent(match[1]), panel };
  }
  return { kind: "home", panel };
}

export function buildPiSessionUrl(sessionId: string, panel: PanelMode) {
  return `/sessions/${encodeURIComponent(sessionId)}?panel=${panel}`;
}
```

Conventions:

- Route parsing and path building should be deterministic and unit-testable.
- `App.tsx` should orchestrate hydration, selection, and history writes, not embed regex-heavy parsing inline.
- Prefer `replaceState` during initial normalization and `pushState` for user-initiated navigation.
- Avoid duplicating session-selection logic between sidebar clicks and `popstate`; both should flow through the same `selectPiSession` path where possible.
- Treat panel mode as route state when present in the URL, and as user preference when absent.

## Testing Strategy

| Test level | Where | What |
|---|---|---|
| Unit | `client/app-routing.test.ts` or `client/App.test.tsx` | Parse/build route helpers, invalid path handling |
| Integration-like UI | `client/App.test.tsx` | Hydrate from URL, update URL on selection, respond to `popstate` |
| Regression | existing client tests | Ensure current Pi session loading and empty state still render |
| Verification | browser manual check | Refresh on `/sessions/:id`, click sidebar, use back/forward |

Minimum coverage targets:

- Valid `/sessions/:id` parsing
- Valid `panel=chat|terminal` parsing
- Unknown path fallback
- URL precedence over `localStorage`
- URL update on Pi session selection
- URL update on panel mode change
- Back/forward restoring the prior selection

## Boundaries

- Always:
  - Make URL the source of truth for initial route hydration in the current tab.
  - Keep current session loading behavior and error handling intact.
  - Preserve streaming safeguards: while Pi streaming is active, do not allow route-triggered session switching to break current protections.
  - Keep routes shareable without exposing filesystem paths or secrets.
  - Keep the current panel mode shareable when the route explicitly sets it.

- Ask first:
  - Adding `react-router` or any new runtime dependency.
  - Introducing additional route types such as project-level pages or local chat conversation IDs.
  - Changing server behavior to support route-driven redirects or SSR.

- Never:
  - Put absolute local paths into the URL.
  - Auto-fallback from an invalid `sessionId` URL to an arbitrary “nearest” session.
  - Break direct navigation to `/` when Pi CLI data is unavailable.

## Success Criteria

1. 打开应用首页 `/` 或 `/?panel=<mode>` 时，右侧保持现有空状态，且不自动写入伪 session 路由。
2. 在侧边栏点击某个 Pi session 后，地址栏变为 `/sessions/<sessionId>?panel=<currentMode>`，并成功加载对应历史。
3. 刷新 `/sessions/<sessionId>?panel=<mode>` 后，应用直接恢复到该 session 和该面板模式，而不是依赖 `localStorage` 选择其他状态。
4. 当 `localStorage` 保存的是 A session / `chat` 模式，但当前 URL 是 B session / `terminal` 模式时，本标签页以 URL 为准。
5. 对不存在或已删除的 `/sessions/<sessionId>`，界面显示明确错误并保留该 URL 作为问题上下文。
6. 在设置中切换 `chat` / `terminal` 后，当前 URL 会同步更新 `panel` 参数。
7. 使用浏览器前进 / 后退时，应用在 `/`、最近访问的 session 路由和两种面板模式之间正确切换。
8. `pnpm run test` 与 `npm run build` 通过。

## Open Questions

1. 当 URL 不带 `panel` 参数时，是否继续使用 `localStorage` 里的面板偏好，还是统一视为 `chat`？当前 spec 先按“URL 未指定时回退到 `localStorage`”。
2. 当 session 不存在时，你更偏好：
   - 保留在错误页并继续显示 `/sessions/:id`
   - 自动跳回 `/`
   当前 spec 先按前者，因为更利于定位问题，也更符合可分享链接的预期。

## Implementation Sketch

### Phase 1: Route Model

- Add pure helpers to parse current pathname/query and build route URLs.
- Decide route precedence: URL first, then `localStorage`, then empty state/default mode.

### Phase 2: App State Integration

- Hydrate `App` from `window.location.pathname`.
- Update `selectPiSession`, panel-mode changes, and `clearSelectedPiSession` to write history entries.
- Listen to `popstate` and replay selection changes through the same load path.

### Phase 3: Error and Regression Handling

- Keep invalid session routes visible and show existing error UI.
- Ensure streaming mode still blocks unsafe switching.
- Add targeted tests and manual verification.
