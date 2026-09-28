# Personal payment settings — 25 September 2026

## Change and limits

Runtime `0a9372f` replaces the personal settings component's separate EVM-only
fetch with the verified, owner-checked payment snapshot introduced by `e5feb4c`.
Eligible wallet families are no longer hidden by that UI-specific request.
One snapshot also keeps the selected address, allowed choices and Web3 mode
consistent. This does not enable a new blockchain checkout path.

Reads have a 12-second deadline, retry, late-response/unmount protection and
disabled controls during refresh. Wallet refreshes retain unsaved email drafts;
successful email mutations deliberately load the updated pending address. The
shared picker receives fresh Web3-off state and is reset when the current choice
changes. Existing server authorization, approval codes and payout writes are
unchanged. No database migration or real payment-setting mutation is required.

The [Web Interface Guidelines](https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md)
review informed reduced-motion loading and decorative-icon accessibility. The
existing labelled 44px form and responsive settings shell are retained.

## Local verification

- Ten new component tests exposed five failures on the old component: extra
  EVM-only fetching, unbounded loading, overwritten drafts, edits during refresh,
  and missing Web3-off feedback. All ten pass after the fix.
- Combined action/component/origin/access tests: **86/86**, 1.32s.
- Touched-file lint and whitespace checks pass.
- Strict build: webpack 30.4s, TypeScript 16.9s, 189 pages. Local launcher uses
  only isolated Preview data and verified Sandbox PayPal credentials.
- Focused Playwright: **5/5**, 15.3s, no retries/skips. Covers personal/company
  receiving choices, stale reviewed pointers, code errors, cancellation, clear,
  EVM/Solana rendering, draft persistence, Web3-off refresh and private access.
  Eight screen sizes from 360 to 2560 include landscape/portrait. Wallet/email
  writes are browser-only fixtures, not real destination changes or emails.
- Real Chrome's retained local account loads the personal settings form and
  honest no-verified-wallet state. Desktop screenshot and phone browser fixture
  inspected; code and Cancel controls fit. No real mutation submitted.
- Browser evidence: `frontend/test-results-release-personal-payment-local/`.

## Deployment acceptance

Preview `dpl_BFaga1YWVGig2gKhZSwUTBawZvzp` is READY (webpack 40s,
TypeScript 18.1s, 189 pages). Its isolated database has 53 migrations, none pending.
Candidate health passed before updating the existing Sandbox alias. Focused
Preview browser checks pass **5/5**, 41.4s, no retries/skips. Evidence:
`frontend/test-results-release-personal-payment-preview/`.

Production `dpl_3BBG14nUjk62GL6WksePop6uQ1Tv` is READY and promoted to
`www.veggat.com`, runtime `0a9372f` (webpack 46s, TypeScript 19.5s, 189 pages;
53 migrations, none pending). Candidate health passed before promotion; Live
health passed afterward (observed warm DB latency 32ms, not a percentile).
Focused Live browser checks pass **5/5**, 36.2s, no retries/skips. Evidence:
`frontend/test-results-release-personal-payment-live/`.

Real Chrome's retained Live owner session was read before and after promotion:
the verified PayPal address and selected personal wallet remain unchanged. Both
eligible choices now carry scope/family labels. Phone screenshot checked at
390px: document width 390px, app container width/scrollWidth both 382px. Actual
scrolling exposes both wallets and the footer; selected state stays legible.
No console errors observed, no setting submitted, temporary viewport reset.
The first resize targeted the other selected tab; DOM measurement caught this,
so the live phone check was repeated on the actually selected tab before claiming
390px acceptance.

Genuine extension/signature acceptance, actual owner-requested payment-setting
changes and the full S1–S9 audit remain separate.
