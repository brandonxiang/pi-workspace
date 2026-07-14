# Tasks: Pi 完成态全量输出展示

基于 spec [`pi-complete-output-disclosure-spec.md`](./pi-complete-output-disclosure-spec.md) 与 plan [`pi-complete-output-disclosure-plan.md`](./pi-complete-output-disclosure-plan.md)。

## Task 1: 保留历史与完成态的 thinking 数据

**Acceptance:**

- `server/pi-sessions.ts` 不再丢弃 assistant content 中的 thinking。
- `client/pi-session-streaming.ts` 在完成后保留 thinking 文本供后续写回。
- thinking 文本按 token 原样保留。

**Verify:**

```bash
vp test client/pi-session-streaming.test.ts server/pi-sessions.test.ts
```

**Files:**

- `server/pi-sessions.ts`
- `server/pi-sessions.test.ts`
- `client/pi-session-streaming.ts`
- `client/pi-session-streaming.test.ts`

## Task 2: 聚合 Pi assistant turn transcript

**Acceptance:**

- `client/pi-session-transcript.ts` 能把最终回复、thinking、tool records 聚合成一个 assistant-turn。
- 多段 thinking / 多条 tool record 允许聚合到同一 turn。
- 无法可靠归属的记录保守保留为独立 entry。

**Verify:**

```bash
vp test client/pi-session-transcript.test.ts
```

**Files:**

- `client/pi-session-transcript.ts`
- `client/pi-session-transcript.test.ts`
- `client/types.ts`

## Task 3: 渲染 Pi session 完成态 disclosure UI

**Acceptance:**

- `Pi session` 视图默认突出显示最终回复。
- 若存在 thinking，则显示默认折叠的“思考过程”块。
- 若存在 tool use，则显示默认折叠的“工具调用”块。
- 展开后显示完整大块内容，tool 记录按原顺序平铺。

**Verify:**

```bash
vp test client/App.test.tsx
```

**Files:**

- `client/App.tsx`
- `client/App.test.tsx`
- `client/styles.css`

## Final Verification

- [ ] `vp check`
- [ ] `vp test`
- [ ] `npm run build`
- [ ] `pnpm run dev` 手动验证 Pi session 历史与刚完成场景
