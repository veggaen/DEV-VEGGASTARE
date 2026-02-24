# Multi-Provider AI Chat with Free Tiers + BYOK

> **Stack assumed:** Next.js (App Router), TypeScript, Tailwind, Prisma, NextAuth/Auth.js. Adapt as needed.

---

## What to build

A streaming AI chat API route (`/api/ai-chat`) with a **three-tier access model**:

| Tier | Who | How it works |
|------|-----|-------------|
| **Free** | Everyone (even anonymous) | Platform pays — you store API keys for free providers (Google Gemini, Groq, Grok/xAI) in env vars. Users pick a model and chat for free. |
| **Premium** | Paying users / owner | Platform pays with your OpenAI / Anthropic keys, but only for users who bought a credit pack or have a subscription. |
| **BYOK** | Anyone with their own key | User pastes their own API key for *any* provider. It gets used instead of yours. Optionally "remember" it encrypted in the DB for future sessions. |

---

## Architecture overview

### 1. Model catalog (`lib/ai-models.ts`)

Create a typed catalog of providers and models:

```ts
export type AiProvider = "OPENAI" | "ANTHROPIC" | "GOOGLE" | "GROQ" | "GROK" | "OPENROUTER";
export type AiProviderTier = "free" | "premium" | "byok-only";

export interface AiProviderDef {
  value: AiProvider;
  label: string;
  tier: AiProviderTier;        // determines which key resolution path to use
  freeAvailable: boolean;      // true = you provide a platform key at no cost
  getKeyUrl: string;           // link for the user to get their own key
  models: AiModelOption[];     // array of { value, label, description, isDefault, capabilities }
}
```

Populate it with real models. Example free-tier providers:
- **Google Gemini** — `gemini-2.5-flash` (default), `gemini-2.5-pro`
- **Groq** — `llama-3.3-70b-versatile` (default), `llama-3.1-8b-instant`
- **Grok (xAI)** — `grok-3` (default), `grok-3-mini`

Premium providers (your key, gated behind credits):
- **OpenAI** — `gpt-4o`, `gpt-4o-mini`, etc.
- **Anthropic** — `claude-sonnet-4`, `claude-opus-4`, etc.

BYOK-only:
- **OpenRouter** — one API key accesses every model

---

### 2. API route (`app/api/ai-chat/route.ts`)

The route handler does this:

```
1. Parse & validate request (Zod schema: messages[], provider, model, optional aiAuth)
2. Auth check — get session (NextAuth). Anonymous = limited to Google free tier only.
3. Safety checks — injection detection, rate limiting, message length caps
4. KEY RESOLUTION (the core logic):
   a. If aiAuth.mode === "one_time" → use the inline BYOK key. Optionally persist it.
   b. Else if user has a saved BYOK key for this provider → use it.
   c. Else if provider is free-tier (Google/Groq/Grok) → use your platform env key.
   d. Else if provider is premium (OpenAI/Anthropic) → check if user has credits → use platform key.
   e. Else → return 402 with "BYOK_REQUIRED" error and a link to get a key.
5. Call the resolved provider's API and stream the response back.
6. After completion — log usage, decrement credits if premium, increment quota.
```

**Key resolution pseudocode:**

```ts
let apiKey = "";
let costTier: "free" | "premium" | "byok" = "free";

// 1. Inline BYOK (client sent a key directly)
if (body.aiAuth?.mode === "one_time" && body.aiAuth.apiKey) {
  apiKey = body.aiAuth.apiKey;
  costTier = "byok";
  if (body.aiAuth.rememberKey) await upsertUserAiKey(userId, provider, apiKey);
}

// 2. Saved BYOK key from DB
if (!apiKey) {
  const saved = await getUserAiKeyForGeneration(userId, provider);
  if (saved?.apiKey) { apiKey = saved.apiKey; costTier = "byok"; }
}

// 3. Platform key fallback
if (!apiKey) {
  if (FREE_PROVIDERS.has(provider)) {
    apiKey = platformKeys[provider]; // your env var
  } else if (PAID_PROVIDERS.has(provider)) {
    if (!userHasPremiumAccess) return 402 "PREMIUM_REQUIRED";
    apiKey = platformKeys[provider];
    costTier = "premium";
  } else {
    return 402 "BYOK_REQUIRED";
  }
}
```

---

### 3. BYOK key storage (`lib/ai-key-store.ts`)

Two functions:
- `upsertUserAiKey({ userId, provider, apiKey })` — encrypts the key (AES-256-GCM with a `BYOK_ENCRYPTION_KEY` env var) and stores it in a `UserAiKey` table.
- `getUserAiKeyForGeneration({ userId, provider })` — fetches and decrypts.

Prisma model:

```prisma
model UserAiKey {
  id        String   @id @default(cuid())
  userId    String
  provider  String   // "OPENAI" | "ANTHROPIC" | etc.
  encKey    String   // AES-256-GCM encrypted API key
  iv        String   // initialization vector
  tag       String   // auth tag
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  user      User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@unique([userId, provider])
}
```

---

### 4. Daily quota system (`lib/daily-ai-quota.ts`)

For free-tier users, enforce a daily message limit (e.g., 50/day for free, 200/day for premium):
- `checkDailyQuota(userId)` → `{ allowed: boolean, remaining: number, resetAt: Date }`
- `incrementDailyUsage(userId)` → bumps the counter
- Reset at midnight UTC (use a `DailyAiUsage` table with a date column, or just an in-memory Map for MVP)

For anonymous users, use IP-based rate limiting (e.g., 10 messages/hour):

```ts
const anonBuckets = new Map<string, { count: number; resetAt: number }>();
```

---

### 5. Provider API calls

For each provider, build the appropriate fetch call:

- **Google Gemini** — `POST https://generativelanguage.googleapis.com/v1beta/models/{model}:streamGenerateContent?key={key}` with `{ contents: [...] }` format
- **OpenAI / Groq / Grok / OpenRouter** — all use the OpenAI-compatible chat completions format: `POST {baseUrl}/v1/chat/completions` with `stream: true`
  - OpenAI: `https://api.openai.com`
  - Groq: `https://api.groq.com/openai`
  - Grok: `https://api.x.ai`
  - OpenRouter: `https://openrouter.ai/api`
- **Anthropic** — `POST https://api.anthropic.com/v1/messages` with `stream: true`, `anthropic-version: 2023-06-01` header

Parse each provider's streaming format (SSE for OpenAI-compatible, chunked JSON for Gemini) and pipe it back as a standard text stream via `new ReadableStream()` + `TextEncoder`.

---

### 6. Frontend: Model selector + BYOK panel

Build a dropdown in your chat widget:
- Group providers by tier (Free / Premium / BYOK Only)
- Show a colored badge per tier
- Each provider expands to show its models
- A "Use your own key" button opens a BYOK input panel
- The BYOK panel: text input for the API key, provider selector, optional "Remember this key" checkbox
- When using BYOK, send it in the request body as `aiAuth: { mode: "one_time", apiKey, provider, rememberKey }`

---

## Env vars needed

```env
# Free tier (you pay, users get for free)
GOOGLE_API_KEY=...           # https://aistudio.google.com/apikey
GROQ_API_KEY=...             # https://console.groq.com/keys
GROK_API_KEY=...             # https://console.x.ai

# Premium tier (gated behind user credits)
OPENAI_API_KEY=...           # https://platform.openai.com/api-keys
ANTHROPIC_API_KEY=...        # https://console.anthropic.com/settings/keys

# BYOK encryption
BYOK_ENCRYPTION_KEY=...      # 32-byte hex string for AES-256-GCM

# Optional
PLATFORM_OWNER_EMAIL=...     # owner gets unlimited premium access
```

---

## Error codes your frontend should handle

| Code | Meaning | UX |
|------|---------|----|
| `RATE_LIMITED` | Anon hourly cap hit | Show "Sign in for more" |
| `QUOTA_EXCEEDED` | Authenticated daily cap | Show "Come back tomorrow or upgrade" |
| `PREMIUM_REQUIRED` | Tried a paid model without credits | Show "Buy credits or add your own key" |
| `BYOK_REQUIRED` | Provider needs user's own key | Show BYOK panel with link to get key |
| `CREDITS_EXHAUSTED` | Credit pack used up | Show "Buy more credits" |
| `AI_NOT_CONFIGURED` | Platform key missing | Show "Add your own key via BYOK" |
| `INVALID_API_KEY` | BYOK key rejected by provider | Show "Check your key" |

---

## Why this architecture works

- **Zero barrier to entry** — anyone can chat using Google/Groq/Grok for free, even without signing in
- **Monetization path** — premium models (OpenAI, Anthropic) are behind a paywall you control
- **BYOK as escape hatch** — power users bring their own key and unlock everything, at zero cost to you
- **Provider-agnostic** — adding a new provider = one catalog entry + one API call function
- **Secure** — BYOK keys encrypted at rest, never logged, never sent to other providers

---

## Getting started

Start with just **Google Gemini free tier + the BYOK flow**. Once that works end-to-end, layer on the other providers and the credit system.
