# Spec: 设置页中的 Archived Chat 管理

## Assumptions

1. 这是一个浏览器端 UI/状态管理改动，不涉及服务端 API 或数据库结构变更。
2. “archived chat” 指的是当前首页 sidebar 中展示、且已经支持 archive/restore 的 **Pi session 对话**，不是未落地到当前 UI 的 `ChatSession.archived` 数据。
3. 设置页中的 archived chat 应展示所有已归档的 Pi session，不再在首页 sidebar 中显示这些已归档项。
4. 恢复动作发生在设置页内，恢复后该会话重新回到首页 sidebar 的常规列表中。
5. 当前的归档状态继续存储在本地 `localStorage`（`my-pi-archived-pi-sessions`），不会新增远端持久化。
6. 现有设置页的保存语义只作用于 General / Model 配置；Archived Chat 区域中的恢复操作应即时生效，不需要点击设置页的 Save。

## Objective

在设置页面新增一个独立的第三个 `Archived Chat` tab，让用户可以查看所有已归档的对话，并在该页面中恢复它们。同时，首页不再展示已归档的对话，避免 sidebar 混入“已隐藏但仍占位”的会话条目，使归档真正成为“从首页收起、在设置里集中管理”的体验。

## Tech Stack

- React
- TypeScript
- Vite
- Ant Design (`Tabs`, `Select`)
- 浏览器原生 History API
- `localStorage` 本地持久化

## Commands

```bash
pnpm run test
pnpm run typecheck
pnpm run build
pnpm run dev
```

## Project Structure

```text
client/App.tsx                    -> 设置页主视图、第三个 Archived Chat tab、归档状态、恢复行为、首页/设置页编排
client/PiSessionSection.tsx       -> 首页 sidebar 会话列表过滤与项目分组展示
client/App.test.tsx               -> 设置页 archived chat 流程、首页隐藏逻辑测试
client/styles.css                 -> Archived Chat 区域样式
client/i18n.ts                    -> “Archived Chat”“Restore”“Empty state”等文案
tasks/settings-archived-chat-spec.md -> 本次需求规格
```

## Code Style

```tsx
const archivedProjects = projects
  .map((project) => ({
    ...project,
    sessions: project.sessions.filter((session) => archivedPiSessionIds.has(session.id)),
  }))
  .filter((project) => project.sessions.length > 0);

const visibleProjects = projects
  .map((project) => ({
    ...project,
    sessions: project.sessions.filter((session) => !archivedPiSessionIds.has(session.id)),
  }))
  .filter((project) => project.sessions.length > 0);
```

约定：

- 继续复用现有 `projects` + `archivedPiSessionIds` 数据源，不引入新的远端查询层。
- 首页和设置页分别基于同一份项目数据做“已归档 / 未归档”派生，而不是复制状态。
- 恢复操作沿用现有 `restorePiSession(sessionId)`，避免产生第二套归档逻辑。

## Testing Strategy

- 组件测试：
  - 验证首页 sidebar 不再渲染已归档的 Pi session。
  - 验证设置页第三个 `Archived Chat` tab 能展示已归档会话列表。
  - 验证点击恢复后，会话从设置页 archived 列表消失，并重新出现在首页 sidebar。
  - 验证没有已归档会话时，设置页显示空状态。
- 回归测试：
  - 保持设置页独立页面特性不回退。
  - 保持首页普通会话选择、终端路由、设置保存流程不回归。
- 手动验证：
  - `pnpm run dev` 后在浏览器中执行：首页归档一个会话 -> 设置页查看 Archived Chat -> 点击恢复 -> 回首页确认重新出现。

## Boundaries

- Always:
  - 首页 sidebar 只展示未归档的 Pi session。
  - 设置页第三个 `Archived Chat` tab 展示所有已归档 Pi session，且只支持恢复。
  - 归档/恢复状态继续与 `localStorage` 同步。
- Ask first:
  - 把 Archived Chat 独立成新路由而不是设置页中的一个区域/标签。
  - 增加“永久删除”“批量恢复”“搜索 archived chat”等新能力。
  - 把归档状态改成服务端持久化。
- Never:
  - 不在没有明确需求的情况下修改会话详情接口或新增后端归档 API。
  - 不让已归档会话继续在首页以“灰显但可见”的形式出现。
  - 不把恢复动作绑定到设置页 Save 按钮，导致操作不透明。

## Success Criteria

1. 首页 sidebar 中，已归档的 Pi session 不再显示。
2. 设置页存在一个清晰可见的第三个 `Archived Chat` tab。
3. 该区域会列出所有已归档 Pi session，并保留足够的信息让用户识别它们（如会话名/首条消息、项目名、时间等）。
4. 每个 archived chat 都有明确的恢复操作，且不支持在该 tab 中直接打开会话。
5. 点击恢复后，该会话立即从设置页 archived 列表移除。
6. 恢复后的会话回到首页 sidebar 的正常可见列表中。
7. 当没有 archived chat 时，设置页显示空状态而不是空白区域。
8. 现有设置页路由、返回首页行为、保存设置行为不回归。

## Open Questions

- 无。用户已确认 `Archived Chat` 作为设置页第三个独立 tab，且本次只支持恢复，不支持直接打开。
