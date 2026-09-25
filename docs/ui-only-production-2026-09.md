# UI-only production release — 26 September 2026

Base: production `92c5ac7`. Only the verified Pulse keyboard/touch controls and
consent first-paint changes are included, from integrated Preview `9992a12`.
Payment code, schema/migrations, price lists, terms and dependency manifests have
zero diff from the production base. Native-currency settlement remains on the
separate `release/showcase-september` branch pending merchant acceptance.

Local build and full TypeScript pass against the isolated Preview database with
Sandbox payment credentials; no Live credentials are copied locally. Focused
consent/telemetry tests pass 36/36. Touched ESLint has zero errors and one existing
Pulse internal-navigation warning at line 2528. Whitespace checks pass.

Browser acceptance uses six scoped tests extracted from integrated commit
`9992a12` into `frontend/e2e/ui-promotion.spec.ts`, invoked against this candidate
on localhost:3000: demo privacy, responsive discovery,
Pulse keyboard/touch controls, pre-hydration consent, eight-width consent actions,
and no-JavaScript terms. Follow/post writes are intercepted; no payments or emails.
The initial cross-worktree run passed five checks but failed the terms filename
comparison because its imports referenced Preview's newer legal version. The
dedicated test imports this release's own immutable terms and checks exact bytes;
production terms have not been changed or assertions weakened.

No CSS workaround is included for blank Pulse screenshot interiors: the owner
confirmed actual posts remain visible while scrolling Explore.

## Acceptance

Runtime `fc652ac` is READY in production as
`dpl_85HoopHh5RhmpM8G3Bv8fwdEufGf`, aliased to `https://www.veggat.com`.
Vercel confirmed 54 migrations and none pending; no database migration ran.
Local acceptance passes **6/6** (25.8 seconds); Live passes **6/6** (48.6
seconds), no retries or skips. Standalone TypeScript and the dedicated test lint
also pass. The retained Live demo session remained authenticated; no new grant.

Real Chrome loads the signed-in Pulse route, shows 25 labelled post-option
controls, opens a post menu, and dismisses it with Escape. No post/reaction,
payment, refund, email, credit grant or provider call was submitted.

Reproduce with `node node_modules/@playwright/test/cli.js test
--config=playwright.ui-promotion.config.ts` from frontend, setting `E2E_BASE_URL`,
`E2E_CONSENT=1`, `E2E_TERMS=1`, and `E2E_DEMO_STORAGE_STATE` to an ignored,
authenticated demo session. Missing opt-in flags/session intentionally skip their
tests; acceptance requires all six passing, not skipped.

This closes these UI fixes locally then Live, not the full S1–S9 scoreboard.
Native-currency activation and remaining owner-only checks stay open.

## Live timing follow-up

Two serial anonymous cold homepage samples at 390x844, 4x CPU, 1.6Mbps down,
750Kbps up, 150ms latency and disabled cache measured LCP/FCP 2,284ms and
2,332ms. Both had CLS 0, no page errors and no document overflow. Script
transfer remains 1,061,830 B: this fixes late notice presentation, not the shared
JavaScript cost. The earlier Live baseline was 8,312ms LCP. These are bounded
lab observations, not field percentiles or proof that every route is fast.
