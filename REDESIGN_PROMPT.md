# Portable Redesign Prompt — Wallet + BYOK + Auth + AI Chat

> **Purpose:** Give this entire file to Claude (or any LLM) to scaffold a production-grade  
> wallet-switching, BYOK AI chat, and auth system in a **new** Next.js + TypeScript project.  
> Everything below is the prompt. Copy the whole thing into a fresh conversation.

---

## BEGIN PROMPT
Always use newest versions even if wrong version is mentioned below..
You are an expert full-stack engineer. Build the following three interconnected systems in a **Next.js 16+ App Router** project with TypeScript, Tailwind CSS, shadcn/ui, Prisma (Postgres), and NextAuth v5 (Auth.js). The design philosophy is **1-click, instant-response, zero-friction**.

The entire UX must feel like a native app — optimistic UI everywhere, streaming responses, skeleton placeholders, and zero full-page reloads.

---

### 1. AUTH SYSTEM — Multi-Identity, Session-Enriched

#### Architecture

```
NextAuth v5 (Auth.js)
├── PrismaAdapter (canonical user table)
├── Providers: Credentials (email+password), Google, GitHub, Discord
├── Edge-compatible auth config (split into auth.config.ts + auth.ts)
└── Session enrichment via callbacks
```

#### Requirements

1. **Split config for Edge compatibility:**
   - `auth.config.ts` — provider definitions, pages config, edge-safe `authorized` callback for middleware. No Node.js crypto, no Prisma imports.
   - `auth.ts` — full NextAuth init with PrismaAdapter, `jwt` + `session` callbacks that enrich the token/session with: `id`, `role`, `isTwoFactorEnabled`, `isOAuth`, `email`, `name`, `image`, `identitySource`.

2. **Multi-identity resolution:**
   - Users can link Google, GitHub, Discord to one account.
   - Store per-provider profile data (`googleProfileName`, `googleProfileImage`, etc.) on the User model.
   - `identitySource` field (`AUTO | MANUAL | GOOGLE | GITHUB | DISCORD`) controls which provider's name/image the session returns.
   - `resolveDisplayName(user, identitySource)` and `resolveDisplayImage(user, identitySource)` pick the right one with smart fallback chain.

3. **Session shape** (what the client sees):
   ```ts
   {
     id: string;
     role: "USER" | "ADMIN" | "OWNER";
     email: string;
     name: string;          // resolved from identitySource
     image: string | null;  // resolved from identitySource
     isOAuth: boolean;
     isTwoFactorEnabled: boolean;
     identitySource: IdentitySource;
   }
   ```

4. **Security:**
   - Email verification required before first login (send verification token).
   - Optional 2FA (TOTP) — check `twoFactorConfirmation` record in `signIn` callback.
   - Rate-limit login attempts (IP-based, sliding window).
   - `requireOauthEmailConfirmation` flag — when a user links a new OAuth provider, email them a confirmation link before the link is active.

5. **Server-side helper:**
   ```ts
   // lib/user-auth.ts
   export async function currentUser() → enriched session user or null
   export async function requireUser() → enriched session user or throw 401
   ```

#### Implementation guide

- Use `next-auth/jwt` with database sessions disabled (JWT strategy) for Edge compat.
- The `jwt` callback fires on every request — look up the user from Prisma, enrich the token.
- The `session` callback copies enriched fields from `token` → `session.user`.
- OAuth `signIn` callback: if account already exists with that email, auto-link (or require confirmation). If new user, create with `emailVerified: new Date()`.

---

### 2. WALLET SYSTEM — Multi-Chain, Multi-Wallet, 1-Click Switching

#### Architecture

```
WalletRuntimeProvider (React context)
├── EVM: wagmi v2 + @reown/appkit (WalletConnect v2)
│   ├── MetaMask, Coinbase Wallet, WalletConnect, Injected
│   └── Multi-chain: Ethereum, Polygon, Arbitrum, Base, PulseChain
├── Solana: @solana/wallet-adapter-react
│   └── Phantom, Solflare, Backpack
└── DB sync: linked wallets persisted to User → Wallet[] relation
```

#### Requirements

1. **WalletRuntimeContext** — single React context that unifies EVM + Solana state:
   ```ts
   type WalletContextValue = {
     evm: { connected: boolean; address: string | null; chainId: number; brand: string | null };
     solana: { connected: boolean; address: string | null; brand: string | null };
     busy: { evm: boolean; sol: boolean };
     evmConnectors: readonly Connector[];
     connectEvm: (connector: Connector) => Promise<void>;
     disconnectEvm: () => Promise<void>;
     connectSolana: (walletName: WalletName) => Promise<void>;
     disconnectSolana: () => Promise<void>;
   };
   ```

2. **1-click connect UX:**
   - Button shows "Connect Wallet" when disconnected → opens a modal.
   - Modal has two sections: **Recommended** (MetaMask=Desktop, WalletConnect=Mobile, Coinbase) and **More Wallets**.
   - Each connector shows its real icon (use a `getConnectorBrand()` helper that maps connector IDs to icon paths + display names).
   - On click → `connectAsync({ connector })` → modal auto-closes → button morphs to show truncated address + green dot.
   - Badge system: "Desktop" tag on MetaMask, "Mobile" tag on WalletConnect.

3. **Connected state dropdown:**
   - When connected, clicking the wallet button opens a dropdown (not modal) showing:
     - EVM card: address, chain, balance, disconnect button.
     - Solana card: address, disconnect button.
   - Each card has a green "Connected" pill with pulsing dot.

4. **Sidebar wallet panel** (for power users / dashboard):
   - Shows ALL linked wallets (from DB) + live-connected wallets.
   - **Wallet registry** — `Map<string, WalletRegistryEntry>` persisted to `sessionStorage` so wallets survive page reloads.
   - Active wallet indicator (green border).
   - Per-wallet actions: disconnect, copy address, view on explorer, set as default.
   - **Network switcher** — dropdown to switch EVM chains (calls `useSwitchChain`).
   - **Wallet verification** — sign a message to prove ownership → marks wallet as `verified` in DB.
   - **Custom labels** — users can rename wallets ("My Trading Wallet", "Cold Storage").
   - **Transfer panel** — send native token between connected wallets (calls `sendTransaction`).

5. **DB sync pattern:**
   ```prisma
   model Wallet {
     id          String   @id @default(cuid())
     userId      String
     user        User     @relation(fields: [userId], references: [id])
     family      String   // "EVM" | "SOLANA" | "BITCOIN"
     address     String
     label       String?
     chainId     Int?
     isDefault   Boolean  @default(false)
     verifiedAt  DateTime?
     connectorType String?
     createdAt   DateTime @default(now())
     @@unique([userId, address])
   }
   ```
   - On connect: upsert wallet to DB (fire-and-forget, don't block UI).
   - On disconnect: keep in DB (users may reconnect), just mark as inactive.

6. **Instant-response patterns:**
   - `busy` flags prevent double-click.
   - `brand` is persisted to localStorage so the correct icon shows before wagmi hydrates.
   - Optimistic address display — show address immediately from the connector callback, don't wait for the React re-render cycle.
   - Skeleton loaders for balance fetching.

---

### 3. AI CHAT + BYOK — Streaming, Multi-Provider, Zero-Config Free Tier

#### Architecture

```
POST /api/ai-chat
├── Auth: session (authenticated) or IP (anonymous, rate-limited)
├── Key resolution: inline BYOK → saved BYOK → platform key
├── Provider adapters: Google, Groq, Grok (free) | OpenAI, Anthropic (paid/BYOK)
├── Streaming: SSE (unified stream factory)
└── Safety: injection filter, sensitive data detection, HTML strip
```

#### Requirements

##### A. Route Handler (`/api/ai-chat`)

1. **Request schema** (Zod):
   ```ts
   {
     messages: [{ role: "user"|"assistant", content: string }], // max 40, 4000 chars each
     sessionId?: string,          // cuid, links to AiConversation
     model?: string,              // e.g. "gpt-4o-mini", "gemini-2.5-flash"
     provider?: Provider,         // "OPENAI"|"ANTHROPIC"|"GOOGLE"|"GROQ"|"GROK"|"OPENROUTER"
     aiAuth?: {                   // inline BYOK
       mode: "one_time",
       apiKey: string,
       provider: Provider,
       rememberKey?: boolean,     // if true, encrypt & save for future use
     }
   }
   ```

2. **Key resolution order** (for authenticated users):
   1. **Inline BYOK** (sent in `aiAuth`) — used immediately. If `rememberKey`, encrypt and store.
   2. **Saved BYOK** — look up `UserAiKey` for this user + provider. Decrypt with AES-256-GCM.
   3. **Platform key** — use env var. Free providers (Google, Groq, Grok) are available to all. Paid providers (OpenAI, Anthropic) require premium entitlement or BYOK.

3. **Anonymous users:** Platform Google key only. Rate-limited to N messages/hour per IP. Shorter message limit.

4. **Quota system:**
   - Free tier: X messages/day (check + increment in Redis or Prisma counter).
   - Credit packs: finite pool, decrement per use.
   - Daily cap (paid): elevated daily limit.
   - Owner/admin: exempt from all quotas.

5. **Unified SSE stream factory:**
   ```ts
   function createSseStream(
     upstreamBody: ReadableStream<Uint8Array>,
     extractText: (parsed: unknown) => string | null,
     logLabel: string,
   ): ReadableStream<Uint8Array>
   ```
   - Parses each `data: {...}` line from the upstream provider.
   - Calls `extractText()` to pull the text delta (different per provider).
   - Re-emits as `data: {"text":"..."}\n\n`.
   - Ends with `data: [DONE]\n\n`.
   - Strips HTML from all output (XSS prevention).

6. **Provider adapters:**
   | Provider | Endpoint | Auth | Text extraction path |
   |----------|----------|------|---------------------|
   | Google Gemini | `generativelanguage.googleapis.com/v1beta/models/{model}:streamGenerateContent?alt=sse` | `key=` query param | `candidates[0].content.parts[0].text` |
   | OpenAI | `api.openai.com/v1/chat/completions` | `Bearer` header | `choices[0].delta.content` |
   | Anthropic | `api.anthropic.com/v1/messages` | `x-api-key` header, `anthropic-version` | `type=content_block_delta → delta.text` |
   | Groq | `api.groq.com/openai/v1/chat/completions` | `Bearer` header | OpenAI-compatible |
   | Grok (xAI) | `api.x.ai/v1/chat/completions` | `Bearer` header | OpenAI-compatible |
   | OpenRouter | `openrouter.ai/api/v1/chat/completions` | `Bearer` + `HTTP-Referer` | OpenAI-compatible |

7. **Response headers** for client UI hints:
   ```
   X-Ai-Cost-Tier: "free" | "premium" | "byok"
   X-Ai-Provider: resolved provider name
   X-Ai-Model: resolved model name
   X-Sensitive-Types: (if sensitive data detected in input)
   ```

8. **Smart error messages** — `formatProviderError(provider, status, rawBody, apiKey?)`:
   - 401/403 → "Provider rejected your key. Verify at {console URL}." + detect wrong-provider keys (e.g., OpenAI key sent to Groq).
   - 429 → distinguish quota exhausted vs. rate limit.
   - 402 → billing/credit error with link to provider console.
   - 404 → model not found.
   - 503 → provider overloaded.

##### B. BYOK Key Storage

1. **Encryption:** AES-256-GCM with a server-side secret (`BYOK_ENCRYPTION_KEY` env var, min 32 chars).
   ```ts
   encryptApiKey(key) → { encryptedKey, iv, authTag }  // all base64
   decryptApiKey({ encryptedKey, iv, authTag }) → plaintext
   ```

2. **DB model:**
   ```prisma
   model UserAiKey {
     id           String   @id @default(cuid())
     userId       String
     user         User     @relation(fields: [userId], references: [id])
     provider     String   // "OPENAI" | "ANTHROPIC" | etc.
     encryptedKey String
     iv           String
     authTag      String
     maskedKey    String   // "sk-pr••••abcd" for display
     fingerprint  String   // SHA-256 prefix for dedup
     createdAt    DateTime @default(now())
     updatedAt    DateTime @updatedAt
     @@unique([userId, provider])
   }
   ```

3. **Helpers:**
   - `maskApiKey(key)` → `"sk-pr••••abcd"` (first 4 + last 4 chars).
   - `fingerprintApiKey(key)` → SHA-256 hex prefix (16 chars) for deduplication.
   - `normalizeProvider(input)` → canonical provider ID.
   - `inferProviderFromApiKey(key)` → auto-detect: `sk-` = OpenAI, `sk-ant-` = Anthropic, `gsk_` = Groq, `AIza` = Google.

##### C. Client-Side Chat UI

1. **Streaming display:**
   - Use `EventSource` or `fetch` + `ReadableStream` reader.
   - Append text chunks to a `ref` for zero-rerender streaming (update DOM directly, sync to React state on `[DONE]`).
   - Markdown rendering with `react-markdown` + syntax highlighting.
   - Typing indicator (3 animated dots) while waiting for first chunk.

2. **Model/provider picker:**
   - Dropdown grouped by tier: **Free** (Gemini, Groq, Grok) | **Premium** (GPT-4o, Claude) | **BYOK** (unlocked by key).
   - Locked models show a lock icon + "Add API key" or "Buy credits" CTA.
   - When user pastes a BYOK key, auto-detect the provider and unlock those models instantly (no page reload).

3. **BYOK input panel:**
   - Expandable section: "Use your own API key" toggle.
   - Single input field with auto-detection: as user types, show detected provider icon + name.
   - "Remember this key" checkbox → encrypts and saves server-side.
   - Show saved keys as pills: `OpenAI: sk-pr••••abcd ✕` with delete button.
   - Key validation: test with a minimal API call before saving.
   - Links to each provider's API key console.

4. **Conversation management:**
   - Auto-save conversations to DB (`AiConversation` + `AiMessage` models).
   - Sidebar list of past conversations with title, date, message count.
   - Rename, delete, pin conversations.
   - "New chat" button clears state instantly.

5. **1-click instant-response feel:**
   - **Optimistic message append:** User message appears in chat immediately on submit (before API response).
   - **Streaming starts in <200ms** — SSE connection opens on submit, first chunk renders as soon as it arrives.
   - **No loading spinners** — use skeleton text shimmer for the assistant's response area.
   - **Abort controller** — user can stop generation mid-stream.
   - **Auto-scroll** — smooth scroll to bottom as chunks arrive, but stop if user scrolls up.
   - **Keyboard shortcuts:** Enter to send, Shift+Enter for newline, Escape to stop, ↑ to edit last message.

---

### 4. PRISMA SCHEMA (relevant models)

```prisma
model User {
  id                    String    @id @default(cuid())
  name                  String?
  email                 String?   @unique
  emailVerified         DateTime?
  image                 String?
  password              String?
  role                  UserRole  @default(USER)
  isTwoFactorEnabled    Boolean   @default(false)
  identitySource        String    @default("AUTO")
  
  // Per-provider profile
  googleProfileName     String?
  googleProfileImage    String?
  githubProfileName     String?
  githubProfileImage    String?
  discordProfileName    String?
  discordProfileImage   String?
  
  wallets               Wallet[]
  aiKeys                UserAiKey[]
  aiConversations       AiConversation[]
  accounts              Account[]      // NextAuth accounts
}

enum UserRole {
  USER
  ADMIN
  OWNER
}

model Wallet {
  id            String    @id @default(cuid())
  userId        String
  user          User      @relation(fields: [userId], references: [id], onDelete: Cascade)
  family        String    // "EVM" | "SOLANA"
  address       String
  label         String?
  chainId       Int?
  isDefault     Boolean   @default(false)
  verifiedAt    DateTime?
  connectorType String?
  createdAt     DateTime  @default(now())
  @@unique([userId, address])
}

model UserAiKey {
  id           String   @id @default(cuid())
  userId       String
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  provider     String
  encryptedKey String
  iv           String
  authTag      String
  maskedKey    String
  fingerprint  String
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  @@unique([userId, provider])
}

model AiConversation {
  id          String       @id @default(cuid())
  creatorId   String
  creator     User         @relation(fields: [creatorId], references: [id], onDelete: Cascade)
  title       String?
  isPublic    Boolean      @default(false)
  isDeleted   Boolean      @default(false)
  isSuspended Boolean      @default(false)
  messages    AiMessage[]
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt
}

model AiMessage {
  id             String         @id @default(cuid())
  conversationId String
  conversation   AiConversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)
  role           String         // "user" | "assistant" | "system"
  content        String
  provider       String?
  model          String?
  costTier       String?        // "free" | "premium" | "byok"
  createdAt      DateTime       @default(now())
}

model AiDailyUsage {
  id        String   @id @default(cuid())
  userId    String
  date      String   // "2025-01-15" (UTC date string)
  count     Int      @default(0)
  @@unique([userId, date])
}
```

---

### 5. FILE STRUCTURE

```
src/
├── app/
│   ├── layout.tsx                    # Providers wrapper
│   ├── api/
│   │   └── ai-chat/
│   │       └── route.ts             # Streaming chat endpoint
│   └── (protected)/
│       ├── chat/
│       │   └── page.tsx             # AI chat page
│       └── settings/
│           └── page.tsx             # BYOK key management, wallet linking
├── components/
│   ├── wallet/
│   │   ├── WalletRuntimeContext.tsx  # Unified EVM+Solana context
│   │   ├── WalletConnection.tsx     # Connect button + modal + dropdown
│   │   ├── WalletPanel.tsx          # Sidebar power-user wallet panel
│   │   ├── NetworkSwitcher.tsx      # Chain switcher dropdown
│   │   └── wallet-icons.ts          # Connector → icon/label mapping
│   ├── chat/
│   │   ├── ChatWidget.tsx           # Main chat UI (messages + input)
│   │   ├── ChatMessage.tsx          # Single message bubble + markdown
│   │   ├── ChatModelPicker.tsx      # Provider/model dropdown
│   │   ├── ByokPanel.tsx            # BYOK key input + saved keys
│   │   └── ChatSidebar.tsx          # Conversation list
│   └── auth/
│       ├── LoginForm.tsx
│       ├── RegisterForm.tsx
│       └── SocialButtons.tsx
├── lib/
│   ├── ai-key-crypto.ts            # AES-256-GCM encrypt/decrypt/mask
│   ├── ai-key-store.ts             # Prisma CRUD for UserAiKey
│   ├── ai-models.ts                # Model registry + defaults
│   ├── ai-chat/
│   │   └── safety.ts               # Injection check, rate limit, HTML strip
│   ├── daily-ai-quota.ts           # Daily usage check + increment
│   ├── user-auth.ts                # currentUser() / requireUser()
│   └── db.ts                       # Prisma client singleton
├── hooks/
│   ├── use-wallet-verify.ts         # Sign-message verification flow
│   └── use-chat.ts                  # Chat state + streaming hook
├── auth.ts                          # NextAuth full init
├── auth.config.ts                   # Edge-safe provider config
└── middleware.ts                    # Auth middleware (uses auth.config.ts)
```

---

### 6. KEY DESIGN PRINCIPLES

| Principle | Implementation |
|-----------|---------------|
| **1-click UX** | Zero config needed. Free tier works instantly. Wallet connects in one click. BYOK auto-detects provider. |
| **Instant response** | Optimistic UI, SSE streaming, skeleton placeholders, no full-page reloads. |
| **Progressive disclosure** | Free tier → BYOK → Premium credits. Don't overwhelm new users. Show BYOK only when they need it. |
| **Security-first BYOK** | Keys encrypted at rest (AES-256-GCM), never logged, never sent to client after save. Masked display only. |
| **Multi-provider parity** | Unified SSE stream factory normalizes all providers to the same output format. Client code doesn't know which provider is streaming. |
| **Graceful degradation** | If a provider is down, show a clear error with alternatives. If BYOK key is invalid, tell the user exactly why + link to the console. |
| **Offline-resilient wallet** | Wallet registry survives page reloads (sessionStorage). Brand icons show before wagmi hydrates (localStorage). |

---

### 7. IMPLEMENTATION ORDER

Build in this order for fastest working prototype:

1. **Auth** — NextAuth v5 setup, Prisma schema, login/register forms.
2. **AI Chat route** — `/api/ai-chat` with Google (free) streaming. Test with curl.
3. **Chat UI** — Basic ChatWidget with streaming display + model picker.
4. **BYOK** — Key encryption lib, ByokPanel component, key resolution in route.
5. **Wallet context** — WalletRuntimeContext + WalletConnection button.
6. **Wallet panel** — Full sidebar panel with verification, transfers, network switching.
7. **Polish** — Keyboard shortcuts, abort, auto-scroll, conversation management.

---

### 8. TECH STACK SUMMARY

| Layer | Tech |
|-------|------|
| Framework | Next.js 14+ App Router |
| Language | TypeScript (strict) |
| Styling | Tailwind CSS v4 + shadcn/ui |
| Auth | NextAuth v5 (Auth.js) with JWT strategy |
| Database | PostgreSQL + Prisma ORM |
| EVM Wallets | wagmi v2 + viem + @reown/appkit |
| Solana Wallets | @solana/wallet-adapter-react |
| AI Streaming | Native fetch + ReadableStream (no AI SDK dependency) |
| Validation | Zod (API + forms) |
| State | React Context + refs (no Redux) |
| Animations | Framer Motion (optional, for micro-interactions) |
| Toast | Sonner |

---

### 9. WHAT TO BUILD FIRST

Start by generating these files in order:

1. `prisma/schema.prisma` — all models above
2. `auth.config.ts` + `auth.ts` + `middleware.ts`
3. `lib/ai-key-crypto.ts`
4. `lib/daily-ai-quota.ts`
5. `lib/ai-chat/safety.ts`
6. `app/api/ai-chat/route.ts`
7. `components/chat/ChatWidget.tsx`
8. `components/chat/ByokPanel.tsx`
9. `components/wallet/WalletRuntimeContext.tsx`
10. `components/wallet/WalletConnection.tsx`

Generate complete, production-ready code for each file. Use the patterns and architecture described above. Every component should have proper TypeScript types, error handling, and loading states.

## END PROMPT
