# Wallet read and cache safety — 25 September 2026

## Scope

- `GET /api/wallets/evm` no longer assigns a primary wallet or changes the
  user's receiving-wallet setting. Personal EVM ownership filtering and
  confirmed-only donation totals remain. Responses are private/no-store.
- Retired the unused automatic metadata POST with a constant 410/no-store
  response. It no longer reads or changes wallet records, or logs social email.
- Wallet session-storage data is shape-checked and bounded. Malformed rows
  are ignored while valid display entries survive. Cached database IDs,
  verification, payout and credit fields are discarded; the current server
  records supply any database identity again.
- No customer wallet, primary destination, payment, email, secret, balance or
  production schema was changed during acceptance.

## Evidence

- The previous production-style local build reached the app's fatal-error
  boundary for all three cache fixtures: object, null, mixed invalid rows.
- 50 unit tests pass across registry parsing, read safety, address-bound
  display, activation and bounded chain probes.
- One isolated PostgreSQL test passes: three concurrent listing requests
  return only the owner's personal EVM wallets, exclude pending donation
  amounts and leave every wallet row and the receiving-wallet pointer
  unchanged. It creates and removes only its random disposable schema in
  the isolated Preview database; no public tables are touched.
- Strict local webpack build passes (35.3s compilation, 18.7s TypeScript,
  188 pages). Full touched-file lint passes.
- Final local browser batch **9/9 passes**, 17.9s, no retries/skips. Covers
  malformed-cache recovery at 390/1280, valid card preservation, private API
  denial/retirement, address separation, activation cancellation, connect/
  disconnect and delayed drawer geometry at 360/390. Existing address tests
  also cover 2560px. Initial post-fix test failures were fixture selectors:
  the disabled-Web3 state exposes Enable Web3, and AUTH cards use custom labels.
- Real Chrome confirms the rebuilt local settings and scrolling drawer work
  without connecting or signing with a wallet. The 390px cache screenshot was
  visually inspected. The testing skill informed the focused regression
  workflow instead of a full unrelated E2E run.

Source `33cf187` is READY and promoted to `https://www.veggat.com` as
`dpl_FcLbY8X9CWFBrbqA7e9hE5MpwDc8`. Remote build/TypeScript passes, with
53 migrations and none pending. Candidate and Live health pass. The identical
Live batch **9/9 passes**, 39.4s, no retries/skips. Real Chrome verifies the
owner's two saved verified wallets and unchanged primary selection before
and after Refresh. No wallet signing, metadata/payout edit or transfer was
performed. Separate standalone TypeScript checking passes after the test edits.

This does not prove real wallet signing or production crypto checkout.
Challenge, account-binding and mutation security acceptance remains a separate
next slice.
