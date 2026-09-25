# Receiving-wallet choices — 25 September 2026

Status: **PARTIAL — deployed; company-page and genuine crypto acceptance open**.
See the [combined release](wallet-combined-release-2026-09.md). Wallet login is
aligned and verified with a disposable signer, not a real wallet extension;
these checks do not prove that the entire S6 slice is complete.

## Changes

- Personal and company seller actions use the same transactional approval
  service. Fresh account state, verified ownership, and current company ownership
  are checked under row locks. No creator-only permission fallback.
- Codes are six ASCII digits, stored as digests, and bound to user, host, target,
  action, requested wallet and existing receiving choice. Consumption commits
  with the destination write; failures roll back both. Browser results contain
  neither the code nor recipient. Existing Next Server Action CSRF checks remain.
- Clear requires the expected current wallet, so a stale tab cannot clear a newer
  destination. It preserves the wallet link and chooses no replacement. A new
  company owner can clear the previous owner's destination without changing that
  person's wallet or personal default.
- Company-owned flags remain separate from personal flags. The saved EVM-wallet
  action and seller settings agree on one personal receiving pointer across
  wallet families. Manual, unverified and foreign wallets cannot be selected.
- One shared picker supplies user/company confirmation, cancellation, incorrect
  code feedback, double-submit protection, 44px controls and responsive wrapping.
  An uncertain timeout locks further changes until a refresh; late client
  responses cannot falsely report success. Refresh does not undo a server write.
- Wallet list failures show retry, not an empty-account claim. Company load/save
  failures produce inline feedback; removing its PayPal email requires confirmation.
  Company email input has a label and a native keyboard-submit form.
- Seller copy is shorter, with secondary payment availability in a disclosure.
  Saving an email or wallet is explicitly not activation of a checkout method.

## Evidence

Final focused batch: **138 passed**, nine files, 49.38s. This includes **49 real
PostgreSQL cases** in a validated random disposable schema of the isolated
Preview database and 89 action/request/client checks. Coverage includes conflicting
choices, company transfer, stale clear, cross-scope codes, concurrent replay,
expiration, rollback, and previous linking/mutation/default-isolation regressions.
All emails are mocked; there are no funded test wallets or production DB writes.

Strict production-style local build passes: webpack 35.7s, TypeScript 14.0s,
188 generated pages. Touched-file lint passes without exemptions. Five company
component checks were added after the build and pass; standalone TypeScript
also covers the final test source.

Final local Playwright: **10/10**, 20.3s, no retries or skips. The new seller flow
checks 390×844, 1280×800, 360×800, 844×390, 768×1024, 1024×1280,
1920×1080 and 2560×1440. It verifies code correction, preserved selection until
success, clear cancellation, expected-pointer submission and no horizontal page
overflow. Previous wallet boundary/linking/cache tests also pass. Positive browser
Server Actions are intercepted; DB behavior is independently exercised above.
Artifacts: `frontend/test-results-release-payout-choice-local-final/` (ignored).

The first browser run was 9/10 because the mock treated React Flight's encoded
`$undefined` code as a supplied code. The fixture now decodes that value; no
production guard was relaxed. An initial unit failure was similarly a reset
mail-cleanup mock; the final batch above includes the corrected fixture.

Visually inspected 390/1280/2560 screenshots. Real Chrome, using the actual
local signed-in session, confirms the empty receiving state, compact disclosure,
390px page and drawer scrolling, Escape focus restoration, 1280px independent
settings-sidebar scrolling, and no captured console errors. Viewport restored.
No real wallet signature, payout change, email, payment or secret operation.

## Remaining acceptance

- Wallet-login alignment is deployed and verified with a disposable signer;
  real extension acceptance remains separate.
- Company-page browser acceptance with an isolated owner fixture; shared picker
  behavior and company component failure states currently have unit/DB evidence.
- Preview/Live deployment and post-deployment checks pass in the linked release.
- Genuine wallet extension/crypto checkout, configured OAuth/provider checks and
  the other open full-goal scoreboard items remain separate.

The web-interface-guidelines skill informed labels, touch targets, inline states
and concise disclosure. The webapp-testing skill informed rendered-state checks;
the project's existing Playwright runner supplies the isolated fixtures. The
computer-use skill informed real-Chrome scrolling and read-only verification.
