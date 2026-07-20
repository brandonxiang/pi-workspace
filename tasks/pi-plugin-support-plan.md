# Implementation Plan: Pi 插件支持

## Overview

为浏览器端 Pi Agent Desktop 接入 Pi package 能力：设置页展示全局和项目级插件并支持刷新，输入框按当前激活的 Pi session 提供插件 slash 命令。第一版只读，不安装、移除或更新插件。

## Architecture Decisions

- 使用 `@earendil-works/pi-coding-agent` 的 `SettingsManager`、`DefaultPackageManager` 和 `DefaultResourceLoader` 作为插件元数据与资源的唯一来源。
- 插件概览通过 `/api/pi-plugins` 读取全局与当前工作目录配置；当前 session 的命令通过 `/api/pi-sessions/:sessionId/commands` 按 session cwd 加载。
- 普通设置页使用“Plugins”概念，详情中显示 Pi package 的来源、作用域、资源统计和诊断。
- 第一版只允许 Reload；不写入 settings，不自动安装缺失项目依赖。
- 保留现有 `/api/chat` 流式链路，插件命令作为普通 prompt 发送给当前 Pi session。

## Task List

### Phase 1: Backend foundation

- [ ] 补齐插件列表、资源统计、缺失包和诊断测试。
- [ ] 补齐全局/项目 scope、session cwd 和刷新路由测试。
- [ ] 修正资源与 package 的去重、来源和临时 package 边界。

### Checkpoint: Backend

- [ ] 插件相关测试通过。
- [ ] 缺失包展示但不触发安装。

### Phase 2: Composer integration

- [ ] 为当前 session 加载插件命令。
- [ ] slash 建议保持 app 命令优先，并展示插件来源标签。
- [ ] 切换 session 时清理旧命令并重新加载。

### Phase 3: Settings UI

- [ ] 增加 Plugins 设置页，展示 scope、source、状态、资源统计和诊断。
- [ ] 增加 Reload 操作与空态、错误态。
- [ ] 普通界面不暴露安装、移除、更新操作。

### Checkpoint: Complete

- [ ] 测试和类型检查通过。
- [ ] `npm run build` 通过。
- [ ] dev server 中验证设置页和 session slash 建议。

## Risks and Mitigations

| Risk                              | Impact | Mitigation                                            |
| --------------------------------- | ------ | ----------------------------------------------------- |
| 项目插件会执行本地代码            | High   | 首版只读展示，并明确提示来源；不自动安装或执行新包    |
| 切换 session 后命令串台           | High   | 以 active session id 为请求边界，切换时清空旧命令     |
| SDK 资源诊断与 package 来源不一致 | Medium | 优先使用 SDK `SourceInfo`，路径仅作为兜底关联         |
| 全局和项目配置重复                | Medium | 使用 SDK 已解析资源和来源信息，前端按稳定 source 展示 |

## Open Questions

- None. Scope and interaction decisions are recorded in `tasks/pi-plugin-support-spec.md`.
