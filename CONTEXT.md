# pi-workspace

pi-workspace is a local workspace for Pi Agent sessions. It runs as a CLI on the
Workspace Operator's own machine and serves its UI in the browser, so agent
dialogue, session history, and terminal work all sit around the same Session and
Workspace.

## Language

**pi-workspace**:
The product built in this repository, shipped as the `pi-workspace` npm package
and CLI. Treat this as the product name and primary framing, not merely a
description of the implementation.
_Avoid_: Pi Agent Desktop, browser-based agent dialogue tool, web UI

**Pi Agent**:
The underlying agent experience that pi-workspace presents to the user. Use this
term for the agent itself, distinct from the workspace that hosts it.
_Avoid_: the app, the desktop version

**Workspace Operator**:
The primary user of pi-workspace: a developer or technical operator working
inside a local project workspace. This user works through agent dialogue,
session management, terminal interaction, and local project context rather than
general-purpose consumer chat.
_Avoid_: end user, chatter, customer

**Session**:
The primary unit of work in pi-workspace. A session is the conversation and
operating context the Workspace Operator is currently working through.
_Avoid_: chat, thread

**Pi Session**:
A session whose source of truth comes from Pi session storage or an external Pi
runtime. This is the Session surface the UI presents: the sidebar lists Pi
Sessions, and the app reads and operates on Pi-owned session history.
_Avoid_: remote session, imported chat

**Local Session**:
A session created, stored, and managed by pi-workspace itself. Still supported
server-side when a request carries no Pi Session id, but no longer a surface the
UI offers, because Pi Sessions are now the only Session kind a Workspace
Operator selects.
_Avoid_: normal session, app chat

**Workspace**:
The top-level operating context in pi-workspace. A workspace contains the local
project environment that sessions, terminal activity, and agent collaboration
are anchored to.
_Avoid_: repo, folder, project path

**Active Context Header**:
The compact header that identifies the current working object and its minimal
stable context. In pi-workspace this header primarily names the active Session
and secondarily shows its Workspace, rather than acting as a dense action bar.
It is rendered as the `chat-header` element in `client/App.tsx`, where the title
carries the Session and the meta line carries the Workspace.
_Avoid_: navbar, toolbar, top chrome

## Navigation State

pi-workspace uses a lightweight client-side route model for Pi Session views.

- `/sessions/:sessionId` identifies the active Pi Session.
- `panel=chat|terminal` identifies the active right-panel mode.
- Session identity belongs in the pathname because it is the primary working
  resource.
- Panel mode belongs in the query string because it changes presentation, not
  the underlying Session identity.

When discussing or extending navigation, preserve that distinction unless a new
ADR intentionally changes it.
