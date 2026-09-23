# September 2026 security maintenance

## Candidate scope

The showcase branch updates Next.js and its matching packages to **16.3.6**,
NextAuth to **5.0.0-beta.32**, and the Prisma adapter to **2.11.3**. Both Auth.js
consumers now resolve one `@auth/core` **0.41.3**. Application cookie, CSRF,
PKCE, email verification, rate limits and account-linking policies are unchanged.
This is dependency remediation, not evidence that the app was exploited.

Maintainer references: [Auth.js provider-bound OAuth checks](https://github.com/nextauthjs/next-auth/security/advisories/GHSA-x445-f3h2-j279),
[malformed Bearer parsing](https://github.com/nextauthjs/next-auth/security/advisories/GHSA-xmf8-cvqr-rfgj),
[email normalization](https://github.com/nextauthjs/next-auth/security/advisories/GHSA-7rqj-j65f-68wh),
and the [current Next.js security release](https://nextjs.org/blog).
The latter also fixes a Node `next/og` issue affecting versions 16.2.0–16.3.5;
that particular advisory is not evidence that the former 16.1.6 installation
was affected by it.

## Audit and remaining work

Before: `npm audit --omit=dev` reported **4 critical, 8 high, 26 moderate**
production dependency entries. After this update: **0 critical, 5 high,
26 moderate**. These are dependency-entry counts, not independent exploits.
Remaining high entries: axios, brace-expansion, socket.io-parser, viem and ws.
Their dependency paths still require remediation/review. Do not use
`npm audit fix --force`: proposed Solana downgrades and a wagmi major migration
are not safe substitutes for compatibility testing.

## Local validation

- Focused auth, checkout, credit pricing and CI guards: 93 unit checks passed.
- Installed Auth.js parser: 5 checks passed (malformed Bearer values, valid
  encrypted session cookie and wrong-secret rejection).
- Real PostgreSQL credit ledger: 30 checks passed against the isolated Neon
  Preview database in a generated disposable schema. No live credits or
  provider calls were involved.
- The account-recovery browser test now refuses its former live-database
  opt-in and requires the verified isolated Preview target.
- Strict isolated type-check and touched-file ESLint pass. Initial full build
  failed on old generated route types from previous audit builds. An optional
  `NEXT_TSCONFIG_PATH` lets local builds select a clean type-check config without
  deleting artifacts, modifying the developer's accumulated tsconfig, or
  disabling build checks. CI/deployments retain the normal config by default.
- Final strict webpack build passes, including 187 generated routes.
- Local Playwright **5/5** including setup: malformed-session rejection,
  OAuth handoff protocol/cookies, actual password login/logout at 390/1280,
  demo checkout error/retry/replay, and real register/verify/reset/replay,
  session revocation and 2FA flow against the isolated Preview database.
- Local cross-feature regression **5/5** including setup: global fiat (crypto)
  persistence across shopping/receipts/orders, buyer credit history, injected
  wallet Set active/cancellation, and personalized HTML cache/session isolation.
- Real Chrome reload preserves the existing demo session and displays the
  retained 555-credit receipt. Selecting USD keeps ETH and updates the amounts;
  Done closes the menu and restores selector focus. A rate-fetch error was
  recorded during the server restart/reload; the subsequent rates endpoint
  returns 200 and the receipt renders converted amounts.
- Deployed Preview verification is pending. Production is not yet patched by
  this candidate, and owner OAuth consent is not implied by protocol checks.

The hosted GitHub workflow remains blocked by the owner's account billing
lock, before any job step. No spending or billing settings were changed.
