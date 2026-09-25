# Wallet ownership linking — 25 September 2026

## Security scope

The sidebar previously submitted client-generated messages directly, bypassing
the account's email-code gate and server nonce. Settings used a different flow.
Both now use the same server-issued challenge and cancellable client flow.

- Same-origin requests, authenticated non-demo identity, and IP/user limits.
- Fresh account/Web3/2FA state read under a PostgreSQL user-row lock.
- Standard [ERC-4361](https://eips.ethereum.org/EIPS/eip-4361) messages bind host,
  scheme, account ID, EVM address, chain, server nonce, issue time and expiry.
  Verification reconstructs the expected message; old client-generated or
  legacy unbound messages are rejected. Existing saved wallets are untouched.
- Six-digit codes are scoped to wallet linking, account and host. Ordinary
  login codes cannot be used. Only a purpose-scoped digest is stored, avoiding
  global collisions with ordinary six-digit login tokens. Codes are consumed once in the challenge-creation
  transaction. Replacing a challenge is sequential, never parallel deletion.
- The verification winner consumes the challenge and creates/updates the wallet
  in the same transaction. Failure rolls both back; concurrent replays cannot
  create duplicate wallets or notifications. Existing receiving choices remain.
  The existing first-wallet receiving default is retained and disclosed in the
  signed message; proof does not transfer money.
- Connector metadata is display-only. EOA personal signatures are supported;
  this does not implement ERC-1271 smart-contract wallet verification.
- Cancellation aborts the client request and ignores late wallet signatures.
  POSTs are not automatically retried after uncertain network outcomes. Once
  a verification POST reaches the server, cancellation cannot undo a commit.

## Focused evidence

- 38 tests pass: 13 request-boundary tests, 9 client lifecycle tests and 16 real
  PostgreSQL cases in a random disposable schema of the isolated Preview DB.
- PostgreSQL: local/Preview/Live message origins, three-way concurrent replay,
  challenge replacement, wrong owner/origin/signature, expiry, changed 2FA,
  disabled Web3, failed-wallet-write rollback, existing destination preservation,
  repeated linking, exact codes, concurrent code use, expiry and code purpose.
  The actual route handlers also complete a code-gated disposable signature,
  reject a concurrent replay, return the wallet DTO and invoke one mocked email.
- Initial database harness failures were missing User columns in the minimal
  fixture. Narrowed an unnecessary full-row return and included updatedAt.
  No production table/schema or real wallet was changed by those tests.
- Local browser 3/3 passes on the first hydrated run (8.0s, no retries/skips).
  Both Settings and sidebar exercise code-required, incorrect-code, signing
  and success states at 360/390/844/1280/2560 widths. Endpoint tests use real
  anonymous/cross-origin denials. Positive UI requests use browser-only fixtures
  and a dummy EIP-6963 signer; the server session remains a protected demo.
  This is not real extension/provider signing acceptance.
- The first browser run dispatched NextAuth's focus-refresh before hydration;
  it correctly remained in demo mode. The test now waits for an actual working
  UI interaction before refreshing its client-only fixture.
- Real Chrome local checks found ordinary text using break-all; that was fixed.
  The interface/testing skills informed labeled code entry, 44px controls,
  inline status, responsive reflow and targeted regression coverage.

Final strict local build passes (32.8s webpack, 15.7s TypeScript, 188 pages),
as does touched-file lint. Final local browser **9/9 passes**, 21.8s,
no retries/skips, including previous cache, address separation, activation and
disconnect regressions. Final 390px screenshots of both code forms were visually
inspected; the sidebar uses the full card width. Real Chrome verifies ordinary
phone text wrapping on the final build, and its viewport override was reset.
Artifacts: `frontend/test-results-release-wallet-link-local-final/` (ignored).

Live deployment evidence will be added after verification. Wallet login, primary/rename/delete mutation security,
real extension signing and production crypto checkout remain separate work.
