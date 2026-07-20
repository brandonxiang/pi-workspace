# Spec：Pi 插件支持

## 假设

1. 产品界面里的「插件」对应 `@earendil-works/pi-coding-agent` 里的 Pi package。
2. 已安装插件可能来自用户全局设置、项目设置、npm、git 或本地路径。
3. 插件提供的斜杠命令包括 Pi 扩展命令、prompt 模板命令和技能命令。
4. 插件管理不能破坏现有 `/api/chat` 的流式响应。
5. 第一版只展示和刷新插件，不提供安装、更新或移除能力。
6. 插件设置读取同时支持全局 `~/.pi/agent/settings.json` 和项目 `.pi/settings.json`。
7. 插件命令按当前激活的 Pi session 加载，而不是应用启动时全局加载。
8. 启用项目本地插件属于敏感行为，因为 Pi package 可以执行任意本地代码。
9. 本 spec 先覆盖插件发现和用户可见控制，插件市场浏览属于可选能力，不纳入第一阶段。

## 目标

为 Pi Agent Desktop 增加一等的 Pi 插件支持，让开发者能查看已安装的 Pi package，理解它们贡献了哪些资源和斜杠命令，并能在聊天输入框里调用插件提供的命令。

主要用户：

- 把 Pi Agent Desktop 当作本地 Pi session 增强界面的开发者。
- 通过 `.pi/settings.json` 共享项目级 Pi package 的团队。
- 依赖 Pi 扩展命令、prompt 模板和技能的高级用户。

验收目标：

- 设置页面能显示所有已配置的 Pi 插件，包括作用域、来源、状态和贡献的资源。
- 聊天输入框的斜杠菜单能显示插件提供的命令，并和应用本地命令分组展示。
- 对于可调用的插件命令，未知斜杠命令继续透传给 Pi。
- 第一版只支持查看和刷新插件；安装、更新、移除留到后续受保护流程。
- 涉及项目信任的插件加载必须显式确认，不能静默信任项目本地代码。

## 技术栈

- `client/` 使用 React 19 和 TypeScript 7。
- `server/` 使用 Fastify 5。
- `shared/slash-commands.ts` 存放共享斜杠命令辅助逻辑。
- Pi SDK 使用 `@earendil-works/pi-coding-agent@0.80.6`。
- 复用现有 UI 基础组件：Ant Design `Tabs`、`Select` 和现有设置卡片样式。

## 命令

- 安装依赖：`pnpm install`
- 开发模式：`pnpm run dev`
- 测试：`pnpm run test`
- 类型检查：`pnpm run typecheck`
- Lint：`pnpm run lint`
- 格式检查：`pnpm run format:check`
- 构建：`npm run build`
- Vite+ 检查：`vp check`
- Vite+ 测试：`vp test`

## 项目结构

- `client/App.tsx`：设置页标签、输入框斜杠建议、插件 UI 状态。
- `client/types.ts`：插件列表和插件命令的客户端响应类型。
- `client/i18n.ts`：插件设置、命令徽标、警告信息的中英文文案。
- `client/styles.css`：插件列表、状态徽标、命令分组、空状态和错误状态样式。
- `shared/slash-commands.ts`：应用命令注册表和插件命令匹配辅助逻辑。
- `server/index.ts`：新增插件和命令 API 路由。
- `server/__tests__/` 或相邻的 `server/*.test.ts`：服务端 API 行为测试，遵循现有仓库约定。
- 当前没有使用 `client/__tests__/`，除非项目后续重组，否则客户端测试继续放在相邻的 `client/*.test.ts`。
- `tasks/pi-plugin-support-spec.md`：当前这份持续更新的 spec。

## 代码风格

服务端和客户端边界使用明确的类型化 DTO，并把 Pi SDK 术语和 UI 标签分开：

```ts
export interface PiPluginSummary {
  source: string;
  scope: "user" | "project" | "temporary";
  status: "installed" | "missing" | "error";
  filtered: boolean;
  installedPath?: string;
  resources: {
    extensions: number;
    skills: number;
    prompts: number;
    themes: number;
  };
}
```

约定：

- 面向用户的 UI 文案优先使用 `plugin`，只有引用 Pi SDK 概念时才使用 `package`。
- 服务端 DTO 必须可序列化且稳定，不直接暴露原始 SDK 对象。
- 当 Pi 提供 `sourceInfo` 或 `PathMetadata` 时，不要从路径反推归属。
- 插件命令匹配顺序保持确定：应用命令优先，然后是扩展命令、prompt 命令、技能命令。
- 除非需要解释不明显的安全边界或 SDK 边界，否则不要添加行内注释。

## 功能需求

### 设置页插件标签

在现有设置页面中新增 `Plugins` 标签。

必须显示：

- 来自全局设置和项目设置的所有已配置 Pi package。
- 作用域徽标：`User`、`Project` 或 `Temporary`。
- 来源类型：`npm`、`git` 或 `local path`。
- 可用时显示安装路径。
- 当 package 配置了资源过滤时，显示过滤状态。
- 扩展、技能、prompt 和主题的资源数量。
- 缺失 package、加载错误、重复资源、项目信任阻塞等诊断信息。
- 没有配置插件时显示空状态。

建议操作：

- `Reload`：刷新 package 和资源，不重启应用。
- `Reveal`：可用时打开本地安装路径。

第一版不提供：

- `Update`：更新 npm 或 git package。
- `Remove`：移除用户或项目配置的 package。
- `Install`：通过来源字符串安装。

安全边界：

- 明确提示 Pi 插件可以执行本地代码。
- 加载或修改项目本地插件设置前必须显式确认项目信任。
- 未经确认，网页 UI 绝不能自动安装缺失的项目 package。

### 插件斜杠命令

输入框斜杠菜单必须把插件提供的命令和现有应用命令、已加载技能一起展示。

命令来源：

- `app`：现有本地命令，例如 `/settings`、`/copy`、`/compact`。
- `extension`：Pi 扩展注册的命令。
- `prompt`：prompt 模板命令。
- `skill`：技能调用命令，包括 Pi 返回的 `skill:*` 名称。

行为：

- 输入 `/` 时先显示应用命令，然后显示插件命令分组。
- 输入 `/dep` 时在所有命令分组里做模糊过滤。
- 选择插件命令后插入 `/<commandName>`。
- 提交插件斜杠命令时，通过普通 prompt 路径发送给当前激活的 Pi session。
- 插件命令列表跟随当前激活的 Pi session 变化；切换 session 后重新加载命令。
- 如果没有激活的 Pi session，插件命令置灰，并提示「先选择或创建一个 Pi session」。
- 现有应用本地命令继续在本地执行，不能发送给 Pi。
- 不能通过 SDK 调用的 Pi 内置 TUI 命令，例如仅交互模式可用的 `/settings`，不得作为插件命令展示。

### 插件详情

点击插件行后，应展示详情面板或可展开行，包含：

- 原始来源字符串。
- 生效作用域，以及它是否覆盖了全局 package。
- 按类型分组的已加载资源。
- 插件贡献的命令，以 Pi 的 `sourceInfo` 作为权威来源信息。
- 带文件路径和可读说明的加载诊断。
- 针对 package 缺失、信任问题或更新问题的修复建议。

### 更新感知

设置页插件标签后续应展示更新状态：

- `Up to date`
- `Update available`
- `Pinned`
- `Unknown`
- `Check failed`

为了避免设置页加载变慢，第一版可以只提供手动更新检查。

### 命令可观测性

插件斜杠命令运行时：

- 本地对话记录应正常显示用户提交的命令。
- 工具、扩展或 prompt 产生的效果应通过现有 `/api/chat` 事件流展示。
- 错误信息应区分失败来源：命令查找、插件加载或 Pi 执行。

## API 设计

新增服务端路由：

- `GET /api/pi-plugins`
  - 返回已配置插件、解析后的资源数量、诊断信息和可用插件命令。
  - 使用 `SettingsManager.create(process.cwd(), getAgentDir())`。
  - 使用 `DefaultPackageManager.listConfiguredPackages()` 和类似 `resolve("skip")` 的行为，这样缺失 package 会被展示出来，而不是自动安装。

- `POST /api/pi-plugins/reload`
  - 清理插件和资源缓存，并重新加载设置和资源。
  - 不执行安装或移除。

- `GET /api/pi-sessions/:sessionId/commands`
  - 返回当前激活 session 中可用的 Pi 命令。
  - 优先使用当前 session 或运行时提供的 SDK 命令访问能力。
  - 作为兜底，可以为该 session 的 cwd 创建资源加载器，并在不执行命令的前提下推导扩展、prompt 和技能命令。
  - session 切换时由客户端重新请求，避免展示非当前项目的插件命令。

响应草图：

```ts
export interface PiPluginsResponse {
  plugins: PiPluginSummary[];
  commands: PiPluginCommand[];
  diagnostics: PiPluginDiagnostic[];
}

export interface PiPluginCommand {
  name: string;
  description?: string;
  source: "extension" | "prompt" | "skill";
  scope: "user" | "project" | "temporary";
  origin: "package" | "top-level";
  path?: string;
  packageSource?: string;
}
```

## 测试策略

服务端测试：

- 能列出全局设置和项目设置中的已配置 package。
- 缺失 package 会展示出来，不会被自动安装。
- 能解析模拟 package 的资源数量。
- 保留项目 package 覆盖全局 package 的去重行为。
- 返回带稳定来源元数据的插件命令。

客户端测试：

- 插件设置标签能渲染加载、空、已填充和诊断状态。
- 斜杠建议中，应用命令排在插件命令之前。
- 选择插件命令后插入正确的斜杠命令。
- 切换 Pi session 后重新加载并替换插件命令列表。
- 没有激活 Pi session 时，插件命令处于禁用状态。
- 本地应用命令仍然在本地执行。

共享辅助逻辑测试：

- 插件命令匹配器能处理 `skill:*`、带连字符的名称和模糊前缀。
- 自动补全保持对现有应用命令和技能行为的兼容。

手动验证：

- 启动 `pnpm run dev`。
- 安装或配置一个本地测试 Pi package。
- 打开 `/settings?panel=chat`，确认插件出现。
- 在激活的 Pi session 中输入 `/`，确认插件命令出现。
- 运行一个安全的插件 prompt 命令，确认流式响应仍然正常。

## 边界

- 始终：
  - provider API key 和 Pi 授权信息只保存在服务端。
  - 以 Pi SDK 和资源元数据作为事实来源。
  - 保留 `/api/chat` 的流式增量响应。
  - 修改插件状态前显示安全警告。
  - 应用本地斜杠命令保持确定性，并只在本地执行。

- 先询问：
  - 增加公开插件市场或远程搜索。
  - 自动安装项目插件依赖。
  - 修改 Pi 信任策略默认值。
  - 添加新的 npm 依赖。
  - 从网页 UI 写入全局 `~/.pi/agent/settings.json` 或项目 `.pi/settings.json`。

- 绝不：
  - 在第一版执行插件安装、更新或移除。
  - 在 SDK 已提供元数据时，通过路径推断插件归属。
  - 把仅交互模式可用的 Pi TUI 命令当作可通过 SDK 调用的命令发送。
  - 为了这个功能给默认在线 session 启用 shell 或文件修改工具。
  - 把本地授权 token 或 provider key 暴露给前端。

## 成功标准

- 设置页有 `Plugins` 标签，能列出用户作用域和项目作用域里的所有已配置 Pi 插件。
- 每个插件行清楚展示来源、作用域、已安装 / 缺失 / 错误状态和资源数量。
- 插件诊断信息可见，并能指导下一步处理。
- 输入框斜杠建议包含带来源徽标的插件命令。
- 应用本地斜杠命令行为和之前完全一致。
- 插件斜杠命令通过激活的 Pi session 执行，并保留流式 UI。
- 切换 Pi session 后，斜杠菜单使用新 session 的插件命令。
- 临时 `pi -e` package 只在对应 CLI 启动的 session 中展示，不作为全局插件展示。
- 高级视图或详情中可以暴露「Pi Packages」术语，普通 UI 仍优先使用「Plugins」。
- 第一版不暴露安装、更新或移除入口。
- 交付前 `npm run build` 通过。

## 建议补充的特殊功能

1. **命令来源徽标**：在斜杠建议里显示 `extension`、`prompt` 或 `skill` 徽标，让用户知道即将运行的是什么。
2. **插件健康面板**：在设置页顶部汇总缺失 package、加载错误、被禁用的过滤项和信任阻塞。
3. **安全模式开关**：调试问题插件时，可以临时隐藏插件命令，并跳过当前 session 的扩展加载。
4. **按项目查看插件**：按当前选中的 Pi session 项目过滤设置页，展示生效的用户插件和项目插件。
5. **安装预览**：后续支持安装时，复用现有版本更新管理员流程，解析来源字符串，先展示来源类型、目标作用域和风险提示，再执行修改。
6. **命令搜索别名**：允许按命令描述搜索，而不仅按命令名搜索。
7. **按需检查更新**：避免启动变慢，但提供手动「检查插件更新」操作。
8. **编辑后重载**：用户在外部编辑插件文件后，可以在设置页刷新命令，不需要重启应用。
9. **诊断复制按钮**：一键复制插件诊断，方便提交 bug 报告。
10. **首次使用说明**：解释 Pi 插件是强大的本地代码能力，不是浏览器扩展。

## 已确认决策

1. 第一版只展示和刷新插件，不做安装、移除或更新。
2. 插件设置读取支持全局 `~/.pi/agent/settings.json` 和项目 `.pi/settings.json`。
3. 插件命令按当前激活的 Pi session 加载，切换 session 后重新加载。
4. 临时 `pi -e` package 只在它生效的 CLI session 中展示。
5. 普通 UI 使用「Plugins」，高级视图或详情中可以暴露「Pi Packages」。
6. 后续受保护插件操作复用现有版本更新管理员流程。

## 待确认问题

暂无。
