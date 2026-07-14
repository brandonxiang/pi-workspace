# Agent Notes

## Project Goal

Build and maintain a browser-based agent dialogue tool backed by
`@earendil-works/pi-coding-agent` as an SDK dependency.

## Development Commands

- Install dependencies: `pnpm install`
- Start local dev server (rolldown watch + node --watch): `pnpm run dev`
- Run tests: `pnpm run test`
- Typecheck (client + server): `pnpm run typecheck`
- Build client + server: `pnpm run build`
- Production start after build: `pnpm start`

## Key Files

- `dev.mjs` — Dev server launcher (rolldown --watch + node --watch)
- `rolldown.server.config.mjs` — rolldown configuration for server bundling

## Implementation Rules

- Place unit tests in the `__tests__/` subdirectory of the directory containing
  the code under test.
- Keep API keys on the server. Do not expose model provider keys in frontend code.
- Server auth should read local Pi credentials from `~/.pi/agent/auth.json` by default,
  with `.env` provider keys as runtime overrides.
- Use `@earendil-works/pi-coding-agent` for agent sessions; do not replace it with
  direct provider calls unless the user explicitly asks.
- Default online sessions should not enable shell or file mutation tools.
- If enabling tools later, add explicit authentication, workspace isolation, and
  permission prompts first.
- Preserve streaming behavior over `/api/chat`; the UI should show deltas while
  the agent is responding.

## Agent skills

### Issue tracker

Issues are tracked as GitHub issues, and external PRs are also treated as a triage surface. See `docs/agents/issue-tracker.md`.

### Triage labels

Uses default label names (needs-triage, needs-info, ready-for-agent, ready-for-human, wontfix). See `docs/agents/triage-labels.md`.

### Domain docs

Single-context layout — one CONTEXT.md + docs/adr/ at the repo root. See `docs/agents/domain.md`.

## Verification

Before handing off changes, run:

```bash
npm run build
```

For UI changes, also start `npm run dev` and verify the page in a browser.
Default to using `agent-browser` for browser-based verification unless the user
explicitly requests a different verification approach.

<!--VITE PLUS START-->

# Using Vite+, the Unified Toolchain for the Web

This project is using Vite+, a unified toolchain built on top of Vite, Rolldown, Vitest, tsdown, Oxlint, Oxfmt, and Vite Task. Vite+ wraps runtime management, package management, and frontend tooling in a single global CLI called `vp`. Vite+ is distinct from Vite, and it invokes Vite through `vp dev` and `vp build`. Run `vp help` to print a list of commands and `vp <command> --help` for information about a specific command.

Docs are local at `node_modules/vite-plus/docs` or online at https://viteplus.dev/guide/.

## Review Checklist

- [ ] Run `vp install` after pulling remote changes and before getting started.
- [ ] Run `vp check` and `vp test` to format, lint, type check and test changes.
- [ ] Check if there are `vite.config.ts` tasks or `package.json` scripts necessary for validation, run via `vp run <script>`.
- [ ] If setup, runtime, or package-manager behavior looks wrong, run `vp env doctor` and include its output when asking for help.

<!--VITE PLUS END-->
