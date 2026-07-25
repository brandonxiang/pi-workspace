# ADR-002: Pi Session Status State Machine

## Status

Accepted

## Date

2026-07-11

## Context

Pi Sessions are the core unit of work in Pi Agent Desktop. Users needed a
lightweight way to track the lifecycle of a conversation — whether the agent
had produced a response, whether that response was ready for human review, and
which sessions were finished.

The sidebar showed every session uniformly, making it hard to tell at a glance
which sessions were active, awaiting review, or complete. Users wanted visual
cues (emoji indicators) and the ability to manually mark a session as done.

At the same time, the system needed to automatically advance session state
based on agent activity:

- when the agent starts processing a prompt, the session becomes in-progress
- when the agent finishes, the session enters pending-review

## Decision

Introduce a four-state lifecycle model for Pi Sessions, stored in an
independent JSON file on disk.

### States

```
🆕 initializing    — session created, no messages yet (default)
🔄 in_progress     — agent is currently processing a prompt
👀 pending_review  — agent finished, response ready for human review
✅ completed       — user manually marked the session as done
```

### Storage

Statuses are stored in a lightweight JSON file at
`~/.pi/agent/session-status.json`, separate from the Pi SDK's session files:

```json
{
  "version": 1,
  "statuses": {
    "<session-uuid>": "pending_review",
    "<session-uuid>": "completed"
  }
}
```

Sessions not present in the file default to `initializing` (no messages) or
`pending_review` (has messages). This means most sessions with history show
as awaiting review unless explicitly marked `completed`.

### Transitions

**Automatic (server-side):**

| Trigger                             | New Status       |
| ----------------------------------- | ---------------- |
| User sends a prompt to the agent    | `in_progress`    |
| Agent finishes producing a response | `pending_review` |

The automatic transitions are unconditional — they apply regardless of the
current status. This means a `completed` session temporarily becomes
`in_progress` while the agent works, then settles at `pending_review`.

**Manual (client-side, via sidebar dropdown):**

| From             | To          | Menu Label        |
| ---------------- | ----------- | ----------------- |
| `pending_review` | `completed` | ✅ Mark completed |

Only one manual action exists: mark a reviewed session as done. The
`completed` state is purely user-driven; the system never auto-sets it.

### UI

- Each session row in the sidebar shows its status emoji before the title
- The three-dot dropdown shows status-relevant menu items only when
  a transition is available (no divider or empty group otherwise)
- AI start and completion both trigger a project list refresh on the client
  so the emoji updates without user action

### Server API

```
PATCH /api/pi-sessions/:sessionId/status
Body: { status: "completed" }
```

This endpoint validates the transition via `isValidStatusTransition()` and
rejects illegal moves (e.g. `initializing → completed`) with a 400 status.

## Alternatives Considered

### Store status inside the Pi SDK session files

- Pros:
  - single source of truth per session
- Cons:
  - requires modifying `@earendil-works/pi-coding-agent` internals
  - the SDK does not expose a generic key-value metadata API
- Rejected:
  - keeping status in a sidecar file decouples from SDK version changes

### Client-only state (localStorage)

- Pros:
  - simplest to implement
  - no server changes needed
- Cons:
  - status lost on clear cache / different device
  - not suitable if multi-client access is needed later
- Rejected:
  - persistence should survive cache clears and local state resets

### Finite state machine with validated transitions

- Pros:
  - prevents illegal moves at the API level
  - clear, documented state graph
- Cons:
  - more code than a free-form string field
  - lifecycle transitions bypass validation (they must always succeed)
- Chosen:
  - the validation is limited to manual PATCH requests; lifecycle updates
    call `setSessionLifecycleStatusDefault()` which unconditionally writes
    the target status

## Consequences

### Positive

- Session lifecycle is immediately visible in the sidebar
- Status persists across page refreshes and restarts
- Automatic transitions keep the state accurate without user effort
- Manual `completed` status gives a simple "done" signal
- No SDK changes required

### Negative

- A separate status file means two locations to back up or migrate
- Race window: if two AI responses complete near-simultaneously for the
  same session, the second `setSessionLifecycleStatusDefault` overwrites
  the first — acceptable because both target the same `pending_review`

### Follow-up Notes

- If multi-device sync or sharing is needed later, the status file could
  move to a shared store or be embedded in the Pi SDK session format
- Consider adding a status badge count in the sidebar header
  (e.g. "3 pending review")
