# Spec: Pi 完成态全量输出展示

## Assumptions

1. 这是一个浏览器端 Web 应用，目标平台是现代桌面浏览器，不考虑原生移动端布局。
2. 用户说的“pi 运行结束后”既包括当前页里一次刚完成的 Pi 对话，也包括随后重新打开同一个 Pi session 的历史视图。
3. “所有信息都能够展示”指的是最终回复、历史 thinking、tool use / tool result；不包含隐藏 custom message、内部状态或额外调试元数据。
4. 默认信息层级应当是“最终回复最醒目，thinking 和 tool use 默认折叠，但用户一点击就能看到大块内容”，而不是把所有信息拆成许多零碎气泡。
5. 保持现有 `/api/chat` 流式返回协议，不新增需要客户端和 SDK 同步升级的后端协议层改造。

如果这些假设有偏差，进入 Plan 之前应先修正。

## Objective

为 Pi 完成态新增一个“完整输出但默认降噪”的展示方式：当一次 Pi 运行结束后，界面默认展示最终回复，同时保留本轮产生的 thinking 和 tool use，并以折叠块形式附着在这次回复附近。用户展开后，应能一次性查看较大块的 reasoning / tool 内容，而不是只能看到零散摘要。

目标用户是在浏览器里使用或复盘 Pi session 的开发者。成功体验应满足：

- 运行完成后，最终回复仍然是主视图的默认可见内容。
- 若本轮存在 thinking，则用户能在同一轮消息中看到一个默认折叠的“思考过程”块，并展开查看完整文本。
- 若本轮存在 tool use / tool result，则用户能在同一轮消息中看到一个默认折叠的“工具调用”块，并展开查看完整内容。
- 同一个 session 在“刚跑完”和“稍后重新打开历史”两种场景下，结构和阅读顺序保持一致。
- SSE 流式体验继续工作；只是在完成态保留并重组本轮信息，而不是在结束时把 thinking 丢掉。

### In Scope

- 为 Pi 历史消息模型增加“thinking”展示类型，以及面向完成态的聚合展示结构。
- 调整实时流式状态管理，使 thinking 在完成后不再被直接移除。
- 调整历史 transcript 分组逻辑，把 assistant final / thinking / tool records 组织成更适合完成态阅读的块。
- 调整聊天面板 UI：默认显示最终回复，thinking 与 tool use 折叠，点击后大块展开。
- 为重新加载的 Pi session 历史补齐同样的展示结构。
- 补充对应单元测试。

### Out of Scope

- 修改 SDK 或 Pi CLI 的底层 session 文件格式。
- 改造终端模式中的实时 tool streaming 呈现方式。
- 展示 hidden custom messages、内部私有状态或额外 raw JSONL。
- 引入新的富文本编辑器、虚拟列表库或全新的状态管理方案。

## Tech Stack

| Layer | Technology |
|---|---|
| Client | React, TypeScript, Ant Design X `Bubble.List` |
| Styling | CSS modules not used; global styles in `client/styles.css` |
| Server | Fastify, TypeScript |
| Session SDK | `@earendil-works/pi-coding-agent@0.75.5` |
| Tests | Vitest |
| Build | Vite + Rolldown |

现有数据流约束：

- `/api/chat` 通过 SSE 发送 `thinking`、`delta`、`tool_*`、`done`、`error`。
- `server/pi-sessions.ts` 当前会把历史 branch 中的 thinking content 丢弃。
- `client/pi-session-streaming.ts` 当前会在 `done`/`error` 时隐藏 thinking bubble。

本功能应优先沿用现有协议和状态流，只在归一化与展示层补齐缺失信息。

## Commands

```bash
pnpm install
pnpm run dev
pnpm run test
pnpm run typecheck
npm run build
```

UI 变更验证时，还应启动开发环境并在浏览器中确认完成态展示与折叠交互。

## Project Structure

```text
client/
  App.tsx                     # 聊天面板、完成态 bubble 生成、Pi 历史与实时消息合流
  types.ts                    # StreamEvent / PiHistoryMessage / transcript 类型
  pi-session-streaming.ts     # 实时流式状态机，保存 thinking/tool/final assistant
  pi-session-transcript.ts    # 将历史消息分组为可渲染 transcript entries
  styles.css                  # thinking/tool disclosure 样式与折叠块布局
  *.test.ts(x)                # 客户端状态与渲染测试
server/
  index.ts                    # `/api/chat` SSE 事件桥接
  pi-sessions.ts              # Pi session branch 历史归一化
  *.test.ts                   # 服务端历史解析测试
tasks/
  pi-complete-output-disclosure-spec.md
```

## Code Style

偏好小而明确的判别联合与“先归一化、后渲染”的结构。不要在 JSX 中直接塞大量 if/else 拼接原始 SDK 事件。

```ts
type PiHistoryTranscriptEntry =
  | {
      id: string;
      role: "assistant-turn";
      finalMessage: Extract<PiHistoryMessage, { role: "assistant" }>;
      thinking?: Extract<PiHistoryMessage, { role: "thinking" }>;
      tools: Extract<PiHistoryMessage, { role: "tool" }>[];
      timestamp: number;
    }
  | PiHistoryMessage;

function buildAssistantTurn(
  finalMessage: Extract<PiHistoryMessage, { role: "assistant" }>,
  thinking: Extract<PiHistoryMessage, { role: "thinking" }> | undefined,
  tools: Extract<PiHistoryMessage, { role: "tool" }>[]
): PiHistoryTranscriptEntry {
  return {
    id: `assistant-turn-${finalMessage.id}`,
    role: "assistant-turn",
    finalMessage,
    thinking,
    tools,
    timestamp: finalMessage.timestamp
  };
}
```

约定：

- 服务端输出稳定、有限、面向展示的数据结构，不把 raw SDK content 直接暴露给客户端。
- 客户端用聚合组件表达“一轮 assistant 输出”，而不是把最终回复、thinking、tool history 当成完全无关的独立消息。
- 折叠内容默认关闭，命名与 aria 文案清晰可读。

## Testing Strategy

使用 Vitest，优先补足纯函数与状态机测试，其次验证 UI 聚合逻辑。

- `client/pi-session-streaming.test.ts`
  - 覆盖 chat 模式下 `done` 后 thinking 不再消失，而是进入完成态结构。
  - 覆盖有 final + thinking + tools 时，默认显示层级正确。
- `client/pi-session-transcript.test.ts`
  - 覆盖历史消息会被聚合成单个 assistant-turn entry。
  - 覆盖没有 thinking 或没有 tools 时的退化情况。
- `server/pi-sessions.test.ts`
  - 覆盖历史 branch 中的 thinking content 不再被丢弃。
  - 覆盖 assistant/tool/thinking 的顺序被正确保留并可供客户端聚合。
- `client/App.test.tsx`
  - 覆盖完成态默认只看到最终回复。
  - 覆盖点击“思考过程”或“工具调用”后可以看到完整块内容。

交付前验证：

- `pnpm run test`
- `pnpm run typecheck`
- `npm run build`
- `pnpm run dev` 后进行一次浏览器手测

## Boundaries

- Always: 保持 `/api/chat` 流式行为；保留最终回复为默认主内容；为新增 transcript/streaming 分支补测试；保证 tool/thinking 默认折叠。
- Ask first: 修改 API 返回 shape 到会影响现有调用方；新增第三方 UI 依赖；改变终端模式 streaming 行为；公开本来被隐藏的 custom/internal message。
- Never: 在前端暴露 provider key；把完整原始 session 文件或内部私有状态直接发送到浏览器；为了做完成功能而移除既有测试。

## Success Criteria

- 一次 Pi 运行完成后，如果本轮只有最终回复，则界面行为与现在基本一致。
- 一次 Pi 运行完成后，如果本轮包含 thinking，则最终回复下方会出现一个默认折叠的“思考过程”块；展开后可看到完整 thinking 文本。
- 一次 Pi 运行完成后，如果本轮包含 tool use / tool result，则最终回复下方会出现一个默认折叠的“工具调用”块；展开后可看到该轮全部工具内容。
- 同一轮 assistant 的最终回复、thinking、tool use 在视觉上属于一个“回合”，而不是散落为多条互不关联的气泡。
- 重新打开同一个 Pi session 历史时，若底层 branch 中存在 thinking/tool records，则页面展示结构与刚完成时一致。
- 现有测试更新通过，且 `npm run build` 通过。

## Open Questions

1. “历史思考过程”是否应该逐 token 原样保留，还是允许在完成态里按段落合并后展示？
2. tool use 折叠块内是否需要继续区分“调用参数”和“调用结果”两个小节，还是保留现有按记录顺序平铺即可？
3. 如果一个 assistant 回合里出现多段 thinking 或多轮 tool 调用穿插，是否接受把它们聚合成单个折叠块，还是需要按阶段分别折叠？
4. 这个交互是否只要求作用于 `Pi session` 相关视图，还是也希望普通本地 browser conversation 在未来复用同样结构？
