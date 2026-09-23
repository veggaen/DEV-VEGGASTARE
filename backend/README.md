# Backend — Integration Core

> Standalone Hapi.js shipping integration. Legacy warehouse writes/realtime are retired.

The backend isolates Bring shipping from the Next.js reference client. Current
HTTP handlers do not open the application database or publish Pusher events.
Warehouse mutations stay in the authenticated Next.js application. Do not enable
the old socket prototype until a scoped authorization protocol is implemented.

**Ports:** HTTP API on `3001`, WebSocket on `3002`

---

## Quick Start

```bash
cd backend
npm install
cp .env.example .env   # Configure your env vars (see below)
npm run dev             # Starts with nodemon + ts-node
```

### Scripts

| Script | Command | Description |
|--------|---------|-------------|
| `dev` | `nodemon --watch src --ext ts --exec ts-node src/index.ts` | Hot-reload dev server |
| `build` | `tsc` | Compile TypeScript to `dist/` |
| `start` | `node dist/index.js` | Run production build |
| `test` | Build, then Node test runner | Endpoint retirement, socket refusal, mock shipping |

---

## Architecture

```
backend/
├── src/
│   ├── index.ts              # Hapi server init + CORS + env detection
│   ├── routes.ts             # All /v1/* routes (health, shipping, warehouse, pusher)
│   ├── websocket.ts          # Socket.IO server (port 3002)
│   ├── pusher.ts             # Pusher event trigger utility
│   ├── db.ts                 # Prisma client (optional, for warehouse ops)
│   ├── updateWarehouseInventory.ts  # Warehouse stock update logic
│   ├── integrations/         # External service connectors
│   │   └── bring.ts          # Bring shipping provider (mock + live)
│   ├── socket/               # Socket.IO event handlers
│   └── utils/                # Shared helpers
├── prisma/
│   └── schema.prisma         # Backend Prisma schema
├── openapi/
│   └── v1.yaml               # OpenAPI 3.0 spec
├── Dockerfile                # Railway deployment
├── railway.toml              # Railway config
└── package.json
```

---

## Tech Stack

| Component | Version | Purpose |
|-----------|---------|---------|
| **Hapi.js** | ^21.3.10 | HTTP server framework |
| **Socket.IO** | ^4.7.5 | WebSocket server (warehouse real-time sync) |
| **Prisma Client** | ^6.16.3 | Database ORM |
| **Pusher** | ^5.2.0 | Event broadcasting to frontend |
| **Zod** | ^4.3.6 | Runtime input validation |
| **TypeScript** | ^5.5.4 | Type safety |
| **ws** | ^8.18.0 | Low-level WebSocket (fallback) |

---

## API Surface

All routes are prefixed with `/v1/`. Full spec in [openapi/v1.yaml](openapi/v1.yaml).

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/v1/health` | Health check (`{ ok, service, time }`) |
| `POST` | `/v1/shipping/rates` | Get shipping rate options (Bring or mock) |
| `GET` | `/v1/shipping/postal-codes/suggestions` | Postal code autocomplete |
| `POST` | `/api/update` | Retired; 410, no database mutation |
| `POST` | `/api/pusher-trigger` | Retired; 410, no broadcast |

Preferred surface is `/v1/*`. Retired routes always fail closed, including when
database/Pusher credentials exist or requests supply an allowed Origin header.

### Input Validation

All request payloads are validated with Zod schemas:
- `shippingRatesSchema` — from/to postal codes, packages (dimensions/weight), language, customer number
- `postalSuggestionsSchema` — query string, country code, page number

---

## Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `PORT` | No | `3001` | HTTP server port |
| `WS_PORT` | No | `3002` | WebSocket server port |
| `NODE_ENV` | No | `development` | Environment mode |
| `BRING_MODE` | No | `mock` | `mock` for demo data, `live` for real Bring API |
| `BRING_API_UID` | Live only | — | Bring API user ID |
| `BRING_SHIPPING_API_KEY` | Live only | — | Bring API key |
| `BRING_CLIENT_URL` | No | `localhost` | Client URL for Bring headers |
| `DATABASE_URL_MAINLIVE` | No | — | Legacy module only; not used by current HTTP/socket handlers |
| `PUSHER_APP_ID` | No | — | Pusher app ID |
| `PUSHER_KEY` | No | — | Pusher key |
| `PUSHER_SECRET` | No | — | Pusher secret |
| `PUSHER_CLUSTER` | No | — | Pusher cluster |
| `CORS_ORIGINS` | Prod only | `*` | Comma-separated allowed origins |
| `LOG_REQUESTS` | No | `0` | Enable request logging (`1` to enable) |

---

## Bring Shipping Integration

### Mock Mode (default)
Returns realistic demo responses without Bring credentials. Useful for development, demos, and template showcasing.

### Live Mode
Proxies requests to Bring's real API. Requires `BRING_API_UID` and `BRING_SHIPPING_API_KEY`.

### Test Resources (Bring)
- Test customer numbers: `"5"`, `"6"`, `"7"` for dummy pricing
- Test tracking number: `TESTPACKAGEDELIVERED`
- Bring web demos: Shipping Guide demo, Checkout tool

---

## WebSocket Events

The old server on port 3002 refuses both polling and WebSocket handshakes.
It no longer accepts client-triggered database reads or broadcasts inventory to
public listeners. CORS alone is not authentication. Frontend Pusher features are
separate and must enforce their own data-access boundaries.

---

## Deployment

Deployed on **Railway** using the `Dockerfile`. The `railway.toml` configures the build and start commands.

Production considerations:
- Set `NODE_ENV=production`
- Configure `CORS_ORIGINS` to whitelist frontend domains
- Keep `BRING_MODE=mock` for the showcase unless live shipping access controls,
  provider limits and credentials have been separately verified.
- No database/Pusher credentials are needed by the current backend runtime.

---

## Connection to Frontend

The frontend (`frontend/`) communicates with this backend via:

1. **HTTP** — Server actions and API routes call `/v1/*` endpoints
2. **Socket.IO** — Legacy backend path paused; no active frontend caller found
3. **Pusher** — Active application events are published by Next.js, not this service

> See [frontend/README.md](../frontend/README.md) for the frontend side of this integration.

### Demo endpoints

- `GET /v1/health`
- `POST /v1/shipping/rates`
- `GET /v1/shipping/postal-codes/suggestions?countryCode=no&q=0951`
- `GET /v1/shipping/tracking/TESTPACKAGEDELIVERED`

## Development

- `npm install`
- `npm run dev` (Hapi on `3001`, Socket.IO on `3002` by default)
