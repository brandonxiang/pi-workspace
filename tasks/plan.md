# Plan: Settings — Skills Tab

## Implementation Order

```
1. Server: enhance /api/skills response
        ↓
2. Client: add SkillItem type + fetch skills hook
        ↓
3. Client: i18n translations
        ↓
4. Client: add Skills tab component to App.tsx
        ↓
5. Client: add styles
        ↓
6. Verify: typecheck + build + manual check
```

## Components & Dependencies

| Component              | Depends On         | Files               |
| ---------------------- | ------------------ | ------------------- |
| Server API enhancement | —                  | `server/index.ts`   |
| Client types           | Server API shape   | `client/types.ts`   |
| i18n keys              | —                  | `client/i18n.ts`    |
| Skills tab UI          | types + i18n + API | `client/App.tsx`    |
| Styles                 | —                  | `client/styles.css` |

## Risks

- `loadSkills()` 的返回类型中 `SourceInfo` 可能不是 public export —— 需要在 server 端自行映射字段。
- Skills cache 在 server 端有 1 分钟 TTL，用户点击 Refresh 需手动清除缓存。

## Verification Checkpoints

1. After Step 1: `curl http://localhost:8787/api/skills | jq '.skills[0].scope'` 返回 `"user"`
2. After Step 6: `pnpm run typecheck && pnpm run build` 通过
3. Final: 打开浏览器 `/settings` 确认 Skills tab 可见，列表和 Refresh 正常工作
