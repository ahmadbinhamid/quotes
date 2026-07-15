# Quotes

FlowPOS installable app for merchant price quotes.

Staff build a priced quote the same way they build an order (real FlowPOS
products/customers via the picker, not freeform text), send the customer a
unique link to view it, and the customer accepts or declines. An accepted
quote is then converted to a real FlowPOS order by staff, who generate a
payment link to send on for payment. Quotes auto-expire past their
`expires_at` date and can no longer be accepted/converted once expired.

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

- Tests.
- Product variant/addon selection in the quote form's product picker
  (products with variants are added as a single line at the base price).
