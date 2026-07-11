# Implementation Plan: Pi Session Routing

## Overview

This change adds a lightweight client-side routing layer so the app can express both the selected Pi session and the active panel mode in the browser URL. The feature should preserve current session loading behavior, keep streaming safety checks intact, and make refresh/back-forward navigation work predictably without introducing a new routing dependency.

## Architecture Decisions

- Use native History API instead of `react-router`.
  Rationale: the app currently has a single top-level `App.tsx`, only two routeable view shapes, and no need for nested route trees.

- Encode session identity in the pathname and panel mode in the query string.
  Rationale: `sessionId` is the primary resource, while `chat` vs `terminal` is orthogonal UI state.

- Make URL the first source of truth for the current tab.
  Rationale: direct links, refreshes, and browser history should behave deterministically even when `localStorage` contains older state.

- Reuse existing `selectPiSession` flow for route-driven navigation.
  Rationale: sidebar clicks and `popstate` should not drift into separate loading paths.

## Dependency Graph

```text
Route model helpers
    │
    ├── App hydration from URL
    │       │
    │       ├── Session selection history sync
    │       ├── Panel mode history sync
    │       └── popstate replay
    │
    └── Route tests
            │
            └── App behavior regression tests
```

## Task List

### Phase 1: Routing Foundation

- [ ] Task 1: Add route parsing and URL-building helpers
  - Acceptance: `client/app-routing.ts` defines typed helpers for parsing `/` and `/sessions/:sessionId` plus `panel=chat|terminal`.
  - Acceptance: Invalid paths normalize to `home`; invalid `panel` values are ignored.
  - Verify: Add focused Vitest coverage for parse/build helpers.
  - Files: `client/app-routing.ts`, `client/app-routing.test.ts`

- [ ] Task 2: Hydrate `App` state from URL before `localStorage`
  - Acceptance: On initial load, `App` resolves current route from `window.location`.
  - Acceptance: URL-provided `sessionId` is selected before any stored selection fallback.
  - Acceptance: URL-provided `panel` mode overrides stored panel mode for that tab.
  - Verify: `pnpm run test -- App.test.tsx`; manual check by loading `/` and `/sessions/:id?panel=terminal`.
  - Files: `client/App.tsx`, `client/App.test.tsx`

### Checkpoint: Foundation

- [ ] Route helpers are covered by tests.
- [ ] Initial load behavior is deterministic for URL vs `localStorage`.
- [ ] Existing empty-state launch flow still works.

### Phase 2: Navigation Sync

- [ ] Task 3: Sync session selection and clearing with browser history
  - Acceptance: Selecting a Pi session pushes `/sessions/:sessionId?panel=<currentMode>`.
  - Acceptance: Clearing selection returns to `/` while preserving explicit mode when appropriate.
  - Acceptance: Route-driven errors for missing sessions keep the failing URL visible.
  - Verify: `pnpm run test -- App.test.tsx`; manual click-through of sidebar selection and invalid session URL.
  - Files: `client/App.tsx`, `client/App.test.tsx`

- [ ] Task 4: Sync panel mode changes and `popstate`
  - Acceptance: Changing between chat and terminal updates the current URL query.
  - Acceptance: Browser back/forward restores both selected session and panel mode.
  - Acceptance: Streaming safeguards remain in place when route transitions are triggered by history events.
  - Verify: `pnpm run test -- App.test.tsx`; manual back/forward checks in browser.
  - Files: `client/App.tsx`, `client/App.test.tsx`

### Checkpoint: Core Flow

- [ ] Session route, panel mode route, and browser history all work together.
- [ ] No duplicate fetch loops or stale session flashes appear during navigation.
- [ ] Terminal mode still opens the same underlying session context.

### Phase 3: Verification and Cleanup

- [ ] Task 5: Final regression coverage and polish
  - Acceptance: Tests cover invalid route fallback, explicit terminal mode, and URL precedence over stored state.
  - Acceptance: Route helper naming and comments are clear enough for future route expansion.
  - Verify: `pnpm run test`, `pnpm run typecheck`, `npm run build`
  - Files: `client/App.test.tsx`, `client/app-routing.test.ts`, `client/app-routing.ts`, `client/App.tsx`

### Checkpoint: Complete

- [ ] All route acceptance criteria from the spec are met.
- [ ] `pnpm run test` passes.
- [ ] `npm run build` passes.
- [ ] Manual browser verification covers refresh, back/forward, and both panel modes.

## Risks and Mitigations

| Risk                                                            | Impact | Mitigation                                                                                                |
| --------------------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------- |
| URL syncing creates loops between state updates and `pushState` | High   | Centralize route writes in helper functions and guard against no-op rewrites                              |
| Initial hydration races with project/session loading            | High   | Parse route immediately, then apply it only after project data is available using a single hydration gate |
| `popstate` bypasses existing streaming protections              | Medium | Route history handlers must call the same guarded selection/mode-change functions used by the UI          |
| Panel mode in URL conflicts with stored preference              | Medium | Define explicit precedence: URL when present, stored mode when absent                                     |
| Invalid session URLs degrade into confusing fallback behavior   | Medium | Keep explicit error state and do not silently jump to another session                                     |

## Open Questions

- When clearing selection from a session route, should `/ ?panel=<mode>` always be explicit, or only when the mode is `terminal`?
  Current implementation recommendation: keep the explicit `panel` query whenever the current URL already carries route state, to preserve shareability and consistent history.

- Should settings-based panel mode changes create a new history entry or replace the current one?
  Current implementation recommendation: `pushState` for user-visible navigation changes, unless testing shows it makes history too noisy.
