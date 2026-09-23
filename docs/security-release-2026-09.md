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
- Candidate `477e83b`, deployment `dpl_7meZLg3agnyw1ALukw4nANB1xTYi`, is READY
  on the stable showcase Preview alias. Git deployment did not move the pinned
  alias automatically; the alias was explicitly updated and read back before
  the final tests. An initial run against the old alias was stopped and is not
  counted as candidate evidence.
- Deployed Preview Playwright **9/9** passes in 1.4 minutes: the above auth,
  recovery, checkout and cross-feature checks. All Google/GitHub/Discord
  providers are advertised and their initiation checks run; this does not
  imply completed owner consent. Health is 200; a valid-shaped but unsigned
  capture notification returns 401 `INVALID_SIGNATURE`.
- Real Chrome confirms deployed typed 555 credits, its progressive discount,
  and NOK (ETH) pricing. Local 390px receipt/footer and independently scrolling
  mobile drawer were visually inspected; the viewport override was reset.
  An unaffordable premium model keeps Send disabled with a nonempty draft.
  No AI provider request or payment was made by these extra manual checks.
- Production is unchanged and is not yet patched by this candidate.

## Follow-up observed during QA

A brand-new demo account's receipt shows a stored balance of 0 before chat
initializes its free allowance, while chat advertises 5 demo credits. Harmonize
that display without granting credits from the receipt, resetting spent
balances, or treating a free demo order as a paid credit purchase. The remaining
dependency findings, actual owner OAuth completion, custom paid Sandbox
webhook/refund acceptance and Live acceptance still remain separate work.

The hosted GitHub workflow remains blocked by the owner's account billing
lock, before any job step. No spending or billing settings were changed.

## Follow-up candidate: compatible runtime fixes and demo presentation

WebSocket 8.x now has a patched minimum of 8.21.3, including nested viem paths;
WebSocket 7.x remains on its own major (updated to 7.5.13). Socket.IO parser is
4.2.7, brace-expansion 5.0.12 and Axios 1.20.0. Scoped overrides retain Axios 1.x
and WebSocket 8.x API families, without downgrading Solana or migrating wagmi.
`npm audit --omit=dev` now reports **0 critical, 0 high, 25 moderate** entries.
The full dependency tree still has **8 high build/dev-tool entries** (Faker,
Prisma/config/deepmerge-ts/mysql2, browserslist, fast-uri and js-yaml); these
remain tracked work, not a clean full-repository security audit.

The demo presentation candidate shares one pure helper between receipt, history
and chat. A missing demo account displays its five-credit first-send allowance
and identifies it as free/unclaimed. Existing zero/partial balances remain
unchanged; missing paid accounts display zero. Reads do not grant credits or
make ledger entries. The grant is still the existing idempotent guarded-send
transaction. Focused unit checks **62/62** and real isolated Postgres ledger
checks **30/30** pass. Strict webpack build (187 generated routes), standalone
type-check and touched-file lint pass. Local focused Playwright **7/7** passes:
read-only demo balance across receipt/history/config, auth protocol/password
login/logout, global currency, buyer history and injected wallet cancellation.
The new check reads the isolated database before/after and confirms that the
credit account and ledger entries remain absent. Its first run matched a hidden
streaming copy; scoping assertions to the main landmark fixed the test ambiguity.
Real Chrome at 390px confirms the five-credit allowance, USD (ETH), receipt
footer scrolling and matching history with no activity entries. Deployment
verification is pending; production remains unchanged.
