# Pi Agent Desktop

Pi Agent Desktop is a desktop client for Pi Agent. It exists to provide a dedicated surface for agent dialogue, session management, and local workspace collaboration.

## Language

**Pi Agent Desktop**:
The product built in this repository: a desktop client for Pi Agent. Treat this as the product name and primary framing, not merely a description of the implementation.
_Avoid_: browser-based agent dialogue tool, web UI

**Pi Agent**:
The underlying agent experience that Pi Agent Desktop presents to the user. Use this term for the agent itself, distinct from the desktop client that hosts it.
_Avoid_: the app, the desktop version

**Workspace Operator**:
The primary user of Pi Agent Desktop: a developer or technical operator working inside a local project workspace. This user works through agent dialogue, session management, terminal interaction, and local project context rather than general-purpose consumer chat.
_Avoid_: end user, chatter, customer

**Session**:
The primary unit of work in Pi Agent Desktop. A session is the conversation and operating context the Workspace Operator is currently working through.
_Avoid_: chat, thread

**Local Session**:
A session created, stored, and managed by Pi Agent Desktop itself. Use this term when the session's source of truth is the app.
_Avoid_: normal session, app chat

**Pi Session**:
A session whose source of truth comes from Pi session storage or an external Pi runtime. Use this term when the app is presenting or operating on Pi-owned session history.
_Avoid_: remote session, imported chat

**Workspace**:
The top-level operating context in Pi Agent Desktop. A workspace contains the local project environment that sessions, terminal activity, and agent collaboration are anchored to.
_Avoid_: repo, folder, project path

**Active Context Header**:
The compact header that identifies the current working object and its minimal stable context. In Pi Agent Desktop this header primarily names the active Session and secondarily shows its Workspace, rather than acting as a dense action bar.
_Avoid_: navbar, toolbar, top chrome

## Navigation State

Pi Agent Desktop uses a lightweight client-side route model for Pi Session views.

- `/sessions/:sessionId` identifies the active Pi Session.
- `panel=chat|terminal` identifies the active right-panel mode.
- Session identity belongs in the pathname because it is the primary working
  resource.
- Panel mode belongs in the query string because it changes presentation, not
  the underlying Session identity.

When discussing or extending navigation, preserve that distinction unless a new
ADR intentionally changes it.
