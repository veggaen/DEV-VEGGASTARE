# Wallet display evidence — 25 September 2026

## Change

- Wallet cards reconcile by family and address, never by social email/name.
  EVM casing duplicates can merge; Solana addresses remain case-sensitive.
  A newly active address cannot inherit another address's database ID,
  verification, default-payout badge or donation total.
- Removed legacy render-time metadata POSTs and guessed “address drift”
  migrations. Existing saved addresses remain visible, not silently replaced.
  No database wallet, signature, payout address or payment was changed.
- Separated registry synchronization and display calculation into bounded
  functions. Full hooks lint now finishes in seconds with the unchanged rules,
  rather than spending over 15 CPU minutes on the component's combined paths.
- Development-chain polling uses the existing query cache, cancels requests,
  checks the actual chain ID, clears timeout handles and retains prior status
  during background refresh. It does not run on normal production browsing.
- The delayed-panel test caught an 8px scroll-height change. The reserved
  navigation slot now includes that space; acceptance checks 360 and 390px.

This is a focused wallet UI/correctness slice, not production crypto-checkout
acceptance. Ownership still requires the existing server challenge/signature
flow; sidebar presentation is not proof. Real wallet signing/transfers are
not performed by this slice.

## Verification

- 22 unit tests pass: exact-address reconciliation, immutability, non-EVM
  casing, selection, bounded/cancelled probes and existing activation safety.
- Full lint passes on the wallet panel, topbar, helpers, tests and consolidated
  browser suite. No rule disabled in the committed code/configuration.
- Initial strict build passes. Initial local browser batch: 3 pass; one
  loading-geometry test exposed the 8px shift described above, then corrected.
- Final strict webpack/TypeScript build passes (188 pages); corrected local
  browser batch **5/5 passes**, 14.2s, no retries/skips. Both delayed-panel
  widths now preserve exact scroll height/position. Identity/activation tests
  cover 360/390/1280/2560; cancellation and disconnect preserve app login.
  Live browser batch **5/5 passes**, 26.9s, no retries/skips.
  Source `7101bd3` is promoted to `https://www.veggat.com` as
  `dpl_91FYRUpZa1UD71DgMYxifXgYr1qE`. Candidate health is healthy.
- Real Chrome local chooser opens and presents detected browser wallets plus
  a truthful unavailable WalletConnect state for the local configuration.
  No wallet connection, signing or permission prompt was accepted.
- Real Chrome also verifies local drawer scrolling at 390×844 and the Live
  owner's two distinct saved verified addresses at 2498px. Both wallet cards
  and their controls remain reachable; no horizontal page overflow was found.
  Owner activation, removal, signing and transfers were not exercised.

The composition skill informed separation of display calculations; the testing
skill informed the focused regression batch. The layout pass used
[Vercel's interface guidelines](https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md)
for stable loading geometry and accessible refresh controls, not a new design
system or a claim of whole-file visual compliance.
