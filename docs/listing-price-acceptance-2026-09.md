# Listing price and form acceptance — September 2026

## Scope and authority

Application commit: `08d9937` on `release/showcase-september`; main is unchanged.
This slice corrects seller draft pricing and core form accessibility. It does
not enable general-listing checkout, crypto-denominated prices or Web3 payment.
Deployment acceptance is recorded below. Rollback is the preceding seller
publication release `9eac374`, production `dpl_Epxd7YKi27qXwmqF8AfdwMcAN1Nb`
(`dev-veggastare-77vp7p36k-v3ggas-projects.vercel.app`).

## Corrections

- Listing currency now reads the same form field that is restored and submitted.
  The old independent USD selector could disagree with a saved NOK draft.
- A text buffer preserves decimal typing such as `12.` and accepts `49,99`.
  On blur, valid amounts normalize to `49.99`. Blank, negative, exponent,
  ambiguous separators, more than two decimals and amounts over 1,000,000 are
  rejected rather than silently stripped/reinterpreted. This is UI parsing,
  not a replacement for the existing authoritative publication validation.
- Price, currency, condition and download-limit controls have associated labels.
  Core listing inputs use 16px text and at least 44px height. Category removal
  and currency/token preferences expose accessible names/pressed state.
- Shared form errors use readable light/dark text colors. Existing design
  primitives remain in use; no new design system or dependency was introduced.
- Payment messaging is honest: reviewer Sandbox/Live status comes from the
  server capability response, and saved currency/token preferences do not
  activate unreleased checkout. Disabled/unreachable crypto-price UI is removed.

## Reproduction and local verification

Two new browser regressions failed on the previous production source before
the correction: a restored NOK draft displayed USD, and light-theme error text
measured 3.60:1 contrast (required at least 4.5:1). Assertions were retained.

- Touched-file ESLint and `git diff --check` pass.
- 47/47 focused units pass across price parsing, publication helpers and the
  publication action. The new parser contributes 22 cases.
- Strict production build and TypeScript pass; 188 generated routes.
- 4/4 local browser tests pass (11.8s): restored currency and decimal editing
  at 390/1280; error contrast and field geometry in light/dark at 390; review
  recovery across eight sizes 360–2560 including landscape; anonymous/demo
  private-asset HTTP guards. No intercepted publication or payment result.
- 1/1 real local stale-context private upload/publication regression passes
  (9.7s). The isolated password seller uploads a JPG and private TXT, publishes,
  and sees a decoded image on its browse-only PDP. Cleanup archives that test
  seller's listings, deactivates assets and disables its sign-in. No live rows
  or payment are changed; inactive synthetic storage objects remain.
- Real Chrome at 390 verifies actual comma entry, normalized price, NOK
  selection, accessible controls and content scrolling. Automated review
  screenshots were also inspected. Browser viewport restoration is recorded
  with deployed acceptance below.

## Deployment acceptance

- Preview: `dpl_7QQp5YFFySuQ1stwUARovDEj4XiU` /
  `dev-veggastare-npwrcunqm-v3ggas-projects.vercel.app`. The stable
  `showcase-ai-revival` alias was inspected against this exact READY ID.
- Build and TypeScript pass against the isolated Preview database; 48 existing
  migrations, none pending. **4/4 deployed read-only tests pass (23.1s)** and
  **1/1 real stale-context upload/publication passes (17.8s)**. Test cleanup
  completed. Real Chrome also confirms the new labels and server-derived
  Sandbox-only status on the deployed form.
- Real Chrome keyboard scrolling reaches the lower token controls and Continue
  at 390px. The temporary viewport override was reset before leaving local QA.
- Production: `dpl_3maNEBbPW77m28QLgu127w64hT9P` /
  `dev-veggastare-h7vklvh3x-v3ggas-projects.vercel.app`. Its strict build and
  TypeScript pass against the production database; 48 migrations, none pending.
  Before promotion, candidate health was healthy and payment capabilities
  correctly reported reviewer-only Live PayPal. The live domain still resolved
  to the preceding seller-publication deployment at that point.
- After promotion, `www.veggat.com` was inspected against the exact new READY
  ID. **4/4 live regression tests pass (30.8s)** with retries disabled, including
  the same currency, light/dark contrast, eight-size review and HTTP guards.
  These are read-only demo/anonymous checks, not live publication or payment.
- Real Chrome's live owner session confirms the labeled price/currency controls
  and `Reviewer products use PayPal Live.` No owner values or settings were
  submitted. Captured browser error logs are empty for that inspection. Existing
  PayPal, owner-payment and email-provider handoff tabs remain open.
- Artifacts are local and excluded from commits/deployment:
  `frontend/test-results-release-listing-polish-{baseline,local,preview,live}/`
  and `frontend/test-results-release-publishing-write-{local,preview}/`.

## Boundaries

Tests seed a synthetic sessionStorage draft only inside the isolated browser
context. They do not prove persistence of every optional seller field. Core
error contrast does not certify the entire site against WCAG. Physical-phone
keyboard behavior, native 125% zoom and exhaustive route/button QA remain open.
General marketplace and verified Web3 checkout remain unreleased. Owner Live
micro-purchases/refund, human inbox delivery and legal review remain separate.

Webapp-testing informed focused read-only versus real-write verification;
Web Interface Guidelines informed readable errors, labels and target geometry;
computer-use informed real-browser inspection and viewport restoration.
