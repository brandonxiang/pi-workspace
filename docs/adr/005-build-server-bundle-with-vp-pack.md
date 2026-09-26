# ADR-005: Build the Server Bundle with `vp pack`

## Status

Accepted

## Date

2026-09-27

## Context

The production server bundle was produced by a standalone `rolldown.server.config.mjs`
invoked directly through a `rolldown` devDependency:

```json
"build:server": "rolldown -c rolldown.server.config.mjs"
```

This had three costs.

**Build configuration lived outside `vite.config.ts`.** Every other build, test,
lint, and format setting in the repository is consolidated in `vite.config.ts`,
so the server bundle was the one exception — a second config file with its own
entry, externalization rule, and output settings.

**`rolldown` was a direct devDependency purely to run that file.** Vite+ already
bundles Rolldown (via `@voidzero-dev/vite-plus-core`), so the repository was
pinning a second, independent copy of the same toolchain.

**The sourcemap setting never took effect.** `rolldown.server.config.mjs` set
`sourcemap: true` at the top level of the config object, but Rolldown expects it
under `output`. No `.map` file was ever emitted, so the intended debugging
support was silently absent.

Separately, the project's toolchain had drifted out of alignment: the global
`vp` CLI was `1.0.0-rc.1` while the project's local `vite-plus` was `0.2.7`,
meaning project commands and global commands were running different bundled
tool versions.

## Decision

Build the server bundle with `vp pack`, which runs tsdown (itself built on
Rolldown), and move its configuration into the `pack` block of `vite.config.ts`:

```ts
pack: {
  entry: ["server/index.ts"],
  outDir: "dist-server",
  format: "esm",
  platform: "node",
  sourcemap: true,
  deps: { neverBundle: true },
},
```

`deps.neverBundle: true` is the load-bearing option and is not a default.
tsdown externalizes packages listed in `dependencies`, but treats
`devDependencies` as bundleable. The server entry contains a dev-only
`await import("vite")` for middleware mode, so without this option Vite would be
inlined into the published bundle. `neverBundle: true` externalizes every bare
import, which reproduces the previous Rolldown `external` predicate exactly.

The change set:

- `build:server` becomes `vp pack`
- `dev.mjs` spawns `node_modules/vite-plus/bin/vp pack` instead of the Rolldown
  binary, keeping its existing watch / rebuild / restart sequencing
- `rolldown.server.config.mjs` is deleted, along with the `rolldown`
  devDependency and the now-unused `allowBuilds.rolldown` entry
- the local toolchain is realigned to the global `vp` with `vp migrate`, pinning
  `vite-plus` and `vite` through the pnpm catalog

Verification was done by diffing the output against the previous build: the
bundle is byte-identical apart from the 35-byte `//# sourceMappingURL=` comment
the newly working sourcemap emits. External imports were confirmed to be
unchanged — Node builtins, `@earendil-works/pi-coding-agent`, `node-pty`, and
`ws` are external, and `import("vite")` remains a dynamic import.

## Alternatives Considered

### Keep the standalone Rolldown config

- Pros:
  - no change, no risk to a working build
  - Rolldown's `external` predicate is expressed directly as a function
- Cons:
  - build configuration stays split across two files
  - a second copy of the Rolldown toolchain stays pinned as a devDependency
  - the `sourcemap: true` placement bug would need fixing in place
- Rejected:
  - it forgoes both the config consolidation and the stale dependency removal
    for no gain beyond avoiding a verifiable, mechanical change

### Call Rolldown through Vite+ without tsdown

- Pros:
  - closer to the previous build, with only the tool invocation changing
- Cons:
  - Vite+ exposes bundling through `vp pack` (tsdown), not as a generic Rolldown
    CLI passthrough; reaching around it means depending on an internal entry
    point and abandoning the supported path
- Rejected:
  - using the supported `vp pack` surface is more stable than depending on
    internals, and it delivers the config consolidation that motivated the
    change

### Install tsdown directly instead of using `vp pack`

- Pros:
  - explicit dependency, so the bundler version is visible in `package.json`
- Cons:
  - reintroduces the duplication the change removes — Vite+ already bundles
    tsdown, and its version is tied to the `vite-plus` release
  - a direct tsdown pin could drift from the version `vp pack` uses
- Rejected:
  - the whole point is a single toolchain whose versions move together

## Consequences

### Positive

- All build, test, lint, format, and pack configuration now lives in
  `vite.config.ts`
- `rolldown` is no longer a direct devDependency; the bundler comes from the
  Vite+ toolchain
- Sourcemaps for the server bundle are emitted for the first time, matching the
  original intent
- Local `vite-plus` and the global `vp` are aligned, so project and global
  commands run the same bundled tool versions
- `vp pack` cleans its output directory on each build, so stale artifacts no
  longer accumulate in `dist-server/`

### Negative

- The server bundle can no longer be built without loading `vite.config.ts`,
  coupling server packaging to the Vite configuration file
- The toolchain is pinned to `vite-plus` `1.0.0-rc.1`, a release candidate.
  This is what `vp migrate` aligns the project to, and it is the same version
  the global `vp` already runs — but it is not a stable release
- `dist-server/index.mjs.map` is now emitted and `dist-server` is in the
  package's `files` list, so the published tarball grows by roughly 188 KB
- `vp pack`'s default externalization is not what this project needs, so
  `deps.neverBundle: true` is required and easy to remove by accident

### Follow-up Notes

- Do not remove `deps.neverBundle: true`. Without it, `import("vite")` is
  inlined into the published server bundle. A quick check after any build
  config change: `grep -c 'vite/dist/node' dist-server/index.mjs` should be `0`.
- Decide deliberately whether the server sourcemap should ship in the npm
  package. If bundle size matters more than server-side stack traces, either
  disable `sourcemap` or exclude `*.map` from the `files` list.
- This ADR records the bundler decision. The decision to accept a release
  candidate toolchain is a consequence of aligning with the global `vp`; if a
  stable `1.0.x` release lands, move to it and reduce that risk.
- The Vitest pin is now managed by `vp migrate` rather than pinned directly in
  `package.json`. After any `vite-plus` upgrade, re-run `vp migrate` so the
  bundled runner and the project's pin stay in step.
