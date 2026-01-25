# Backend: Integration Core (Service)

This `backend/` folder is intended to be a standalone service that other apps/frameworks can integrate with.

## What this service is for

- Shipping integrations (Bring first, more carriers later)
- Warehousing updates + realtime broadcasts (Socket.IO + optional Pusher)
- A stable, versioned API surface for third parties (`/v1/...`)

The Next.js app in `frontend/` should behave like a **reference client**: it consumes this service just like an external integrator would.

## Bring testing + demo mode

Bring APIs require authentication even for testing. However, Bring provides testing resources:

- Test customer numbers (commonly `"5"`, `"6"`, `"7"`) to return dummy data.
- Test tracking numbers like `TESTPACKAGEDELIVERED`.
- Bring also provides web-based demo tools (Shipping Guide demo, Checkout tool) useful for showcasing.

This repo supports a template-friendly demo mode:

- `BRING_MODE=mock` (default): returns demo responses without Bring credentials.
- `BRING_MODE=live`: proxies to Bring APIs using credentials.

### Environment variables

- `BRING_MODE` = `mock` | `live`
- `BRING_API_UID` and `BRING_API_KEY` (required for live mode)
- `BRING_CLIENT_URL` (optional; defaults to localhost in dev)

## API

OpenAPI draft: see `openapi/v1.yaml`.

### Demo endpoints

- `GET /v1/health`
- `POST /v1/shipping/rates`
- `GET /v1/shipping/postal-codes/suggestions?countryCode=no&q=0951`
- `GET /v1/shipping/tracking/TESTPACKAGEDELIVERED`

## Development

- `npm install`
- `npm run dev` (Hapi on `3001`, Socket.IO on `3002` by default)
