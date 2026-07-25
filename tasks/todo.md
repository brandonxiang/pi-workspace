# Tasks: Settings — Skills Tab

- [x] **Task 1: 增强 `/api/skills` 接口返回 scope 信息**
  - Acceptance: 响应中的每个 skill 包含 `scope`, `origin`, `baseDir`, `path` 字段
  - Files: `server/index.ts`, `server/pi-skills.ts`, `server/__tests__/pi-skills.test.ts`
  - Tests: `pnpm test -- server/__tests__/pi-skills.test.ts` → 3 tests passed

- [x] **Task 2: 添加 `SkillItem` 类型和获取接口函数**
  - Acceptance: `client/types.ts` 新增 `SkillItem` 类型；App.tsx 从 `/api/skills` 获取数据
  - Files: `client/types.ts`, `client/App.tsx`

- [x] **Task 3: 添加 i18n 翻译 key**
  - Acceptance: en 和 zh-CN 都包含 Skills tab 相关的翻译
  - Files: `client/i18n.ts`

- [x] **Task 4: 在 Settings 页面新增 Skills tab**
  - Acceptance: Tabs 中新增 key="skills" 的 tab，位于 "Plugins" 之后；只显示 scope=user 的 skill
  - Files: `client/App.tsx`

- [x] **Task 5: 添加 Skills tab 样式**
  - Acceptance: 技能卡片清晰可读，scope badge、来源路径、来源类型展示完整
  - Files: `client/styles.css`

- [x] **Task 6: 验证**
  - Acceptance: `pnpm run typecheck` + `pnpm run build` 通过
  - Verify: typecheck ✅, build ✅
