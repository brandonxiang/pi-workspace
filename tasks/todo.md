- [ ] Task: Establish the independent website build and typed bilingual content
  - Acceptance: Website dev/test/build commands exist, build output is isolated, and English/Chinese content has identical typed structure
  - Verify: `vp run website:test`; `vp run website:build`
  - Files: `package.json`, `vite.website.config.ts`, `tsconfig.website.json`, `website/index.html`, `website/src/content.ts`, `website/src/content.test.ts`

- [ ] Task: Implement tested locale and install-command interactions
  - Acceptance: Locale initializes safely, switches without reload, persists, updates `document.lang`, and copy feedback handles success/failure accessibly
  - Verify: `vp run website:test`
  - Files: `website/src/locale.ts`, `website/src/locale.test.ts`, `website/src/components/InstallCommand.tsx`, `website/src/components/InstallCommand.test.tsx`, `website/src/Website.tsx`

- [ ] Task: Compose the complete responsive Workspace blueprint page
  - Acceptance: Every specified section renders in both locales with semantic landmarks, real product concepts, responsive layout, focus visibility, and reduced motion
  - Verify: `vp run website:test`; `vp run website:check`; `vp run website:build`
  - Files: `website/src/Website.tsx`, `website/src/Website.test.tsx`, `website/src/main.tsx`, `website/src/styles.css`, `website/src/components/ProductStage.tsx`

- [ ] Task: Perform browser and repository-wide verification
  - Acceptance: Desktop and 320px mobile flows have no console errors, broken assets, overflow, or keyboard blockers; existing application remains green
  - Verify: `vp check`; `vp test`; `npm run build`; manual `agent-browser` checks against `vp run website:dev`
  - Files: none unless verification exposes a defect
