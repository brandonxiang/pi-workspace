# Spec: Pi Sessions Sidebar

## Objective

在左侧边栏中新增"Pi 会话"区域，展示本机所有 Pi CLI 会话，并按项目维度组织。用户无需离开浏览器即可浏览、搜索、切换和恢复他们在终端中创建的 Pi 对话。

**场景：** 用户在终端通过 `pi` CLI 与多个项目进行对话后，打开本 Web 应用，应能在左侧边栏看到按项目分组的 Pi 会话列表，点击后可恢复对话（或至少查看历史）。

**用户：** 既使用 `pi` CLI 也使用本 Web 界面的开发者。

**成功标准：**
- 左侧边栏展示 `<project-name>` 分组，每个分组下列出该项目的 Pi 会话
- 每个 Pi 会话显示：首条消息摘要、消息数量、最后活动时间
- 点击 Pi 会话条目可加载对话到聊天面板（只读或可继续对话）
- Pi 会话数据来源为 `~/.pi/agent/sessions/`，通过服务端 API 提供

---

## Tech Stack

| 层 | 技术 |
|---|---|
| 后端 | Fastify 5 + `@earendil-works/pi-coding-agent` (SessionManager) |
| 前端 | React 19 + Ant Design X |
| 构建 | Vite 8 + `@fastify/vite` |
| 类型 | TypeScript 5 |

---

## Commands

```bash
# Development (single Fastify server with Vite HMR)
pnpm run dev

# Typecheck
pnpm run typecheck

# Build (client + server)
pnpm run build

# Production start
pnpm start

# Run tests
pnpm run test
```

---

## Project Structure

```
pi-gui/
├── client/                  # React frontend
│   ├── App.tsx              # Main app with sidebar + chat panel
│   ├── index.html           # SPA entry
│   ├── main.tsx             # React mount
│   ├── styles.css           # All styles
│   └── types.ts             # Frontend types
├── server/                  # Fastify backend
│   ├── index.ts             # Server entry + API routes
│   ├── chat-validation.ts   # Image/input validation
│   └── chat-validation.test.ts
├── tasks/                   # Specs and task breakdowns
│   └── pi-sessions-sidebar-spec.md   # ← this file
├── vite.config.ts           # Vite + fastify-vite config
├── tsconfig.json            # Frontend TS config
├── tsconfig.server.json     # Server TS config
└── package.json
```

---

## Code Style

Import ordering and naming conventions match the existing codebase:

```typescript
// Server: existing pattern for API routes
server.get("/api/pi-sessions", async (_request, reply) => {
  try {
    const sessions = await SessionManager.listAll();
    return { sessions: groupByProject(sessions) };
  } catch (error) {
    reply.code(500);
    return { error: String(error) };
  }
});

// Client: fetch on mount, render grouped in sidebar
const { data: piSessions, loading: piLoading } = useFetch("/api/pi-sessions");

// Display: project groups with collapsible sections
<aside className="sidebar">
  ...
  <PiSessionSection
    projects={piSessions}
    onSelectSession={(sessionId) => loadPiSession(sessionId)}
  />
  ...
</aside>
```

Key conventions:
- **Server:** Error handling with `try/catch` + HTTP status codes; data via `return`
- **Client:** Hooks at top, derived state via `useMemo`, async via `useEffect`
- **Styles:** CSS custom properties (same design tokens)
- **No dependency on external state management** — keep using React state + localStorage

---

## Testing Strategy

| Test level | Framework | Where | What |
|---|---|---|---|
| Unit (server) | Vitest | `server/*.test.ts` | Validation logic, session parsing |
| Unit (client) | Vitest | `client/*.test.ts` (new) | Grouping logic, formatting |
| Integration | Manual / E2E | Browser | Sidebar rendering, API response, project grouping |

**Coverage expectations:**
- Session grouping logic: 100% branch coverage
- API route error handling: tested via mock SessionManager

---

## Boundaries

- **Always:**
  - Group Pi sessions by project directory name
  - Collapse projects with zero sessions
  - Show loading state while fetching from `/api/pi-sessions`
  - Handle API errors gracefully (show inline error, not blank screen)
  - Read Pi sessions via `SessionManager.listAll()` — never read filesystem directly

- **Ask first:**
  - Adding session search/filter UI
  - Adding session deletion from the browser
  - Adding /resume-like functionality to continue pi sessions from the browser
  - Changing the session storage path

- **Never:**
  - Expose Pi session file contents via a non-authenticated endpoint
  - Modify or delete Pi session files from the browser
  - Import Pi session files into the app's own localStorage-based session store
  - Hard-code session paths

---

## Success Criteria

1. **API endpoint `/api/pi-sessions`** returns projects grouped with sessions:
   ```json
   {
     "projects": [
       {
        "name": "pi-gui",
        "path": "/Users/me/github/pi-gui",
         "sessions": [
           {
             "id": "019ec12b-...",
             "firstMessage": "帮我把 express 换成 fastify",
             "messageCount": 57,
             "created": "2026-06-13T13:28:20.464Z",
             "modified": "2026-06-13T21:52:00.000Z"
           }
         ]
       }
     ]
   }
   ```

2. **Left sidebar** shows a "Pi Sessions" section with collapsible project groups

3. **Each project group** shows the project name + session count badge

4. **Each session item** shows: first message preview (truncated 60 chars), message count, relative time

5. **Clicking a session** prints its full content to console initially (Phase 1); later loads into chat panel (Phase 2)

6. **Error state** — if `/api/pi-sessions` fails, show a subtle notice, don't break the rest of the UI

7. **Zero state** — if no Pi sessions exist, show "No PI sessions found"

---

## Open Questions

1. **Pi 会话点击后：** 第一次是只看还是可以继续对话？建议第一阶段只读查看，第二阶段再加入 `/resume` 功能。
2. **项目自动扫描范围：** 只扫 `~/.pi/agent/sessions/` 下已有目录，还是允许用户手动添加额外路径？建议只扫默认目录。
3. **性能：** `SessionManager.listAll()` 需要遍历所有 session 文件读首行。如果 session 很多（>1000），能否设置一个缓冲机制？
4. **数据显示量：** 首条消息的内容可能会很长（包含 `<skill>` 标签等），是否截断长度？
5. **与现有侧边栏"Conversations"区域的关系：** 是作为独立区域共存，还是未来合并？

---

## Plan Summary

### Phase 1: API + Data Layer

- [ ] Add `/api/pi-sessions` endpoint to `server/index.ts` using `SessionManager.listAll()`
- [ ] Group session results by project directory
- [ ] Add error handling and appropriate response format
- [ ] Write unit tests for grouping logic

### Phase 2: Sidebar UI

- [ ] Add `PiSessionSection` component to the sidebar
- [ ] Implement collapsible project groups (each expandable)
- [ ] Add loading, error, and zero states
- [ ] Style to match existing sidebar design

### Phase 3: Session Detail View

- [ ] `/api/pi-sessions/:projectDir/:sessionId` — return session messages
- [ ] Click → load session messages into chat panel (read-only mode)
- [ ] Show conversation scrollable with existing Bubble components

### Phase 4: Polish (optional)

- [ ] Search/filter Pi sessions by text
- [ ] Session deletion from UI (confirmation prompt)
- [ ] /resume integration: continue pi session from browser

---

## Tasks

### Task 1: Add `/api/pi-sessions` endpoint

- **Acceptance:** `GET /api/pi-sessions` returns grouped project + session data
- **Verify:** `curl http://127.0.0.1:8787/api/pi-sessions | jq`
- **Files:** `server/index.ts`

### Task 2: Add `PiSessionSection` component to sidebar

- **Acceptance:** Sidebar shows collapsible project groups with session items
- **Verify:** `pnpm run dev` + browser inspection
- **Files:** `client/App.tsx`, (optional) `client/PiSessionSection.tsx`

### Task 3: Add session detail API + read-only viewer

- **Acceptance:** Clicking a Pi session loads its messages into the chat panel
- **Verify:** Manual test with existing session data
- **Files:** `server/index.ts`, `client/App.tsx`, `client/PiSessionViewer.tsx`

### Task 4: Write unit tests

- **Acceptance:** Session grouping and formatting logic has >80% branch coverage
- **Verify:** `pnpm run test`
- **Files:** `server/pi-sessions.test.ts`, `client/PiSessionSection.test.tsx`
