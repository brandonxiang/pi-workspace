# Implementation Plan: pi-workspace Official Website

## Overview

Build the approved bilingual `pi-workspace` marketing site as an independent React/Vite+ static entry point. The work proceeds in test-first vertical slices: establish the isolated build and typed content contract, add the two required interactions, then compose and verify the responsive Workspace blueprint experience.

## Architecture Decisions

- Keep all website source under `website/` and build to `dist-website`; do not import website code into `client/` or alter application routes.
- Reuse the repository's React, TypeScript, Vitest, and Vite+ dependencies. Add no runtime dependencies.
- Store English and Simplified Chinese content in one statically typed module so missing locale keys fail type checking and tests.
- Use local component state plus `localStorage` for locale selection; the site has no backend or application API calls.
- Render the product proof as semantic HTML/CSS based on real product concepts instead of shipping a fake interactive terminal or remote screenshot dependency.

## Dependency Graph

```text
website build config
  -> typed bilingual content
     -> locale and clipboard behavior
        -> page composition and product stage
           -> responsive/browser verification
```

## Task List

### Phase 1: Independent foundation

- [ ] Add independent website Vite+, TypeScript, and package scripts.
- [ ] RED: add tests for translation parity and locale resolution.
- [ ] GREEN: implement the typed bilingual content and locale utilities.

### Checkpoint: Foundation

- [ ] `vp run website:test` passes.
- [ ] `vp run website:build` emits `dist-website` without changing existing build output.

### Phase 2: Required interactions

- [ ] RED: add component tests for language switching, document language, locale persistence, clipboard success, and clipboard failure.
- [ ] GREEN: implement the language control and accessible install command component.

### Checkpoint: Interactions

- [ ] Focused website tests pass.
- [ ] The interactions work without external services or new dependencies.

### Phase 3: Complete interface

- [ ] RED: add a bilingual render smoke test for required landmarks, sections, headings, and links.
- [ ] GREEN: implement the Workspace blueprint page, product-stage composition, responsive styles, focus states, and reduced motion.
- [ ] Verify desktop/mobile layouts, keyboard interaction, console, and local assets with `agent-browser`.
- [ ] Run repository-wide checks and production builds.

### Checkpoint: Complete

- [ ] All specification success criteria are met.
- [ ] Existing workspace tests and build remain green.
- [ ] Browser verification is captured at desktop and 320px mobile widths.

## Risks and Mitigations

| Risk                                                  | Impact | Mitigation                                                                            |
| ----------------------------------------------------- | ------ | ------------------------------------------------------------------------------------- |
| Website config interferes with the existing app build | High   | Use a dedicated config, tsconfig, root, and output directory; run both builds         |
| Chinese and English content drift                     | Medium | Define one shared content type and assert structural parity                           |
| Clipboard permission fails                            | Medium | Keep command text selectable and expose a polite manual-copy message                  |
| Product mockup feels generic or unreadable on mobile  | Medium | Use real domain labels, limit decoration, and verify screenshots at 320px and desktop |
| Remote fonts hurt resilience or privacy               | Low    | Use local system-first stacks with named font fallbacks and no external requests      |

## Open Questions

- None. The user's instruction to implement immediately is treated as approval of the specification and this execution sequence.
