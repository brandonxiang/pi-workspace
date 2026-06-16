# pi-gui

`pi-gui` is a web-based agent conversation console built on the
`@earendil-works/pi-coding-agent` SDK. It provides a browser UI while keeping
model credentials and the Pi agent session runtime on the server.

## Features

- Online chat interface for Pi-powered agent conversations
- Server-side `createAgentSession()` integration from `@earendil-works/pi-coding-agent`
- Streaming assistant responses over Server-Sent Events
- Model selector for common OpenAI, Anthropic, Google, Mistral, and Command Code models
- Editable system prompt
- Browser-side conversation transcript persistence
- Server-side model auth through local Pi and Command Code login state

## Quick Start

```bash
npm install
npm exec -- pi-gui
```

If you already use Pi locally, the server reads your existing Pi auth from
`~/.pi/agent/auth.json` and custom models from `~/.pi/agent/models.json`.
It also detects Command Code CLI login credentials from
`~/.commandcode/auth.json`.

When Command Code auth is present, the server fetches live models from
`https://api.commandcode.ai/provider/v1/models` and registers them under the
`commandcode` provider.

If you want to customize the server port, you can still create a local `.env`
from `.env.example` and change `PORT`.

Start the packaged service:

```bash
npm exec -- pi-gui
```

Open <http://127.0.0.1:8787>.

Useful CLI commands:

```bash
npm exec -- pi-gui        # start the built service
npm exec -- pi-gui build  # build client + server bundles
npm exec -- pi-gui --help # show all options
```

## npm Packaging

`pi-gui` is set up as a publishable npm CLI package:

- `npm publish` runs `prepack`, which builds `dist/client` and `dist-server`
- the published tarball includes only the CLI entrypoint and built runtime assets
- `pi-gui` starts the bundled production server directly from `dist-server/index.mjs`

## Production

```bash
npm run build
npm start
```

The production server listens on `PORT` or `8787` and serves both the API and
the built frontend.

## Architecture

- `src/` contains the React conversation UI.
- `server/index.ts` owns the Pi Coding Agent SDK integration.
- The frontend sends only the latest user prompt and session metadata.
- The backend keeps a per-browser-session `AgentSession` in memory and streams
  `message_update` deltas back to the browser.
- `AuthStorage.create()` and `ModelRegistry.create()` load the same local auth
  and model registry that the Pi CLI uses.

By default the server starts Pi sessions with `noTools: "all"` so the online
chat cannot execute shell or file mutation tools. Add a deliberate tool allowlist
only after adding authentication and permission controls.

## Attribution

This project is customized from the public Pi ecosystem by Earendil Works:
<https://github.com/earendil-works/pi>.
