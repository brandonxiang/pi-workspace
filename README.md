# pi-workspace

**Your Pi sessions, in one focused workspace.**

`pi-workspace` is a local workspace for Pi Agent sessions. It keeps the three
surfaces you use most — agent dialogue, session history, and a live terminal —
around the same Session and Workspace, so you stay with the work instead of
switching between windows.

It runs on your machine, binds to `127.0.0.1`, and uses the Pi credentials,
models, and session history you already have.

[![npm version](https://img.shields.io/npm/v/pi-workspace.svg)](https://www.npmjs.com/package/pi-workspace)

## Highlights

| Surface         | What it gives you                                                                                                        |
| --------------- | ------------------------------------------------------------------------------------------------------------------------ |
| **Dialogue**    | Streaming responses, multi-turn conversations, image attachments for vision models, and model selection                  |
| **Sessions**    | Browse local Pi session history, resume any session, and deep-link straight back to it                                   |
| **Terminal**    | A full xterm.js terminal whose shell starts in the Session's Workspace with the `pi` CLI already pointed at that session |
| **Local-first** | Reads your existing Pi auth and models; the server listens on `127.0.0.1` only                                           |

### Chat mode

The default view. The right-hand panel is a conversational chat interface with
streaming assistant responses, multi-turn conversations, image attachment, and
model selection. Pi session history from your local `~/.pi/agent/sessions/` is
listed in the sidebar — select any session to browse its full message history
and continue the conversation.

- Streaming assistant responses over Server-Sent Events
- Model selection across every provider your Pi setup exposes
- Editable system prompt
- Image attachments, validated against the model's declared capabilities
- Pi session browsing, creation, and continuation
- Deep-linkable views such as `/sessions/<sessionId>?panel=chat`

### Terminal mode

Switch the right-hand panel to a full web terminal. A shell starts in the
selected Pi session's project directory and launches the `pi` CLI into that
session.

- xterm.js with a VS Code-inspired dark theme
- Auto-fit to the panel size
- Server-side PTY via `node-pty`, transported over WebSocket
- Deep-linkable views such as `/sessions/<sessionId>?panel=terminal`

Switch between them in **Settings → Mode → Chat mode / Terminal mode**.

## Quick start

```bash
npm install -g pi-workspace
pi-workspace
```

Then open <http://127.0.0.1:8787>.

```bash
pi-workspace --help    # show all options
pi-workspace update    # upgrade to the latest release
pi-workspace check     # check whether a newer release exists
```

### Use your existing Pi setup

There is nothing to configure if you already use Pi locally. The server reads:

| Source                     | Provides                                   |
| -------------------------- | ------------------------------------------ |
| `~/.pi/agent/auth.json`    | Pi credentials                             |
| `~/.pi/agent/models.json`  | Custom model definitions                   |
| `~/.pi/agent/sessions/`    | Pi session history                         |
| `~/.commandcode/auth.json` | Command Code CLI credentials, when present |

When Command Code credentials are found, the server fetches live models from
`https://api.commandcode.ai/provider/v1/models` and registers them under the
`commandcode` provider. Provider keys can also be supplied through `.env` as
runtime overrides.

To change the port, create a `.env` from `.env.example` and set `PORT`:

```bash
cp .env.example .env
```

## Development

```bash
pnpm install
pnpm run dev      # dev server with hot reload
pnpm run check    # format, lint, and type checks
pnpm run test     # unit and integration tests
pnpm run build    # typecheck, then build client and server
pnpm start        # run the production build
```

## Architecture

The UI and the API are served from a single process on a single port.

- `client/` — React UI, built with Vite and Ant Design X.
- `server/index.ts` — wires API routes to the HTTP layer and owns the Pi
  Coding Agent SDK integration.
- `server/http/` — the HTTP layer: routing, JSON body parsing, `reply` helpers,
  static file serving, and the SPA fallback.
- `shared/` — slash-command logic used by both client and server.

Some decisions that shape the code:

- **Navigation** uses the History API directly. `/sessions/:sessionId` carries
  Session identity in the pathname, and `panel=chat|terminal` carries panel mode
  in the query string. See
  [ADR-001](docs/adr/001-pi-session-routing.md).
- **Transport** is Server-Sent Events for dialogue deltas and a WebSocket for
  the terminal PTY. The backend holds one `AgentSession` per browser session and
  streams `message_update` deltas as they arrive.
- **HTTP** is a small in-repo layer rather than a framework, so API routes are
  matched ahead of the client-serving fallback by construction. See
  [ADR-003](docs/adr/003-replace-fastify-with-in-repo-http-layer.md).
- **The server bundle** is built with `vp pack` (tsdown). See
  [ADR-005](docs/adr/005-build-server-bundle-with-vp-pack.md).

## Security

Online sessions start with `noTools: "all"`, so chat cannot execute shell
commands or mutate files. The server binds to `127.0.0.1` and has no
authentication of its own, which makes it a local tool — do not expose the port
to a network you do not control.

Before enabling tools or remote access, add authentication, workspace isolation,
and permission prompts.

## Packaging and release

The npm package ships as a CLI that bundles both the API server and the
frontend:

- `pnpm release` runs the test and build checks, prompts for the next version,
  creates the release commit and Git tag, pushes them, and publishes to npm.
- Publishing runs `prepack`, which builds `dist/client` and `dist-server`.
- The tarball contains only the CLI entrypoint and built runtime assets.
- `pi-workspace` starts the bundled server directly from `dist-server/index.mjs`.

## Documentation

- [CONTEXT.md](CONTEXT.md) — the project's domain vocabulary.
- [docs/adr/](docs/adr/) — architecture decision records.

## Attribution

Built on the public Pi ecosystem by Earendil Works:
<https://github.com/earendil-works/pi>.
