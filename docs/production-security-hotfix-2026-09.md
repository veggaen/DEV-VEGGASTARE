# Production dependency hotfix — September 2026

This candidate starts from production commit `88729d0`, not the newer showcase
payment branch. Only `frontend/package.json` and `frontend/package-lock.json`
change application inputs. No payment code, prices, ledger logic, authentication
policy, database migrations or UI changes are included.

Versions match the tested showcase candidate `d5d3bad`: Next.js and matching
packages 16.3.6, NextAuth 5.0.0-beta.32, Prisma adapter 2.11.3, Auth core 0.41.3,
Axios 1.20.0, ws 8.21.3 (7.x remains 7.5.13), Socket.IO parser 4.2.7 and
brace-expansion 5.0.12. The two worktrees' dependency lock hashes are identical.
No forced major wagmi migration or Solana downgrade is included.

`npm audit --omit=dev`: **0 critical, 0 high, 25 moderate** dependency entries.
Moderate runtime and build/dev-tool findings still require follow-up. This is
remediation, not evidence of exploitation or a claim of a clean repository.

## Verification

- Current-production baseline: home, products, login, health and auth provider
  discovery return 200. Google, GitHub and Discord remain configured.
- Production-source focused auth, recovery, wallet and payment unit tests:
  **72/72 pass**.
- Local build/start explicitly use the isolated Neon Preview database and
  credentials verified against PayPal Sandbox. No Live payment keys are copied
  locally; local mail uses an invalid QA key and no AI provider calls are made.
- npm's pre-existing PowerShell script-shell setting rejected a dependency's
  `||` syntax. A process-local Windows command interpreter setting resolves it;
  the user's global npm/shell settings remain unchanged. See
  [npm script-shell documentation](https://docs.npmjs.com/cli/v11/using-npm/config/#script-shell).
- Strict webpack build and TypeScript pass (187 generated routes). The first
  collection attempt identified omitted storage credentials in the isolated
  local launcher; including the existing local storage settings fixed it.
- Local focused Playwright **7/7** passes: malformed-session/OAuth protocol,
  password login/logout at 390/1280, injected wallet activation/cancellation at
  360 through 2560, failed-cart fail-closed handling, guest login return and
  private personalized HTML. No purchases are submitted by these tests.
- Real Chrome preserves the existing demo session and the product gallery's
  next/previous controls work. Production deployment is pending.

Rollback reference: production deployment
`dpl_CfYkdh23aWaFe5CMQuM8kQ6M96tw`
(`dev-veggastare-gesrec89c-v3ggas-projects.vercel.app`).

Custom credit quantities and global fiat (crypto) presentation remain on the
separate showcase Preview. This patch does not imply completed owner OAuth
consent, custom Sandbox capture/refund acceptance, or any Live purchase.
