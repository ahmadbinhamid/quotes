# Quotes

FlowPOS installable app for merchant price quotes.

**This is a scaffold, not a finished app.** Quotes business logic (creating,
editing and sending quotes, line items, pricing, etc.) is not implemented
yet — only the infrastructure needed to install this app from the FlowPOS
marketplace and embed it in the tenant dashboard.

## Architecture

- **Backend** (`backend/`) mirrors [`ai-builder`](../ai-builder)'s
  install/uninstall/webhook lifecycle: a Go + Gin service with HMAC-signed
  `/install`, `/uninstall` and `/webhooks` routes at the public root, and a
  JWT-protected `/api/v1/*` for the app's own API. See `backend/internal/`
  for the handler/auth/service/model layout.
- **Frontend** (`frontend/`) mirrors [`appointments`](../appointments)'
  tooling: Vite + React 19 + Tailwind v4, using the shared
  `@flowposltd/{ui,design-tokens,apps-sdk}` packages from the sibling
  `flowpos-ui` workspace. Unlike `appointments`, it actually wires up
  `@flowposltd/apps-sdk` (handshake, theme sync, auto-resize and auth
  handoff with the tenant-dashboard iframe host — see
  `frontend/src/app/use-embed.ts`).

## Local development

```bash
cp .env.example .env   # fill in FLOWPOS_SIGNING_SECRET / JWT_SECRET for real use

cd frontend
npm install
npm run dev             # runs the Vite dev server + `go run` backend together
```

Or via Docker:

```bash
docker compose up --build
```

Ports are offset from `ai-builder`'s (backend `8082`, frontend `3001`, mysql
`3308`, phpMyAdmin `8083`) so both stacks can run side by side.

## What's not here yet

- Any quotes domain model beyond the `Installation` lifecycle record.
- Real `/api/v1` routes beyond `/me`.
- Tests.
