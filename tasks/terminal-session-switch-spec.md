# Spec: 终端模式下切换 Session 用 window.open 打开新标签页

## Objective

当前终端模式下切换 Pi session 时，面板内容会被替换（WebSocket 断开、PTY 进程被 kill)，终端状态丢失。本 spec 将其改为：终端模式下点击/创建新的 Pi session 时，通过 `window.open` 在新标签页打开目标 session，保持当前标签页的终端连接不中断。

**用户场景：** 用户在终端模式下连到一个 session 的 shell 环境（比如在跑一个长时间任务），同时想切换到另一个 session 查看/对话。当前行为会中断运行中的任务；目标行为是新标签页打开目标 session，原有终端的任务继续运行。

## 核心逻辑

```
panelMode === "chat"?
  → 现有行为不变（inline selectPiSession）
panelMode === "terminal"?
  → 用 window.open('/sessions/{sessionId}?panel=terminal', '_blank')
  → 不调用 selectPiSession，不清除当前 state
  → 当前终端的 WebSocket / PTY 继续存活
```

## 现有代码中的 Session 切换入口

| 入口                          | 位置（App.tsx）                    | 当前调用                           |
| ----------------------------- | ---------------------------------- | ---------------------------------- |
| 侧边栏点击 session            | `onSelectSession={...}`            | `selectPiSession(sessionId)`       |
| Launcher 新建 session         | `createPiSessionInProject`         | selectPiSession + clearSelected... |
| Launcher 选择已有 session     | `openNewestSessionForProject`      | selectPiSession                    |
| Launcher 新 session（browse） | `handleBrowseChange` → create...   | 同上                               |
| Hydrate 初始选择              | `refreshPiProjects` → `didHydrate` | selectPiSession                    |
| popstate 历史回退             | `handlePopState`                   | selectPiSession / clearSelected... |

**本 spec 只改前三项（侧边栏点击 + launcher 新建 + launcher 选择）的终端模式行为。** 初始化 hydrate 和 popstate 不做改动——它们只是复现 URL 状态，不触发现实中的 session 切换意图。

## Commands

```bash
Build:     pnpm run build
Dev:       pnpm run dev
Test:      pnpm run test
Typecheck: pnpm run typecheck
```

## Tech Stack

无新增依赖。全部改动在 `client/App.tsx`。

## Files

```
EDIT client/App.tsx   — 在 session 切换入口处判断 panelMode，终端模式下 window.open
```

## Code Style

保持现有 `App.tsx` 的代码风格。在切换入口处加一个 guard：

```tsx
// 终端模式下：window.open 到新标签页
if (panelMode === "terminal") {
  window.open(buildPiSessionUrl(sessionId, "terminal"), "_blank");
  return; // 或 closeLauncher() 后 return
}
```

## Code Changes 详情

### 1. 侧边栏 session 选择（终端模式）

当前（≈line 2383）：

```tsx
onSelectSession={(sessionId) => {
  void selectPiSession(sessionId);
}}
```

改为：

```tsx
onSelectSession={(sessionId) => {
  if (panelMode === "terminal") {
    window.open(buildPiSessionUrl(sessionId, "terminal"), "_blank");
    return;
  }
  void selectPiSession(sessionId);
}}
```

### 2. Launcher 新建 session（终端模式）

`createPiSessionInProject` 中，在 `selectPiSession` 调用前做判断。因为新建 session 后需要有 `sessionId` 才能拼 URL，所以改为：

```tsx
async function createPiSessionInProject(projectPath: string) {
  // ... 现有代码创建 session 得到 body.projects ...

  const nextSessionId = getNewestProjectSessionId(body.projects, projectPath);
  closeLauncher();

  if (nextSessionId) {
    if (panelMode === "terminal") {
      window.open(buildPiSessionUrl(nextSessionId, "terminal"), "_blank");
      return;
    }
    await selectPiSession(nextSessionId, { projectPath });
  } else {
    clearSelectedPiSession();
  }
}
```

### 3. Launcher 选择已有 session（终端模式）

```tsx
async function openNewestSessionForProject(projectPath: string) {
  // ... 现有查找逻辑 ...

  closeLauncher();
  if (panelMode === "terminal") {
    window.open(buildPiSessionUrl(sessionId, "terminal"), "_blank");
    return;
  }
  await selectPiSession(sessionId, { projectPath });
}
```

## 不变的行为

- **对话模式下**一切不变：sidebat click、launcher 都走 inline `selectPiSession`
- **初始 hydration**（页面刷新恢复）不受影响，因为 `didHydrateSelectionRef` 走的是独立的初始化路径
- **Settings 页面**不受影响（settings 页不涉及 session 终端）
- **popstate 浏览器回退**不受影响——它只是复现 URL 状态
- 终端模式快捷键（`⌘'` / `⌘J`）切换 chat/terminal 模式不变

## Testing Strategy

| 测试项                                                  | 方式                     |
| ------------------------------------------------------- | ------------------------ |
| 对话模式下侧边栏点击仍走 inline selectPiSession         | 手动验证                 |
| 终端模式下侧边栏点击打开新标签页且 URL 正确             | 手动验证（浏览器会拦截） |
| 终端模式下 Launcher 新建 session 打开新标签页           | 手动验证                 |
| 终端模式下 Launcher 选择已有 session 打开新标签页       | 手动验证                 |
| 新标签页打开后按 URL 恢复到正确 session + terminal 模式 | 手动验证（opener 兼容）  |
| `pnpm run build` 通过                                   | CI                       |
| `pnpm run test` 通过                                    | CI                       |

> 注：`window.open` 在浏览器的弹窗拦截策略下，必须由用户手势触发（click/keydown）。目前的 sidebar click 和 launcher button click 都属于用户手势，不会被拦截。如果后期发现被拦截，可以改为 `window.open(..., '_blank')` 配合 EventListener 或 `<a target="_blank">` 代理。

## Boundaries

- **Always**
  - 终端模式下 session 切换一定开新标签页，不替换当前面板
  - `_blank` target，让浏览器开新标签页而不是新窗口
  - 新标签页的 URL 必须是完整的可恢复路由（`/sessions/:id?panel=terminal`）
  - 当前标签页的 terminal state 不变

- **Ask first**
  - 增加「在当前标签页切换」的选项（比如按住 Ctrl 点击）
  - 新标签页打开后关闭 launcher modal
  - 影响 popstate 或 hydration 行为

- **Never**
  - 不在终端模式下替换已有 session 的面板
  - 不在 chat 模式下使用 window.open

## Success Criteria

1. [ ] 对话模式下侧边栏点击 session → 现有 inline 行为不变
2. [ ] 终端模式下侧边栏点击 session → 新标签页打开 `/sessions/{sessionId}?panel=terminal`
3. [ ] 终端模式下 Launcher 新建 session → 新标签页打开新 session
4. [ ] 终端模式下 Launcher 选择已有 session → 新标签页打开该 session
5. [ ] 新标签页中 terminal 模式正常启动，显示正确的 cwd 和 session 上下文
6. [ ] 原标签页的终端 WebSocket 连接不断开，命令继续运行
7. [ ] `pnpm run build` 通过
8. [ ] `pnpm run test` 通过

## Open Questions

- 浏览器弹窗拦截：大部分用户在 pi-workspace 场景下不会禁用弹窗，如果有拦截，当前的 session 选择不会生效（因为被拦截后没有任何效果）。**当前方案**使用 `_blank` 而非 `_blank` 已有的标准处理，以兼容多数浏览器默认策略。
- 新标签页中的 terminal 是否需要 `initialCommand`（`pi --session {sessionId}`）？当前 TerminalPanel 已经支持 `initialCommand` prop，在新标签页中 `hydrateSelection` 会从 URL 读取 sessionId 并加载，所以不需要额外传 initialCommand。
- 是否需要 close launcher？**是**，在终端模式下打开新标签页后，应该关掉 launcher modal 避免混淆。
