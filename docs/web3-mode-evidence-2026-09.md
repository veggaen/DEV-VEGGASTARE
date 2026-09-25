# Web3 mode confirmation — September 2026

Status: **PARTIAL: local implementation; not deployed**. Scope is account access
and the settings UX, not acceptance of on-chain payments or real extensions.

## Changes

- One active PATCH flow replaces the direct toggle and obsolete email-link
  mutation. The request requires same origin, authentication, a non-demo user,
  strict input and a durable, fail-closed per-user/IP limit.
- A shared account row lock serializes mode, wallet and OAuth changes. The
  submitted previous value must match the database. Disabling wallet sign-in
  requires a password with verified email or a linked, configured OAuth provider.
- When 2FA is enabled, a verified email and an exact, hashed six-digit code are
  required. Approval is scoped to user, host, transition and email. Code
  consumption, setting change and invalidation of other pending mode codes are
  one transaction. Failed writes roll back; concurrent replay cannot double-apply.
- Reading the setting never changes wallets, payout destinations, verification
  evidence or account access. The UI renders a neutral loading state, not an
  unverified off state. Opening or cancelling confirmation does not send a PATCH.
  Acknowledged writes update the shared cache. Uncertain outcomes require reload.
- Old security-action links are informational only and public, with no-referrer
  metadata. The old Server Actions cannot send email or mutate an account.
  Removed unused token/mail helpers remain recoverable in Git; no database records
  were deleted. The SecurityActionToken model remains for other existing uses.
- Sidebar activation opens Settings instead of providing a parallel write path.
  Signed-in server preference overrides old local-storage opt-ins in the topbar
  and automatic AppKit initialization.

The review used [OWASP token guidance](https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html)
for bounded, one-use approvals and preserving account access. The
[Web Interface Guidelines](https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md)
informed explicit confirmation, labelled code entry, focus restoration and
truthful loading/error states. These checks are not a full security audit.

## Verification and findings

- PostgreSQL uses a uniquely named, disposable schema in the isolated Preview
  database. No production database writes. Tests cover enable/disable, recovery
  guards, stale expected state, demo/missing users, wrong host/account/email/
  purpose, expired and malformed codes, concurrent replay and transaction rollback.
- The initial database run had two fixture failures (missing required wallet
  labels), not runtime bypasses. Corrected focused run: 16/16 new cases pass.
  Final integrated run: 266/266 across 17 files, 100.77s, including 89 real
  PostgreSQL cases and eight AppKit checks covering stale-browser-opt-in rejection.
  Final production-style build passes: webpack 36.3s, strict TypeScript 12.4s,
  189 static pages. Touched-file ESLint passes.
- The first browser run was 8/14. Failures were a hidden-under-modal locator,
  legacy route still requiring login, a missing authoritative GET fixture, and
  obsolete sidebar button selectors. The retired notice is now public and the
  fixtures follow the real UI. Corrected browser run: 14/14, 33.5s. Final rebuilt
  acceptance, including the stale-opt-in fix: 14/14, 31.9s, no retries/skips.
- Real Chrome screenshot inspection caught a real visual defect: DialogTrigger
  overwrote the switch's checked styling state. The trigger is now separate and
  explicitly restores focus. Unit and browser checks assert the checked data
  state, not only aria-checked.
- Browser-only approval fixture covers loading, Cancel, wrong-code correction,
  keyboard submit, acknowledged state and eight sizes: 360×800, 390×844, 844×390,
  768×1024, 1024×1280, 1280×800, 1920×1080, 2560×1440. Inputs are 48px; submit
  controls are scrolled into view; no horizontal page/dialog overflow.
- The real localhost wallet login fixture creates a disposable, unfunded EOA
  account, verifies authentication, rejects disabling its only sign-in method,
  confirms mode remains enabled, logs out and rejects proof replay. No real
  provider wallet or funds are used. Successful mode changes are verified in
  isolated PostgreSQL; browser positives are intercepted fixtures, not owner writes.
- Real Chrome retained the owner's local session. Opened confirmation without
  submitting; inspected desktop, phone and landscape, cancelled, confirmed saved
  state unchanged and focus restored. Phone page/footer and drawer scrolling
  checked. Console errors: none. Viewport override reset.

## Remaining

- Deploy these changes with the preceding wallet-login, receiving-choice and
  wallet-mutation commits to Preview, validate there, then Production and Live.
- Real extension acceptance, company payment-settings browser coverage and actual
  crypto payment acceptance remain separate unfinished requirements.
- No real email, payment, AI generation, signature, credential rotation or owner
  account setting was changed for this slice.

Final artifacts: `frontend/test-results-release-web3-mode-local-accepted/`.
Earlier corrected run: `frontend/test-results-release-web3-mode-local-final/`;
initial diagnostics: `frontend/test-results-release-web3-mode-local/`.
