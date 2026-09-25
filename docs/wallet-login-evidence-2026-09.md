# Wallet sign-in acceptance — September 2026

Status: **PARTIAL — local implementation; not deployed**. This is one security
slice, not a claim that every authentication method or wallet integration passes.

## Changes

- Standard [ERC-4361](https://eips.ethereum.org/EIPS/eip-4361) messages bind the
  exact local/Preview/live host, chain, ten-minute lifetime and a hash of an
  HttpOnly browser cookie. HTTPS uses a host-only `__Host-` Secure cookie.
- The callback accepts the issued challenge ID and signature, never a client
  assertion of which user owns an address. Same-origin checks and durable
  fail-closed authentication limits protect nonce, prepare and authorize steps.
- Only verified personal EVM links resolve a returning user. Manual, company,
  non-EVM and unowned records are not login authority and are never claimed.
  Legacy ambiguous ownership fails closed.
- Sign-in and linking share an address advisory lock before account locks.
  Nonce consumption, purpose-scoped 2FA consumption and new-user/wallet writes
  commit together. Failed writes roll back; racing first logins create one user.
- A wallet-only account cannot remove its last usable login wallet without
  another sign-in method. Sign-in itself never changes a receiving destination.
- Direct and AppKit flows bind the selected connector/account/network, cancel
  late prompts, allow email-code correction and require reload after an uncertain
  authentication outcome. Missing auth responses are not treated as success.
  Direct extensions remain available without a WalletConnect project ID.
- Code entry uses a labelled 48px input, keyboard submit, inline errors and
  explicit cancellation. Inactive wallet buttons are hidden while signing in.
  EOA-only support is disclosed; contract-wallet authentication is not implemented.

## Verification

- **214/214** focused checks across 14 files, including **73** tests against a
  uniquely named disposable PostgreSQL schema on the isolated Preview database.
  Final run: 87.16s. Includes existing payout/link/mutation tests, wallet auth
  callback checks, session revocation and durable limiter tests.
- Final production-style local build: webpack 33.1s, strict TypeScript 14.2s,
  189 static pages, exit 0. Touched-file ESLint and standalone TypeScript pass.
- Initial browser acceptance: 11/12. The code-form fixture failed to intercept
  Auth.js's callback URL with its trailing `?`; it now matches that query too.
  No auth bypass was introduced. Corrected run: **12/12**, 27.3s. Final compact
  UI run: **12/12**, 28.1s, no retries/skips.
- One disposable, unfunded EOA completed the real UI → nonce → signature →
  callback → authenticated session → logout path on localhost:3000, then replay
  failed. Its private key stayed in test memory and was discarded. QA user IDs
  are retained in the isolated local test artifacts, not in Production.
- The code-form browser fixture sends no email and never forwards proof/auth
  writes. It covers wrong-code feedback, cancellation, reconnect-free retry,
  Escape/focus restoration and eight sizes: 360×800, 390×844, 844×390, 768×1024,
  1024×1280, 1280×800, 1920×1080 and 2560×1440. No horizontal page/dialog overflow.
- Real Chrome preserved the existing signed-in local session. The connection
  chooser was inspected at 390×844 and scrolled at 844×390; Escape restored the
  trigger focus. Viewport override was reset. No actual extension was connected,
  no real signature requested, and no real wallets/payouts changed.
- Screenshot review of phone, desktop and landscape code entry prompted removal
  of redundant busy wallet buttons and shorter chooser copy. Final phone and
  desktop forms fit without dialog scrolling; landscape retains inner scrolling.
  The submit-control visibility assertion explicitly scrolls short viewports.
  That strengthened code-form check passed separately: **1/1**, 7.8s, no retry.

## Remaining before combined deployment

- `actions/security-action.ts` still uses the older Web3 enable/disable email
  flow: padded code comparison, ordinary-login code scope and separate token /
  setting writes. Harden and test that path, including recovery from disabling
  Web3, before accepting the combined wallet security release.
- Real Chrome reload also exposed a pre-hydration Web3 toggle briefly displaying
  disabled mode before the signed-in account state arrived. Keep the control
  disabled/neutral while resolving that state in the follow-up.
- Preview then live deployment/acceptance of this slice and the two preceding
  wallet-mutation/payout commits; real-extension sign-in with owner consent;
  company settings browser acceptance. Do not equate dummy-signature UI tests
  with real extension acceptance or with working crypto payments.
- No live payment, AI generation, email, credential rotation or production
  database mutation was performed for this slice.

Final artifacts: `frontend/test-results-release-wallet-login-local-accepted/`.
Submit visibility screenshots: `frontend/test-results-release-wallet-login-local-submit/`.
Earlier diagnostic runs remain under the `test-results-release-wallet-login-*`
directories. They are not substitutes for the final accepted result.
