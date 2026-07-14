# Implementation Plan: Remove CLI `start` and `build`

## Overview

Remove the two CLI subcommands while preserving bare startup and project-level
package scripts. Implement the behavior test-first, update public documentation,
then run repository verification and merge the focused commits into the main
worktree.

## Architecture Decisions

- Keep bare `pi-workspace` as the sole production-start CLI path.
- Reuse the existing unknown-argument error for removed subcommands.
- Test the executable as a child process so assertions cover the public CLI.
- Do not change `pnpm start`, `pnpm build`, automatic startup builds, or server
  behavior.

## Task List

### Phase 1: Executable behavior

- [ ] RED: add process tests for help, removed commands, and retained version output.
- [ ] GREEN: remove `start` and `build` parsing, dispatch, and help entries.

### Checkpoint: CLI

- [ ] Focused CLI tests pass.
- [ ] Type checking passes.

### Phase 2: Documentation and verification

- [ ] Remove CLI build examples from English and Chinese READMEs.
- [ ] Run `vp check`, `vp test`, and `npm run build`.
- [ ] Review the complete diff and merge it into the main worktree.

## Risks and Mitigations

| Risk                                     | Impact | Mitigation                                                                              |
| ---------------------------------------- | ------ | --------------------------------------------------------------------------------------- |
| Package scripts are removed accidentally | High   | Limit parser changes to `bin/pi-workspace.mjs`; assert package scripts remain in review |
| Removed commands still execute           | Medium | Test the public process exit status and stderr                                          |
| Help or docs advertise stale commands    | Low    | Assert help output and search repository docs before merge                              |

## Open Questions

- None. The explicit instruction to delete the subcommands and merge to main is
  treated as approval of this execution sequence.
