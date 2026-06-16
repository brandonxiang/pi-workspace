# Spec: Pi Session History Viewer

## Assumptions

1. 本功能建立在现有 Pi Sessions 左侧列表之上，不重新设计会话发现与项目分组。
2. 点击 Pi session 后，右侧展示该 session 当前活动分支的历史内容，而不是 JSONL 中所有分支的合并结果。
3. 本阶段仅支持只读查看，不恢复 session、不发送新消息，也不修改原始 session 文件。
4. 仓库已有目录名为 `tasks/`，因此 spec 放在该目录，而不是新建重复的 `task/`。
5. Pi session 详情接口只服务于当前绑定在 `127.0.0.1` 的本地应用；客户端不提交或获得 session 文件绝对路径。

这些假设需要在进入 Plan 阶段前由项目维护者确认。

## Objective

让用户点击左侧 **Pi Sessions** 中的任一会话后，在右侧现有对话面板中查看该 Pi session 的历史对话内容。

目标用户是在终端使用 Pi CLI、同时通过本浏览器应用回顾会话的本地开发者。成功体验应满足：

- 点击会话后立即出现明确的加载反馈。
- 加载成功后，右侧标题、消息内容和只读状态都对应被选中的 Pi session。
- 用户可以在 Pi session、浏览器本地 Conversations 和不同 Pi session 之间切换。
- 查看 Pi 历史不会覆盖浏览器 localStorage 中的会话，也不会写入 `~/.pi/agent/sessions/`。

### In Scope

- 新增单个 Pi session 的只读详情 API。
- 将左侧 Pi session 选中事件提升给 `App`，由右侧聊天面板响应。
- 展示当前活动分支中的用户消息、助手文本、工具调用与工具结果。
- 展示加载、空历史、失败和只读状态。
- 保持现有 `/api/chat` SSE 流式行为不变。

### Out of Scope

- 恢复或继续 Pi session。
- 分支树浏览、切换 leaf、fork、clone、rename 或 delete。
- 在历史视图中发送消息、清空消息或上传图片。
- 把 Pi session 导入浏览器 Conversations。
- 展示 extension 私有状态、隐藏 custom message 或完整 thinking 内容。

## Tech Stack

| Layer | Technology |
|---|---|
| Client | React, TypeScript, Ant Design X `Bubble.List` |
| Server | Fastify, TypeScript |
| Session SDK | `@earendil-works/pi-coding-agent@0.75.5` |
| Tests | Vitest |
| Build | Vite + Rolldown |

Pi session 必须通过 SDK 的 `SessionManager.listAll()`、`SessionManager.open()` 和 `getBranch()` 读取。不得由客户端解析 JSONL，也不得使用用户传入的文件路径直接打开文件。

## Commands

```bash
# Install dependencies
pnpm install

# Development server
pnpm run dev

# Unit tests
pnpm run test

# Client and server typecheck
pnpm run typecheck

# Required handoff verification
npm run build
```

## Project Structure

```text
client/
  App.tsx                         # Owns active right-panel view and detail loading
  PiSessionSection.tsx            # Lists sessions and emits selection events
  types.ts                        # Pi session detail API and normalized message types
  styles.css                      # Selected, loading, read-only and tool message styles
server/
  index.ts                        # GET /api/pi-sessions/:sessionId route
  pi-sessions.ts                  # Session lookup and entry normalization helpers
  pi-sessions.test.ts             # Lookup and normalization unit tests
tasks/
  pi-session-history-viewer-spec.md
```

No new dependency or new state-management library is expected.

## User Experience

### Selection And Navigation

- A Pi session row is a semantic `button`, not a clickable `div`.
- Clicking a row sets it as selected and requests its detail.
- Clicking a browser-local Conversation switches the right panel back to the existing editable conversation view.
- While `/api/chat` is streaming, Pi session selection remains disabled, matching current session-switch behavior.
- The selected Pi row remains highlighted during loading and after success. On detail failure it remains selected so the error has clear context and can be retried.

### Right Panel States

The right panel has two explicit modes:

1. `local-chat`: existing editable browser conversation, composer and Clear action.
2. `pi-history`: selected Pi session, read-only transcript, no editable composer and no Clear action.

In `pi-history` mode:

- Header title uses the Pi session name when available, otherwise its first user message, otherwise `Pi session`.
- Header title uses only the Pi session name when available. The first user message is only a fallback when no custom name exists.
- Header metadata shows project name/path and a `Read only` indicator.
- Loading replaces the transcript with a loading state; stale messages from the previous selection are not shown as if they belonged to the new selection.
- Empty active branches show `No displayable messages in this Pi session`.
- Errors show an inline message and a Retry action without breaking the sidebar or local conversations.
- The transcript remains vertically scrollable and uses the existing user/assistant alignment.

### Message Rendering

The API returns normalized display items so the client does not depend on Pi SDK union types.

| Pi content | Viewer behavior |
|---|---|
| User text | User bubble |
| User image | Return base64 data from the API and render the image inline in the transcript |
| Assistant text | Assistant bubble with provider/model metadata when available |
| Assistant tool call | Compact collapsible tool item; collapsed by default and expandable on click |
| Tool result | Compact collapsible tool result item; collapsed by default and expandable on click |
| Bash execution | Compact command/output item |
| Displayable custom message | Neutral notice item |
| Hidden custom message or custom state | Omitted |
| Thinking block | Omitted from the initial viewer |
| Compaction or branch summary | Distinct summary notice when it is part of the active branch, visually different from normal bubbles |

Large tool output must be bounded in the UI with collapsed overflow and explicit expand/collapse interaction; the full JSONL file must never be sent wholesale to the browser.

## API Contract

### Request

```http
GET /api/pi-sessions/:sessionId
```

`sessionId` is a full Pi session UUID obtained from `GET /api/pi-sessions`. The server resolves it by calling `SessionManager.listAll()` and matching an exact ID. The route must not accept a filesystem path.

### Success Response

```json
{
  "session": {
    "id": "019ec12b-...",
    "name": "Implement session viewer",
    "cwd": "/Users/me/github/pi-gui",
    "projectName": "pi-gui",
    "created": "2026-06-13T10:00:00.000Z",
    "modified": "2026-06-13T11:30:00.000Z"
  },
  "messages": [
    {
      "id": "entry-1",
      "role": "user",
      "content": "Show the saved conversation",
      "timestamp": 1781344800000
    },
    {
      "id": "entry-2",
      "role": "assistant",
      "content": "I will inspect the session format.",
      "provider": "anthropic",
      "model": "claude-sonnet-4-5",
      "timestamp": 1781344805000
    }
  ]
}
```

The exact normalized union may add role-specific fields, but every item must have a stable entry `id`, a display `role`, a numeric `timestamp`, and bounded display content.

For image-bearing user messages, the normalized payload may include base64-backed image items so the client can render the original image inline. This is an intentional exception to the general rule of trimming payload size and should be limited to images that already exist inside the selected active branch.

### Error Responses

- `400`: missing or malformed session ID.
- `404`: no exact session match exists, including sessions deleted after the sidebar was loaded.
- `500`: the session list or matching session cannot be read or parsed.

Error bodies use `{ "error": "human-readable message" }` and must not expose session file paths or raw stack traces.

## Code Style

Use small typed normalizers and explicit discriminated unions. Keep filesystem resolution on the server and rendering decisions on the client.

```typescript
export type PiHistoryMessage =
  | {
      id: string;
      role: "user" | "assistant";
      content: string;
      timestamp: number;
      provider?: string;
      model?: string;
    }
  | {
      id: string;
      role: "tool";
      toolName: string;
      content: string;
      isError: boolean;
      timestamp: number;
    };

export async function loadPiSessionById(sessionId: string) {
  const match = (await SessionManager.listAll()).find(
    (session) => session.id === sessionId
  );
  if (!match) return null;

  const manager = SessionManager.open(match.path);
  return normalizePiBranch(manager.getBranch());
}
```

Conventions:

- Use exact ID equality for session lookup.
- Keep API response types in `client/types.ts` and server normalizers independently typed.
- Use `try/catch` at route and fetch boundaries.
- Do not introduce `any` for Pi message content; narrow by `type` and `role`.
- Keep existing double-quote and semicolon formatting.

## Testing Strategy

### Unit Tests

Add Vitest coverage for server-side lookup and normalization:

- Exact session ID selects the expected `SessionInfo`; partial IDs do not match.
- Missing sessions return the not-found path.
- `getBranch()` order is preserved.
- User string and text-block content normalize correctly.
- Assistant text and provider/model metadata normalize correctly.
- Tool calls, tool results, bash execution, summaries and displayable custom messages normalize correctly.
- Tool calls and tool results include the metadata needed for default-collapsed rendering and click-to-expand behavior.
- User images are returned with base64 content and renderable metadata.
- Hidden custom messages and thinking blocks are omitted.
- Empty or unsupported content does not crash normalization.
- Oversized tool output is truncated or marked for collapsed display according to the chosen limit.

### Integration And Manual Verification

- `pnpm run test` passes.
- `pnpm run typecheck` passes.
- `npm run build` passes.
- Start `pnpm run dev` and verify in a browser with at least two real Pi sessions.
- Confirm Pi-to-Pi and Pi-to-local switching updates title, selected row, transcript and composer state correctly.
- Confirm tool calls and tool results are collapsed by default and expand on click.
- Confirm user images render inline from base64 data.
- Confirm compaction and branch summary notices are visually distinct from user and assistant bubbles.
- Confirm refresh returns to the existing local conversation behavior; persisting Pi selection is not required in this phase.
- Confirm `/api/chat` still streams deltas in local-chat mode.

Client component test infrastructure is not currently present. Do not add a DOM testing dependency solely for this feature without approval; cover transformation logic with unit tests and interaction behavior with browser verification.

## Boundaries

### Always

- Read sessions through `@earendil-works/pi-coding-agent` SDK APIs.
- Resolve the server-side file path from an exact ID found by `SessionManager.listAll()`.
- Render only the current active branch returned by `getBranch()`.
- Keep Pi history read-only and separate from localStorage Conversations.
- Preserve `/api/chat` streaming behavior and existing server-side credential handling.
- Show explicit loading, empty and error states.
- Keep the server bound to `127.0.0.1` while unauthenticated local session content is exposed.

### Ask First

- Enabling resume/continue, branching, deletion, rename or any Pi session mutation.
- Exposing the server beyond localhost or adding remote access.
- Adding dependencies or a client test framework.
- Persisting selected Pi session state across page refreshes.
- Rendering full thinking content or unbounded tool output.

### Never

- Accept an arbitrary session file path from the client.
- Return the matched JSONL path, raw JSONL file or stack trace to the client.
- Modify, append to or delete Pi session files in this feature.
- Copy Pi history into localStorage or send it to `/api/chat` automatically.
- Expose provider credentials or other local authentication data.

## Success Criteria

1. Clicking any enabled Pi session row loads that exact session into the right panel without a page refresh.
2. The right panel shows the selected session title/context and active-branch history in chronological order.
3. User, assistant, tool, image and supported summary content render without crashing on heterogeneous Pi entries.
4. The Pi history view is visibly read-only: composer and Clear action are unavailable.
5. Clicking a browser-local Conversation restores its original editable messages and composer without data loss.
6. Switching rapidly between Pi sessions cannot allow an older request to overwrite the latest selection.
7. A missing, deleted or malformed session produces an inline recoverable error.
8. The detail endpoint cannot be used to open an arbitrary path and does not reveal local session paths.
9. Existing local conversation persistence and `/api/chat` streaming behavior remain unchanged.
10. Tool calls and tool results are collapsed by default and can be expanded inline on click.
11. User images in the selected active branch are returned as base64 and displayed inline.
12. Compaction and branch summary entries are shown with styling that clearly distinguishes them from ordinary chat bubbles.
13. `pnpm run test`, `pnpm run typecheck`, and `npm run build` pass; the interaction is verified in a browser.

## Confirmed Decisions

1. Tool calls and tool results are collapsed by default and expand inline on click.
2. User images are returned as base64 and rendered inline in the transcript.
3. Compaction and branch summary entries are displayed, with distinct styling from standard conversation bubbles.
4. The right-panel title uses the Pi session custom name when present.
