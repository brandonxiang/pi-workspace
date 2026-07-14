# Plan: Pi 完成态全量输出展示

基于 spec [`pi-complete-output-disclosure-spec.md`](./pi-complete-output-disclosure-spec.md)。

## Goal

把 `Pi session` 相关视图中的一次 assistant 回合重组为“最终回复 + 可折叠的 thinking + 可折叠的 tool use”，并让“实时刚完成”和“重新打开历史”两条路径最终落到同一种展示结构。

## Implementation Strategy

先打通数据，再做聚合，最后改 UI：

1. **保留 thinking 数据**
   - 服务端历史归一化不再丢弃 thinking。
   - 客户端 streaming 状态在完成后不再直接擦除 thinking。
2. **建立 assistant-turn 聚合模型**
   - 让 transcript 层能把 final assistant、thinking、tool records 组合成一个可渲染回合。
   - 这个聚合只作用于 `Pi session` 相关视图。
3. **切换渲染结构**
   - 用新的回合组件渲染默认展开的最终回复。
   - 折叠 thinking 和 tool use 到同一 bubble 内部。
4. **补测试并验证**
   - 先补纯函数/状态机测试，再补组件测试，最后做手动浏览器验证。

## Workstreams

### 1. 服务端历史归一化

**目标：** 让 `GET /api/pi-sessions/:sessionId` 返回足够表达 thinking 的消息序列。

**变更点：**

- `server/pi-sessions.ts`
  - 为历史归一化新增 `role: "thinking"` 的消息类型。
  - `normalizeRichContent()` 不再简单忽略 `thinking` content；要把它们按原始顺序提取出来。
  - `normalizeMessageEntry()` 在 assistant message 中生成：
    - assistant 文本消息
    - thinking 消息
    - tool call/tool result 消息
  - 保证 thinking 文本按 token 原样拼接，不做摘要。

**关键约束：**

- 不改 `/api/chat` 的 SSE 协议。
- 不把原始 session 文件或 raw SDK content 直接返回给前端。
- 历史里若只有 thinking 没有 final assistant 文本，也需要有一致的退化行为，避免客户端崩掉。

### 2. 前端类型与 transcript 聚合

**目标：** 用一个中间层把分散历史消息整合成“assistant turn”。

**变更点：**

- `client/types.ts`
  - 新增 `PiHistoryMessage` 的 `thinking` 变体。
  - 新增 `PiHistoryTranscriptEntry` 的聚合类型，建议命名为 `assistant-turn`。
- `client/pi-session-transcript.ts`
  - 取代当前只做 `tool-group` 聚合的逻辑。
  - 新规则：
    - 遇到 assistant final message，开始或结束一个 turn。
    - turn 可以吸收相邻的 thinking 与 tool 消息。
    - 多段 thinking、多条 tool 记录允许进入同一个 turn。
    - 非 Pi assistant 相关消息仍单独保留。

**推荐聚合原则：**

- 一个 turn 以“最终 assistant 消息”为锚点。
- 若历史顺序是 `thinking -> tool -> assistant`，这些记录归入该 assistant。
- 若历史顺序出现多段 `thinking/tool/.../assistant`，允许在 assistant 前整体吸收。
- 如果出现无法可靠归属的孤立 tool/thinking，保守回退为单独 transcript entry，不强行归并。

### 3. Streaming 完成态保留

**目标：** 让“刚跑完的当前 Pi session”也能生成与历史一致的 turn 数据。

**变更点：**

- `client/pi-session-streaming.ts`
  - `done`/`error` 后不要再把 thinking 直接作为临时草稿抹掉。
  - 状态中保留最终可提交的 thinking 文本。
  - chat 模式下仍隐藏 streaming 中的 tool 实时气泡，但完成后保留 completed tools。
- `client/App.tsx`
  - 在 stream 结束并写回 `piSessionDetail.messages` 时，同时写入：
    - pending user message
    - thinking message（如存在）
    - tool messages
    - final assistant message
  - 顺序要与 transcript 聚合规则兼容。

**关键约束：**

- 不能破坏现有流式文本增量展示。
- 如果流以 `error` 结束，部分 assistant 内容、thinking 和 tool 是否落盘要遵循当前已有错误处理路径，优先避免伪造“成功完成”的历史结构。

### 4. Pi Session 完成态 UI

**目标：** 在 `Pi session` 视图里把一轮 assistant 输出渲染成统一卡片。

**变更点：**

- `client/App.tsx`
  - 新增 `PiAssistantTurnContent` 之类的聚合组件。
  - 结构建议：
    - 顶部：最终回复 markdown，默认可见
    - 中部：`<details>` 折叠的 thinking block
    - 底部：`<details>` 折叠的 tool block
  - 仍复用现有 `MessageHeader` 和 `RenderMarkdown`。
- `client/styles.css`
  - 为 assistant-turn 容器、thinking disclosure、tool disclosure 增加样式。
  - thinking 展开内容适合 `white-space: pre-wrap`，确保 token 文本原样可读。
  - tool block 内继续复用现有工具卡视觉，避免重新设计过多样式。

**UI 规则：**

- 默认只展开最终回复。
- 有 thinking 才显示“思考过程”折叠块。
- 有 tools 才显示“工具调用”折叠块。
- thinking/tool 的展开控件文案要清楚地区分。
- 该聚合 UI 只用于 `Pi session` transcript，不影响普通本地 conversation。

## Implementation Order

### Phase A: 数据模型闭环

1. 更新 `server/pi-sessions.ts` 与测试，历史接口可返回 thinking。
2. 更新 `client/types.ts` 与 `client/pi-session-transcript.ts`，形成 assistant-turn 聚合模型。

**Checkpoint:** 仅靠 mock 数据，历史 transcript 已能在测试中表达 `thinking + tools + final assistant`。

### Phase B: 实时完成态闭环

3. 更新 `client/pi-session-streaming.ts`，保留完成后的 thinking。
4. 更新 `client/App.tsx` 的 stream completion 写回逻辑，让实时结果进入同样的数据结构。

**Checkpoint:** streaming 相关测试通过，且写回的 `piSessionDetail.messages` 可以被 transcript 聚合为单个 turn。

### Phase C: 渲染与样式

5. 在 `client/App.tsx` 新增 assistant-turn 渲染分支。
6. 更新 `client/styles.css` 完成折叠块与大块展示样式。

**Checkpoint:** 组件测试能验证默认只见最终回复，展开后能看见完整 thinking/tool 内容。

### Phase D: 回归验证

7. 跑 `vp check`、`vp test`，以及项目要求的 `npm run build`。
8. 启动 `pnpm run dev`，手动验证 Pi session 历史与刚完成场景。

## Risks And Mitigations

### Risk 1: 历史消息顺序不足以可靠归并

**问题：** 服务端历史归一化后，thinking、tool、assistant 的相对顺序可能并不总是理想。

**缓解：**

- transcript 聚合逻辑采用“保守归并”。
- 只有在能明确锚定到 assistant final message 时才聚合。
- 无法归并的记录保留为单独 entry，避免错误串联。

### Risk 2: Streaming 与历史路径结构不一致

**问题：** 实时完成后写回的消息顺序如果和历史接口不一致，UI 会出现两套行为。

**缓解：**

- 先定义一套共享的 transcript 聚合规则，再反推 streaming 写回顺序。
- 在 `client/pi-session-transcript.test.ts` 中加入两组等价样例：一组模拟历史 API，一组模拟 stream 完成写回。

### Risk 3: thinking 文本很长，展开后可读性差

**问题：** token 原样保留可能导致超长连续文本。

**缓解：**

- 使用大块 `pre-wrap` 容器。
- 默认折叠，避免压垮主阅读流。
- 不在本阶段额外做分段重写，严格遵循 spec。

## Verification Plan

### Automated

```bash
vp check
vp test
npm run build
```

### Manual

```bash
pnpm run dev
```

手测重点：

1. 打开一个已有 `Pi session`，确认默认只看到最终回复。
2. 展开“思考过程”，确认内容与历史 token 流一致。
3. 展开“工具调用”，确认记录顺序与原始调用顺序一致。
4. 发送一条新消息让 Pi 跑完，确认完成后立即看到同样结构。
5. 刷新页面或重新选中该 session，确认历史结构保持一致。

## Deliverables

- 更新后的 spec：[`pi-complete-output-disclosure-spec.md`](./pi-complete-output-disclosure-spec.md)
- 本计划：[`pi-complete-output-disclosure-plan.md`](./pi-complete-output-disclosure-plan.md)
- 下一阶段将产出任务拆解文档，再进入实现。
