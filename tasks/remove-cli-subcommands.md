# Remove CLI `start` and `build`

- [x] Add failing public CLI behavior tests.
  - Acceptance: help omits both commands; invoking either exits non-zero; version works.
  - Verify: `vp test run server/pi-workspace-cli.test.ts`.
  - Files: `server/pi-workspace-cli.test.ts`.
- [x] Remove the subcommands from the CLI.
  - Acceptance: parser and dispatch no longer recognize them; bare startup is unchanged.
  - Verify: focused CLI test and TypeScript checks pass.
  - Files: `bin/pi-workspace.mjs`.
- [x] Update public documentation.
  - Acceptance: English and Chinese CLI examples no longer advertise removed commands.
  - Verify: repository search finds no CLI `start` or `build` examples outside historical specs.
  - Files: `README.md`, `README.CN.md`.
- [x] Complete review, verification, and merge.
  - Acceptance: `vp check`, `vp test`, and `npm run build` pass; review has no blocking findings; main contains the commits.
  - Verify: clean main worktree and expected Git history.
