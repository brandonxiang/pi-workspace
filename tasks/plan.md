# Implementation Plan: Archived Chat in Settings

## Overview

Add a third `Archived Chat` tab to the routed settings page, move archived Pi sessions out of the home sidebar, and let users restore archived sessions from that tab without involving the settings save button.

## Architecture Decisions

- Reuse the existing `archivedPiSessionIds` local state and `localStorage` persistence instead of adding a backend archive API.
- Derive two views from the same `projects` data: visible sessions for the home sidebar and archived sessions for the settings tab.
- Implement `Archived Chat` as the third tab in the existing settings page, not as a new route or nested page.
- Keep restore as an immediate action in the archived tab; do not fold it into the settings draft/save flow.

## Task List

### Phase 1: Foundation
- [ ] Add failing tests for hiding archived sessions from the home sidebar
- [ ] Add failing tests for the Archived Chat tab empty state and restore flow

### Checkpoint: Foundation
- [ ] New archived-session tests fail against the current implementation
- [ ] Existing settings-route tests still describe the current routed settings page

### Phase 2: Core Features
- [ ] Filter archived Pi sessions out of the home sidebar project/session lists
- [ ] Add the third Archived Chat tab to the settings page, showing archived sessions grouped with display titles and restore actions
- [ ] Wire restore so the archived tab updates immediately and restored sessions reappear on the home page

### Checkpoint: Core Features
- [ ] Archived-session tests pass
- [ ] Existing session selection, terminal route, and settings save tests still pass

### Phase 3: Polish
- [ ] Add clear empty-state and archived-list styling for the new tab
- [ ] Run full test suite and production build
- [ ] Verify archive -> settings -> restore in a browser

### Checkpoint: Complete
- [ ] Acceptance criteria in the spec are satisfied
- [ ] Ready for review

## Risks and Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Filtering archived sessions breaks project counts or empty-project rendering | High | Derive filtered project lists in one place and cover both visible and archived views with tests |
| Archived tab accidentally mixes with settings draft/save semantics | Medium | Keep restore as a separate immediate action and verify save flow regressions with tests |
| Restored sessions fail to reappear on home due to stale derived state | Medium | Drive both views from the same source state and assert reappearance in App tests |

## Open Questions

- None. The user confirmed that Archived Chat is the third settings tab and only supports restore.
