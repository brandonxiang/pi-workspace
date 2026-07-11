# ADR-001: Represent Pi Session Views in the URL

## Status

Accepted

## Date

2026-07-04

## Context

Pi Agent Desktop already supported two important pieces of session-oriented UI:

- browsing and selecting Pi Sessions from the sidebar
- switching the active right-hand panel between chat mode and terminal mode

Before this change, those choices lived mostly in client state and `localStorage`.
That created a few problems:

- the address bar did not show which Pi Session the Workspace Operator was viewing
- refreshing the page depended on stored state rather than an explicit route
- browser back/forward did not restore session and panel state consistently
- sharing or bookmarking a specific Pi Session view was awkward

We wanted a minimal routing system that fits the existing single-page app without
adding a full routing framework or changing the Fastify server architecture.

## Decision

Use a lightweight client-side routing model based on the browser History API.

- represent the selected Pi Session in the pathname:
  - `/sessions/:sessionId`
- represent the active panel mode in the query string:
  - `?panel=chat`
  - `?panel=terminal`
- keep route parsing and URL construction in a small dedicated client helper
- hydrate the current panel mode from the URL when present, otherwise fall back
  to stored preference
- handle browser `popstate` through the same guarded Pi Session selection flow
  used by normal UI interactions

This keeps session identity as the primary route resource while treating chat vs.
terminal as orthogonal view state.

## Alternatives Considered

### Add `react-router`

- Pros:
  - familiar route primitives
  - straightforward growth path for more route types later
- Cons:
  - adds a dependency for a very small route surface
  - introduces more abstraction than the current app needs
- Rejected:
  - the app only needs a small number of route shapes today, and native history
    is simpler to fit into the existing `App.tsx` orchestration

### Keep using only `localStorage`

- Pros:
  - no new route model
  - lowest implementation effort
- Cons:
  - state remains invisible in the URL
  - refresh/back-forward behavior stays inconsistent
  - session views are not directly linkable
- Rejected:
  - it does not meet the product need of making the active Pi Session explicit

### Encode both session and panel mode entirely in the pathname

- Pros:
  - a single route string contains all state
- Cons:
  - panel mode is not a first-class resource; it is a presentation choice
  - path variants become noisier than necessary
- Rejected:
  - using the query string keeps the route easier to read and extend

## Consequences

### Positive

- Pi Session views are now addressable and bookmarkable
- refresh and browser history can restore the same working context
- route helpers are isolated and easy to test
- no new runtime dependency is required

### Negative

- `App.tsx` now owns more navigation orchestration and needs careful test
  coverage around hydration and `popstate`
- URL synchronization introduces more chances for state/history drift if future
  changes bypass the shared selection flow

### Follow-up Notes

- Explicit session routes should remain authoritative for the current tab
- If more route types are added later, revisit whether the native History API is
  still the simplest fit or whether a router starts earning its weight
