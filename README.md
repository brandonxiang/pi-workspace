# My Pi Agent

My Pi Agent is a web-based agent conversation console built on the
`@earendil-works/pi-coding-agent` SDK. It provides a browser UI while keeping
model credentials and the Pi agent session runtime on the server.

## Features

- Online chat interface for Pi-powered agent conversations
- Server-side `createAgentSession()` integration from `@earendil-works/pi-coding-agent`
- Streaming assistant responses over Server-Sent Events
- Model selector for common OpenAI, Anthropic, Google, and Mistral models
- Editable system prompt
- Browser-side conversation transcript persistence
- Server-side API key handling

## Quick Start

```bash
npm install
cp .env.example .env
```

Set at least one provider key in `.env`, for example:

```bash
OPENAI_API_KEY=sk-...
```

Start the app:

```bash
npm run dev
```

Open <http://127.0.0.1:5173>.

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

By default the server starts Pi sessions with `noTools: "all"` so the online
chat cannot execute shell or file mutation tools. Add a deliberate tool allowlist
only after adding authentication and permission controls.

## Attribution

This project is customized from the public Pi ecosystem by Earendil Works:
<https://github.com/earendil-works/pi>.
