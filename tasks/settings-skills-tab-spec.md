# Spec: Settings — Skills Tab

## Objective

在 Setting 页面增加一个 "Skills" tab，列出当前所有 global（user scope）级别的 skill，展示名称、描述、来源路径、来源类型（top-level/package）等信息，方便用户一目了然地查看已安装的技能。

## Resolution

- **Q1:** 只显示 global (user scope) 的 skill
- **Q2:** 不需要分组
- **Q3:** 需要 Refresh 按钮（类似 plugins tab）

## Tech Stack

- Frontend: React + TypeScript + Ant Design X (Tabs, Tag, etc.)
- Backend: Fastify + Node.js
- i18n: 内置 en/zh-CN 翻译
- SDK: `@earendil-works/pi-coding-agent`（提供 `loadSkills`、`Skill` 类型）

## Commands

```bash
pnpm run dev       # Dev server
pnpm run build     # Build client + server
pnpm run test      # Run tests
pnpm run typecheck # Type check
```

## Project Structure

```
client/
  App.tsx          ← settings page Tabs 需要新增一个 tab
  i18n.ts          ← 新增中英文翻译 key
  types.ts         ← 新增 SkillItem 类型
  styles.css       ← 新增 Skills tab 样式
server/
  index.ts         ← /api/skills 接口需要增强返回 scope
```

## Code Style

- 遵循现有 settings tab 风格：`.settings-tab-content` + `.field` 或 `.settings-plugins-tab` 类似卡片列表
- i18n key 命名：`settings.tabSkills`、`settings.skillsTitle`、`settings.skillsHelp` 等
- 技能列表使用 article 卡片布局，展示 name（badge）、description、sourceInfo（scope + origin）

## Testing Strategy

- 单测验证 API 返回的 skill 数据包含 scope 字段

## Boundaries

- Always: 遵循现有 Tabs + i18n 模式；服务端保持 skills cache
- Never: 不在前端暴露 API key；不修改现有多语言 key 名

## Success Criteria

1. [ ] 后端 `/api/skills` 返回每个 skill 的 `scope`, `origin`, `baseDir`（来自 `sourceInfo`）
2. [ ] Setting 页面新增 "Skills" tab，位于 "Plugins" 之后
3. [ ] Skills tab 显示所有 user scope 技能的卡片列表：名称、描述、scope badge、来源路径、来源类型
4. [ ] 只显示 scope=user 的 skill（不显示 project scope）
5. [ ] 有 Refresh 按钮可以刷新技能列表
6. [ ] 中英文翻译完整
7. [ ] `pnpm run build` 通过，`pnpm run typecheck` 通过
