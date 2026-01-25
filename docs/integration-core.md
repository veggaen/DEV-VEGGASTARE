# Integration Core (v1) — Recommended Architecture

Goal: make the project sellable as a **template** and scalable as a **global integration service**.

## Recommendation

- `backend/` becomes the **Integration Core** (public API + connectors + webhooks + jobs).
- `frontend/` (Next.js) becomes the **reference client + admin UI**, consuming the backend.

This prevents vendor integration logic (Bring/UPS/DHL/etc) from being spread across Next route handlers.

## Minimal v1 API surface (start small)

### Shipping (providers)

1) **Rates**
- `POST /v1/shipping/rates`
- Inputs: origin/destination + package(s) + optional `customerNumber`
- Output: normalized rate options (`serviceCode`, `serviceName`, `price`)

2) **Postal code suggestions**
- `GET /v1/shipping/postal-codes/suggestions?countryCode=no&q=095&page=1`

3) **Tracking**
- `GET /v1/shipping/tracking/{trackingNumber}`

### Warehousing (your existing differentiator)

4) **Inventory update** (internal or partner-auth)
- `POST /v1/warehouses/{warehouseId}/inventory/{inventoryId}`
- Output: updated record + event emission

5) **Realtime events**
- Socket.IO event stream for UI dashboards
- Webhooks for external partner systems (later)

## Where things should live

### Backend owns
- Connector implementations (Bring now, others later)
- Database writes for shipping/warehouse lifecycle
- Webhooks, retries, queues, background tasks
- Stable versioning (`/v1`, `/v2`), API keys, rate limiting

### Next.js owns
- UI pages
- Auth/UI sessions
- Calling backend endpoints
- Optional small “BFF” routes only if you need to hide secrets from the browser

## Bring testing considerations (important)

Bring requires authentication even for testing.

To keep the template demoable:
- Default to **mock mode** (`BRING_MODE=mock`) so the UI works without credentials.
- Support **live mode** (`BRING_MODE=live`) for real Bring customers.

Bring testing resources you can use in live mode:
- Test customer numbers like `"5"`, `"6"`, `"7"` for dummy responses.
- Test tracking numbers like `TESTPACKAGEDELIVERED`.

See backend OpenAPI draft in `backend/openapi/v1.yaml`.
