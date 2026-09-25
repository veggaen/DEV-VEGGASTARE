# Combined wallet release — September 2026

Status: **Deployed; scoped local, Preview and Live checks pass**. Real extension
and complete wallet/payment acceptance remain partial.

Combines wallet mutation `c6763a1`, receiving choice `d41c0f8`, wallet login
`485df0f` and Web3 mode `6478721`. Existing wallet-link challenge protection is
retained. No Prisma schema change or migration is introduced by this release.

## Evidence

- Local integrated checks: 266/266, including 89 isolated PostgreSQL cases.
  Strict build and touched lint pass. Focused local browser acceptance: 14/14.
- The disposable EOA login test now explicitly permits only localhost:3000 and
  the isolated stable Preview origin. It asserts the HttpOnly, SameSite=Lax,
  host-bound HTTPS proof cookie, last-login-method protection, logout and proof
  replay rejection. No transaction or funded wallet is used. Additional local
  check: 1/1, 6.4s. Updated test lint and standalone TypeScript pass.
- Preview source `6478721` is READY as `dpl_6gkvfMERpKEezfLnfr6URSVEYePG`,
  `https://dev-veggastare-8yse8cedh-v3ggas-projects.vercel.app`.
  Strict build: webpack 69s, TypeScript 76s, 189 static pages. Build confirms
  isolated jolly-smoke database, 53 migrations, none pending.
- Direct anonymous candidate health reached Vercel's existing team protection,
  not the app. Authenticated Vercel CLI health is healthy. Only the existing
  public Sandbox alias was advanced; no deployment protection was changed.
- Retained Preview demo session remains authenticated; no new demo grant.
  Hosted browser acceptance: **16/16, 53.8s, zero retries/skips**, including
  actual disposable EOA authentication and HTTPS cookie checks, responsive
  intercepted wallet/settings actions, negative endpoint checks, malformed
  sessions/OAuth PKCE host checks and unsigned Sandbox webhook rejection.
- Real Chrome retained the owner's Preview session, showed neutral initial
  loading and a compact desktop confirmation. No mode change was submitted.
  Owner's two existing live wallet links and receiving choice were observed
  before deployment for comparison. No signatures or financial actions.

Artifacts: `frontend/test-results-release-wallet-combined-preview/` and
`frontend/test-results-release-wallet-cookie-local/` (ignored).

## Production and Live

Source `07cabde` (same runtime as `6478721`; updated test/evidence only) is READY
as `dpl_DbYF6shZVj6jzstPgrbB7Z4XHcLg` at
`https://dev-veggastare-4tsbat95f-v3ggas-projects.vercel.app`.
Production build: webpack 57s, strict TypeScript 58s, 189 static pages;
orange-wildflower database, 53 migrations, none pending. No Live secret was
copied into local configuration. Initial deploy skipped the main domain switch.

Authenticated candidate health passed; cross-origin mode PATCH returned 403.
`www.veggat.com` was confirmed on the prior deployment before explicit promotion.
After promotion, CLI inspection resolves the main site to this new deployment,
and public `/api/health` is 200/healthy. The first cold observation was 1,239ms DB
latency; this is not a field-performance or percentile claim.

Live browser acceptance: **14/14, 51.4s, zero retries/skips**. The account-creating
disposable EOA test is intentionally not selected for Production. Intercepted
positive UI flows do not submit wallet/payout/email changes; deployed negative
endpoint checks and OAuth PKCE/callback/cookie checks are real HTTP requests.
The retained live demo session was reused without a new credit grant.

Real Chrome preserved both saved wallet links, verification labels and the
existing receiving choice. It showed neutral loading, a correctly styled switch,
compact phone/landscape confirmation, Cancel with restored focus and unchanged
mode, page scrolling to the footer, and independently scrolling mobile navigation
with reachable wallet controls and Sign out. No console errors. Viewport reset.
No owner setting, receiving destination, real extension signature, email, payment,
AI generation or refund was submitted.

Final Live artifacts: `frontend/test-results-release-wallet-combined-live/`.
Testing and computer-use skills informed explicit cancellation, rendered-state,
scrolling and screenshot checks; synthetic and real-provider evidence stay separate.

## Remaining

- Real wallet extension acceptance and crypto checkout are not proved by the
  disposable signer or intercepted UI checks. Company-page browser acceptance
  remains distinct from shared-picker unit/database coverage.
- Other unfinished full-goal items remain on the production scoreboard.

Production rollback target before this release:
`dpl_H9pKHzLJ46nCEouZ8S39uAZAjsgH` (source `ec4d88f`).
