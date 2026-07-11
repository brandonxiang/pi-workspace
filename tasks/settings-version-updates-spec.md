# Spec: Settings 版本检查与升级

## Assumptions

1. “Pi 版本”指当前 `PATH` 中全局 `pi` CLI 的版本，不是 pi-workspace 内部安装的 `@earendil-works/pi-coding-agent` SDK 依赖版本。
2. 在 Settings 页面新增独立的“版本”标签页，不把版本信息混入现有“通用”或“模型”设置。
3. 进入“版本”标签页时自动检查 Pi 与 pi-workspace 的当前版本和最新版本；用户也可以手动重新检查。
4. “升级 Pi”调用 Pi CLI 自带的默认自升级命令 `pi update`，等价于只升级 Pi 本体，不升级扩展。
5. “升级 pi-workspace”调用现有 `pi-workspace update` 命令，保留 CLI 已实现的默认升级行为：全局安装时升级全局包，源码开发副本中按现有逻辑拉取、安装依赖并构建。
6. 升级是有副作用的本地操作，执行前必须二次确认；同一时间只允许执行一个升级任务。
7. pi-workspace 升级完成后不由当前 HTTP 请求强制重启服务。页面明确提示用户重启 pi-workspace，避免更新过程主动终止承载请求的服务。
8. 服务目前仅监听 `127.0.0.1`；本功能沿用这一边界，不扩大到远程访问场景。

## Objective

为 Workspace Operator 在 Settings 页面提供集中式版本管理能力，使其无需离开 Pi Agent Desktop 即可：

- 查看全局 Pi CLI 的当前版本与最新版本。
- 查看当前 pi-workspace 的当前版本与最新版本。
- 判断每个组件是否已是最新版或存在可用升级。
- 通过明确的“升级 Pi”和“升级 pi-workspace”按钮触发各自 CLI 已有的升级流程。
- 看见检查失败、升级失败、升级成功以及需要重启等可操作反馈。

## Tech Stack

- React + TypeScript
- Fastify 服务端 API
- Ant Design Tabs / Modal 或现有等价确认交互
- Node.js `child_process.spawn`，使用固定命令及固定参数，不接收客户端命令文本
- Vitest

## Commands

```bash
pnpm run test
pnpm run typecheck
npm run build
pnpm run dev
```

手动验证所涉及的只读命令：

```bash
pi --version
pi-workspace --version
```

升级按钮对应的命令语义：

```bash
pi update
pi-workspace update
```

## Project Structure

```text
client/App.tsx                         -> 版本标签页、请求状态、确认与结果反馈
client/i18n.ts                        -> 中英文版本管理文案
client/styles.css                     -> 版本行、状态和按钮样式
client/App.test.tsx                   -> Settings 版本标签页交互测试
server/index.ts                       -> 版本信息与升级 API 路由装配
server/version-management.ts          -> 固定命令执行、版本解析与升级编排
server/version-management.test.ts     -> 服务端版本管理单元测试
bin/pi-workspace.mjs                  -> 现有 pi-workspace check/update 语义来源
tasks/settings-version-updates-spec.md -> 本功能规格
```

实现时可以根据现有模块边界调整服务端文件名，但版本检查与进程执行逻辑不应继续堆入 UI 组件。

## API Contract

### `GET /api/versions`

返回两个独立组件的检查结果。单个组件检查失败时，另一个组件仍可正常展示，不将部分失败折叠成整个请求失败。

```ts
type VersionStatus = {
  currentVersion: string | null;
  latestVersion: string | null;
  updateAvailable: boolean | null;
  error?: string;
};

type VersionsResponse = {
  pi: VersionStatus;
  piWorkspace: VersionStatus;
  actionToken: string;
};
```

`actionToken` 是服务启动时生成的本机操作 capability。升级请求必须通过
`x-pi-workspace-action-token` header 原样回传；缺失或不匹配时返回 `403`，且不得启动子进程。

### `POST /api/versions/:target/upgrade`

- `target` 只允许 `pi` 或 `pi-workspace`。
- 请求体不接受命令、参数、路径或包名。
- `pi` 在服务端映射到固定命令 `pi update`。
- `pi-workspace` 在服务端映射到固定命令 `pi-workspace update`。
- 成功响应包含升级目标、完成状态、升级后的版本信息以及是否需要重启。
- 命令失败、命令不存在、权限不足或网络失败时返回非 2xx 状态和经过整理的错误消息。
- 第一版等待升级命令完成后返回结果，不实现实时日志流；命令输出必须设置合理大小上限，避免无限积累。

```ts
type UpgradeResponse = {
  target: "pi" | "pi-workspace";
  ok: true;
  currentVersion: string | null;
  restartRequired: boolean;
  message: string;
};
```

## Code Style

```ts
const upgradeCommands = {
  pi: { command: "pi", args: ["update"], restartRequired: false },
  "pi-workspace": {
    command: "pi-workspace",
    args: ["update"],
    restartRequired: true
  }
} as const;

export async function upgradeTarget(target: UpgradeTarget) {
  const definition = upgradeCommands[target];
  const result = await runFixedCommand(definition.command, definition.args);

  return {
    target,
    ok: true as const,
    restartRequired: definition.restartRequired,
    message: result.summary
  };
}
```

约定：

- API 和领域类型使用 `piWorkspace` / `"pi-workspace"`，UI 文案显示 `pi-workspace`。
- 使用参数数组调用子进程，不拼接 shell 字符串。
- 版本比较使用独立纯函数，并覆盖常规语义化版本与前导 `v`。
- 错误消息面向用户说明失败原因，但不返回环境变量、完整进程环境或敏感路径。
- 新增文案必须同时提供英文和简体中文。

## User Experience

“版本”标签页包含两行或两张信息卡：

1. **Pi CLI**
   - 当前版本
   - 最新版本
   - “已是最新版”、“有新版本”或“检查失败”状态
   - “升级 Pi”按钮
2. **pi-workspace**
   - 当前版本
   - 最新版本
   - “已是最新版”、“有新版本”或“检查失败”状态
   - “升级 pi-workspace”按钮

交互规则：

- 首次进入标签页显示检查中状态，不能以空字符串伪装成未知版本。
- 提供“重新检查”操作。
- 没有新版本时升级按钮禁用。
- 检查失败时保留可用的当前版本，并允许重新检查；无法确认最新版本时升级按钮默认禁用。
- 点击升级按钮先显示目标明确的确认框，确认后才调用升级 API。
- 升级执行期间两个升级按钮均禁用，防止并行修改全局安装或当前源码树。
- Pi 升级成功后自动重新检查 Pi 版本。
- pi-workspace 升级成功后显示“升级完成，请重启 pi-workspace 以使用新版本”，不自动关闭或重启服务。
- 升级失败时显示可读错误，并允许重试。
- 版本操作与 Settings 页底部“保存/取消”无关；升级不依赖保存设置草稿，也不会自动提交其他设置改动。

## Testing Strategy

### 服务端单元测试

- 解析 `pi --version` 和 `pi-workspace --version` 输出，包括前导 `v` 与换行。
- 正确比较当前版本和最新版本。
- 验证目标到固定命令的映射：Pi 只能执行 `pi update`，pi-workspace 只能执行 `pi-workspace update`。
- 验证未知目标被拒绝。
- 验证命令不存在、非零退出、超时或输出超限时返回稳定错误。
- 验证部分版本检查失败不会丢失另一组件的成功结果。
- 子进程执行在测试中使用注入的 runner，不运行真实升级命令。

### 前端组件测试

- Settings 页面显示“版本”标签页。
- 切换到标签页后展示两个组件的当前版本与最新版本。
- 检查中、最新版、可升级、检查失败状态均正确渲染。
- 只有存在新版本时升级按钮可用。
- 点击升级按钮需要确认，取消确认不会发送升级请求。
- 升级中禁止重复提交。
- Pi 升级成功后刷新显示版本。
- pi-workspace 升级成功后显示重启提示。
- 版本操作不会提交 Settings 中尚未保存的其他草稿。

### 手动验证

```bash
pnpm run dev
```

- 在浏览器中进入 `/settings`，打开“版本”标签页。
- 对照终端中的 `pi --version` 和 `pi-workspace --version` 检查当前版本显示。
- 验证重新检查、确认框、失败提示和按钮禁用状态。
- 真实升级属于会修改本机安装或源码树的操作，只在明确准备好的测试环境中执行。
- UI 完成后按仓库要求使用 `agent-browser` 做浏览器验证。

## Boundaries

### Always

- 所有版本命令只在服务端执行。
- 使用固定命令和固定参数，拒绝客户端提供任意命令内容。
- 升级前要求用户明确确认。
- 防止服务器进程内同时运行多个升级任务。
- 保留 Pi 与 pi-workspace 的独立错误和结果。
- 运行测试、类型检查与 `npm run build` 后再交付。

### Ask First

- 改变 `pi update` 或 `pi-workspace update` 的默认 CLI 语义。
- 自动升级 Pi 扩展或其他依赖。
- 自动重启或退出当前 pi-workspace 服务。
- 为升级增加提权、`sudo`、凭据写入或包管理器修复操作。
- 将服务监听地址从 `127.0.0.1` 扩展到局域网或公网。
- 引入新的第三方依赖。

### Never

- 不从浏览器接收并执行任意 shell 命令、参数、工作目录或包名。
- 不在前端暴露 API key、进程环境变量或本机凭据。
- 不绕过 Pi 和 pi-workspace CLI 已有的升级规则自行删除或替换安装目录。
- 不用 `sudo` 静默处理权限错误。
- 不因版本功能改变 `/api/chat` 的流式行为或默认工具权限。
- 不在自动化测试中运行真实升级命令。

## Success Criteria

1. Settings 页面存在独立“版本”标签页。
2. 页面能显示全局 Pi CLI 和当前 pi-workspace 的当前版本号。
3. 页面能检查并显示两者的最新版本号及是否可升级。
4. 检查失败时分别展示错误，并提供重新检查能力。
5. 有更新时分别显示“升级 Pi”和“升级 pi-workspace”按钮；无更新时按钮禁用。
6. “升级 Pi”经确认后执行 `pi update`，且不默认升级扩展。
7. “升级 pi-workspace”经确认后执行 `pi-workspace update`，保留现有 CLI 对全局安装与源码副本的处理。
8. 升级期间不能并发触发另一个升级；完成或失败后提供清晰结果。
9. Pi 升级成功后页面重新检查其版本；pi-workspace 升级成功后明确提示重启。
10. 版本操作不保存或丢弃 Settings 页面中的其他设置草稿。
11. 服务端不接受任意命令输入，错误响应不泄露敏感环境信息。
12. `pnpm run test`、`pnpm run typecheck` 与 `npm run build` 全部通过，并完成浏览器手动验证。

## Open Questions

无。若实现中发现 `pi-workspace update` 无法从服务进程可靠定位当前 CLI，可在不改变其命令语义的前提下先更新本规格并请求确认。
