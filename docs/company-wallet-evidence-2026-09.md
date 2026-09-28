# Company receiving wallets — 25 September 2026

## Scope

Runtime source `e5feb4c` fixes the company page's empty wallet selector: it
previously received only company-owned wallets, although the setter also allowed
the current owner's verified personal wallets.

Payment status now returns minimal verified choices after locking and checking
the current owner. Personal and company ownership are mutually exclusive;
foreign, unverified and ambiguous records are excluded. Labels distinguish
“Your wallet” and “Company wallet.” Web3-disabled accounts retain their current
destination display but get an explicit settings link instead of active choices.
PayPal email setup remains independent of Web3 mode.

Both personal and company setters require the receiving pointer the browser
reviewed. A concurrent change rejects the stale request before issuing an approval
code or changing defaults. Company choices still cannot modify personal defaults.
The selected destination, action, host and target remain bound to one-use approval.
There is no migration, payment, real wallet change, key rotation or email send.

The company status read has a 12-second deadline, retry and late-response guard.
Refreshing wallet choices does not overwrite an unsaved email draft. Controls
remain locked during refresh; the picker resets when its authoritative choice
changes. Existing token colours, 44px controls and wrapping address layout are used.
The [interface guidelines](https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md)
informed the labelled, keyboard-accessible and narrow-screen review.

## Local evidence

- 76 focused action/component/access/origin tests pass.
- 110 real PostgreSQL checks pass in two uniquely named disposable schemas on
  the isolated Preview database (95.66s). Includes ownership transfer, personal
  versus company choices, disabled Web3, stale setters, replay, concurrent writes
  and rollback. Both schemas were removed and absence checked.
- Strict build passes: webpack 29.9s, TypeScript 12.8s, 189 pages. Initial build
  caught a test-only discriminated-union mismatch; corrected before release.
- Touched-file lint and whitespace checks pass.
- Focused Playwright 5/5, 14.4s, zero retries/skips. Company and personal flows
  cover code rejection, cancellation, selection, clearing, draft preservation,
  real access boundaries and recovery. Browser-only action fixtures prevent
  actual payout changes or emails. Screens: 360/390/landscape/768/1024/1280/1920/2560.
- Phone and desktop screenshots inspected. The first browser run exposed a
  fixture failing to decode React Flight's undefined marker, not a provider or
  application rejection. Initial failure retained; corrected final evidence is
  `frontend/test-results-release-company-wallet-local-final/`.

## Deployment acceptance

Preview `dpl_2DYRfQMJ8z1T5jz5B6vC8tFRGiP1` is READY (webpack 43s,
TypeScript 19.5s, 189 pages). Its isolated database has 53 migrations, none pending.
Candidate health passed before updating the existing Sandbox alias. Five focused
browser checks pass there, 37.1s, zero retries/skips. Evidence:
`frontend/test-results-release-company-wallet-preview/`.

Real Chrome local access recovery also passes: the retained non-member account
cannot open company settings and its Public profile link reaches the storefront.

Production `dpl_4R6K4gm5vduADBLBH8tx4uJgETrC` is READY and promoted to
`www.veggat.com`, runtime `e5feb4c`. Strict build passed (webpack 45s,
TypeScript 19.6s, 189 pages); 53 migrations, none pending. Candidate health and
anonymous company 401/private-no-store checks passed before promotion. Live
health passed (observed warm DB latency 31ms; not a performance percentile).
Five focused Live browser checks pass, 42.5s, zero retries/skips. Evidence:
`frontend/test-results-release-company-wallet-live/`.

Real Chrome's retained live owner session shows both eligible verified personal
wallets, each labelled Your wallet. No company receiving wallet is selected,
unchanged by QA. Desktop layout and 390px phone screenshot inspected; document
width is 390px and the app container has no horizontal overflow. Actual scrolling
reaches the footer (537px scroll offset). The 844×390 navigation drawer scrolls
to its last controls and Escape closes it with focus returned to Open menu.
Viewport reset; no console errors observed. No real payment-setting mutation or
verification email was submitted.

Genuine extension/signature acceptance and real owner-requested destination
changes remain separate. This slice is not whole-app or crypto-checkout sign-off.
The unused legacy `resolveCheckoutPayment` action still assumes an EVM fallback
family; no callers were found. Audit or remove it before reusing it for checkout.
