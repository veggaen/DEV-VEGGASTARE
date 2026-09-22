# Veggat

A full-stack marketplace for digital products, with seller tools, community discussions, and multi-provider AI chat.

[Live app](https://www.veggat.com) · [Architecture](architecture.md) · [Frontend setup](frontend/README.md)

The live deployment currently has a private-testing access gate. The showcase is being validated; payment, delivery, and paid AI-credit flows are not yet presented as production-certified. Automated QA credentials are private and are never published here.

## Architecture

```text
Browser → Next.js / Auth.js (Vercel) → PostgreSQL (Prisma)
                      ├→ AI providers / payment integrations
                      ├→ Pusher realtime events
                      └→ Hapi integration API (Railway)
```

| Area | Technology |
| --- | --- |
| Web application | Next.js 16, React 19, TypeScript |
| Interface | Tailwind CSS, Radix, Framer Motion |
| Identity | Auth.js, OAuth, password authentication |
| Data and integrations | PostgreSQL, Prisma, Hapi |
| Validation | Vitest, Playwright, TypeScript |
| Operations | Vercel, Railway, Web Analytics, Speed Insights |

## Engineering decisions

- **Separate integration service:** Hapi keeps shipping and warehouse integrations independent of the Next.js client.
- **Server-authoritative access:** authentication, ownership checks, and AI entitlement checks run on the server. The model picker is not an authorization boundary.
- **Progressive loading:** route-specific skeletons, lazy feature modules, image prioritization, and a lightweight gate reduce work before visitors can interact.
- **Privacy-aware measurement:** optional telemetry follows the analytics preference, strips URL query parameters, and masks private conversation identifiers.

## Run locally

Install dependencies in `frontend` and `backend`, copy their environment templates where available, and supply your own development credentials. Never copy production data or secrets into a public demo.

```sh
npm install
npm install --prefix frontend
npm install --prefix backend
npm run dev
```

Set `frontend/.env.local` from `frontend/.env.example`. Keep `AUTH_URL` aligned with the local port, normally `http://localhost:3000`; register the matching callback URL in each OAuth application. A production URL in local configuration breaks OAuth cookie verification.

## Validation

```sh
cd frontend
npm run test:unit
npx tsc --noEmit
npm run build
npm run test:e2e
```

Playwright's consolidated suite covers routing, public content, API shapes, and user journeys. Authenticated checks require dedicated test credentials; external-provider and sandbox-payment checks need configured services. Passing unit tests alone does not prove checkout or paid-credit safety.

## Showcase scope

Lead with the marketplace: browse a product, inspect the seller experience, and explain the integration architecture. AI chat and Pulse demonstrate additional work on streaming and realtime interaction. Trading, wallet flows, and paid AI credits remain experimental until their security and end-to-end acceptance checks are complete.
