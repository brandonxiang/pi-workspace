# ADR-006: Discover Models from Local Pi Extension Providers

## Status

Accepted

## Date

2026-10-12

## Context

The model list at `GET /api/models` and the model a session runs on were both
resolved through `createLocalModelRegistry()` in `server/utils/auth.ts`. That
function built a `ModelRuntime` and wrapped it in a `ModelRegistry`, so model
discovery covered:

- Pi's built-in provider catalog and `~/.pi/agent/models.json` (via
  `ModelRuntime.create()`)
- the hardcoded Command Code provider registered in the same file

It did **not** cover providers declared by local Pi extensions. Pi itself loads
those extensions and replays their `pi.registerProvider(...)` calls, so a user
with a locally configured gateway (for example
`~/.pi/agent/extensions/ais-switch.ts`, which registers an `ais-switch`
provider exposing `llm-gateway--*` models) sees those models in the Pi CLI but
not in pi-workspace. The Workspace Operator's own machine had exactly this
mismatch: `pi` listed the gateway models, `pi-workspace` did not.

The server already declined to load extensions for agent sessions.
`buildResourceLoader()` in `server/utils/helpers.ts` returns a stub with empty
extensions, skills, prompts, and themes, in line with the project rule that
default online sessions must not enable shell or file-mutation tools. Any change
had to add provider discovery without re-enabling those tools.

## Decision

Replay extension-declared provider registrations into the `ModelRuntime` that
pi-workspace builds for both model discovery and sessions. The new
`server/utils/extension-providers.ts`:

1. Loads extensions with `DefaultResourceLoader` configured with
   `noSkills: true`, `noPromptTemplates: true`, `noThemes: true`, and
   `noContextFiles: true`, so only extension code that declares providers is
   relevant.
2. Calls `reload({ resolveProjectTrust: async () => false })`. The server has no
   trust prompt, so it must not execute project-local extension code from an
   arbitrary working directory. User-level extensions and installed Pi packages
   still load.
3. Collects `pendingProviderRegistrations`,
   `pendingNativeProviderRegistrations`, and `pendingVirtualModelRegistrations`
   from the loader runtime, then replays them with
   `ModelRuntime.registerProvider`, `registerNativeProvider`, and
   `registerVirtualModel`.
4. Caches the collected registrations for the process lifetime, because an
   extension factory may fetch a live model catalog. A failed load is not
   cached, so the next request retries.

`createLocalModelRegistry()` calls `registerExtensionProviders(modelRuntime)`
after runtime auth is configured and logs any per-extension registration errors.
The session resource loader is untouched, so agent tools remain disabled.

## Alternatives Considered

### Pass the real `DefaultResourceLoader` into `createAgentSession`

- Pros:
  - the canonical Pi wiring; extensions, skills, and prompts all behave as they
    do in the CLI
- Cons:
  - it enables extension-declared tools for online sessions, contradicting the
    project rule that default sessions must not expose shell or file mutation
- Rejected:
  - model discovery does not require the agent-side resource loader; keeping them
    separate preserves the tool restriction

### Read `~/.pi/agent/extensions/` directly

- Pros:
  - no dependency on `DefaultResourceLoader`, and no project trust question
- Cons:
  - skips Pi packages (`npm:` sources in `settings.json`), which are also a
    supported provider source
  - reimplements jiti loading, path resolution, and `models.json` layering that
    the SDK already provides
- Rejected:
  - it duplicates SDK behavior and would silently miss packaged providers

### Ask the user to add the gateway to `models.json`

- Pros:
  - no code change; `ModelRuntime.create()` already reads that file
- Cons:
  - the user already configured the provider once for the Pi CLI; requiring a
    second, duplicative configuration in a different file is exactly the
    mismatch this ADR is meant to remove
- Rejected:
  - it treats a product gap as user error

## Consequences

### Positive

- `GET /api/models` and session model resolution now include locally
  configured gateway providers, matching the Pi CLI
- Provider discovery stays separate from agent resources, so the no-tools rule
  for default sessions still holds
- Extension loading is cached, so repeated session creation does not re-run
  network-bound extension factories

### Negative

- Extension factories execute inside the pi-workspace server process. This is
  the same trust model as the Pi CLI — extensions are trusted local code — but
  the server has no per-extension consent UI, so only user-level extensions and
  packages are loaded, never project-local ones
- The discovered model catalog is cached until the server restarts. A provider
  that changes its catalog live (for example a gateway coming online) will not
  be reflected until then
- Only provider, native-provider, and virtual-model registrations are replayed.
  Other extension capabilities (tools, commands, event handlers) are
  deliberately ignored

### Follow-up Notes

- If a reload endpoint is added, call `clearExtensionProviderCache()` from it so
  `/api/models` can pick up catalog changes without a restart.
- Do not feed the extension loader back into `buildResourceLoader()`. Doing so
  would re-enable extension tools for online sessions; see ADR context above.
- Registration failures are logged and skipped rather than failing the request,
  so a broken extension cannot take down `/api/models`.
