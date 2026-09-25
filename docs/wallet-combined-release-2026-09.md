# Combined wallet release — September 2026

Status: **Preview accepted; Production acceptance pending**.

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

## Remaining

- Production candidate health, promotion and live browser acceptance.
- Real wallet extension acceptance and crypto checkout are not proved by the
  disposable signer or intercepted UI checks. Company-page browser acceptance
  remains distinct from shared-picker unit/database coverage.
- Other unfinished full-goal items remain on the production scoreboard.

Production rollback target before this release:
`dpl_H9pKHzLJ46nCEouZ8S39uAZAjsgH` (source `ec4d88f`).
