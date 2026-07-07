# Spec: 设置页从弹窗改为路由页面

## Assumptions

1. 这是一次前端交互重构，不涉及服务端 API 变更。
2. 设置页将复用现有浏览器 history 路由机制，而不是引入新的路由库。
3. “左上角返回键回到首页”表示点击设置页左上角返回按钮后进入应用首页 `/`，而不是返回浏览器上一页历史。
4. 当前设置项的保存语义保持不变：用户编辑草稿，点击保存后才真正写入状态与 localStorage；点击返回或取消则放弃未保存改动。
5. 现有 `/settings` 之外的路由行为需要保持不变，尤其是 `/sessions/:id` 和 `?panel=` 参数支持。

## Objective

将当前通过 `Modal` 打开的设置界面改为独立的路由页面，让用户从侧边栏设置按钮或 `/settings` 进入设置页，并能通过页面左上角返回按钮回到首页。这样可以让设置拥有稳定 URL、更自然的导航体验，并避免弹窗遮挡主界面。

## Tech Stack

- React
- TypeScript
- Vite
- Ant Design (`Select`, `Tabs`)
- 浏览器原生 History API

## Commands

```bash
pnpm run test
pnpm run typecheck
pnpm run build
pnpm run dev
```

## Project Structure

```text
client/App.tsx              -> 应用主入口与页面状态编排
client/app-routing.ts       -> 路由解析与 URL 构造
client/app-routing.test.ts  -> 路由工具测试
client/styles.css           -> 页面与设置 UI 样式
client/i18n.ts              -> 设置页文案与可访问文本
client/App.test.tsx         -> 首页入口、设置入口、保存/返回行为测试
tasks/settings-route-page-spec.md -> 本次需求规格
```

## Code Style

```tsx
function openSettingsPage() {
  setSettingsDraft(readSettingsDraftFromState());
  window.history.pushState({}, "", buildSettingsUrl());
  setCurrentRoute({ kind: "settings", panel: panelMode });
}

function handleSettingsBack() {
  resetSettingsDraft();
  window.history.pushState({}, "", buildHomeUrl(panelMode));
  setCurrentRoute({ kind: "home", panel: panelMode });
}
```

约定：

- 继续沿用现有 `app-routing.ts` 的纯函数式路由解析/构造方式。
- 不引入新的全局状态库；设置页状态继续由 `App.tsx` 持有并向子视图传递。
- 新 UI 尽量复用现有设置表单结构与文案，避免同时改动业务逻辑与配置语义。

## Testing Strategy

- 单元测试：
  - 在 `client/app-routing.test.ts` 覆盖 `/settings` 路由解析与 URL 构造。
- 组件测试：
  - 在 `client/App.test.tsx` 验证点击设置按钮后进入设置路由页面。
  - 验证左上角返回按钮会跳转回首页。
  - 验证保存后设置生效并离开设置页。
  - 验证未保存时返回不会提交草稿。
- 手动验证：
  - 运行 `pnpm run dev`，在浏览器中确认首页 -> 设置页 -> 返回首页流程正常。
  - 验证浏览器前进/后退与应用内部路由状态保持同步。

## Boundaries

- Always:
  - 保持现有设置项字段、文案 key 和保存逻辑一致。
  - 保持 `/sessions/:id` 与 `?panel=` 路由能力正常工作。
  - 设置页可通过 URL 直接访问，并正确渲染当前已保存配置。
- Ask first:
  - 新增第三方路由库。
  - 改动设置项本身的信息架构或新增设置字段。
  - 调整设置保存语义为“即时保存”。
- Never:
  - 不因为设置页改造而暴露服务端密钥或改变 API 鉴权行为。
  - 不删除现有测试而不补等价覆盖。
  - 不在没有明确需求的情况下改变会话页或终端页主流程。

## Success Criteria

1. 应用存在独立设置页路由，例如 `/settings`，且可直接访问。
2. 点击侧边栏设置按钮后，不再打开弹窗，而是进入设置页。
3. 设置页展示现有的设置表单内容，至少覆盖当前的 General / Model 两个标签页及保存逻辑。
4. 设置页左上角有明确返回按钮，点击后回到首页 `/`。
5. 点击保存后，设置值按现有行为生效，并离开设置页返回首页。
6. 点击返回按钮或取消操作时，不会提交未保存的草稿修改。
7. 浏览器前进/后退可正确在首页、会话页、设置页之间同步视图状态。
8. 现有会话页与终端面板路由行为不回归。

## Open Questions

- 设置页 URL 是否需要保留当前 `panel` 查询参数。当前倾向：保留 `?panel=`，以延续已有路由状态模型。
- 从会话页进入设置后，返回按钮是否也应一律回首页。当前按假设执行：一律回首页。
