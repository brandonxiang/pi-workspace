# Oxlint and Oxfmt Integration Design

## Goal

Add Oxlint and Oxfmt as the repository's linting and formatting tools, format
the complete repository, and make both checks part of the normal development
and release workflow.

## Tooling

- Add the current npm releases of `oxlint` and `oxfmt` to `devDependencies`.
- Add `lint`, `lint:fix`, `format`, `format:check`, and `check` scripts.
- Use Oxlint's stable default rules for the initial adoption. Type-aware and
  experimental linting are out of scope.
- Configure generated output, installed dependencies, and environment files to
  remain excluded from checks and formatting.
- Extend the existing `release-it` pre-release checks with lint and formatting
  validation before tests and builds run.

## Repository formatting

Run Oxfmt over every supported source and project file in the repository,
including TypeScript, TSX, JavaScript modules, JSON, Markdown, YAML, CSS, and
HTML. Formatting changes must not intentionally alter program behavior.

The user's existing uncommitted work remains in place. Files already modified
by the user may receive formatting-only edits, but their semantic changes must
not be reverted or rewritten.

## Commit boundaries

Keep tool installation and configuration separate from the mechanical
repository-wide formatting where the existing worktree permits. Never include
unrelated user changes merely to obtain a clean commit.

## Verification

- `pnpm lint` succeeds.
- `pnpm format:check` succeeds after the formatting pass.
- `pnpm test` succeeds.
- `pnpm typecheck` succeeds.
- `npm run build` succeeds.
- The release-it dry run reaches the simulated publish, commit, tag, and push
  steps without performing a real release.
