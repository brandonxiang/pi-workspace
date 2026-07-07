- [x] Task: Add failing tests for archived-session filtering and Archived Chat tab behavior
  - Acceptance: Tests prove archived Pi sessions disappear from the home sidebar, appear in the third settings tab, and can be restored from there
  - Verify: `pnpm run test -- client/App.test.tsx`
  - Files: `client/App.test.tsx`

- [x] Task: Filter archived Pi sessions out of the home sidebar list
  - Acceptance: Archived session IDs are excluded from sidebar project session rows without breaking non-archived session selection
  - Verify: `pnpm run test -- client/App.test.tsx`
  - Files: `client/App.tsx`, `client/PiSessionSection.tsx`

- [x] Task: Add the third Archived Chat tab with title display and restore action
  - Acceptance: Settings page shows archived sessions in a dedicated tab, each row exposes the session title, and restore updates the page immediately
  - Verify: `pnpm run test -- client/App.test.tsx`
  - Files: `client/App.tsx`, `client/styles.css`, `client/i18n.ts`

- [x] Task: Run end-to-end verification for archive and restore
  - Acceptance: Automated tests, build, and manual browser flow all confirm archive -> hidden from home -> visible in settings -> restored to home
  - Verify: `pnpm run test`, `pnpm run build`, `pnpm run dev`
  - Files: none
