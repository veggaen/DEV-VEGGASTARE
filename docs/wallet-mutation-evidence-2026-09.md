# Wallet changes — 25 September 2026

Status: **PARTIAL; local implementation, not deployed**. The currently accepted
Live runtime remains `ec4d88f`. This is not full wallet/payment acceptance.

## Changes

- PATCH accepts explicit rename/set-primary actions or the exact legacy
  code-only shape. Invalid rename/unknown fields cannot become set-primary.
- Same-origin, authenticated non-demo identity, IP/user limits and no-store
  responses also cover rename, removal and manual wallet creation.
- Fresh account state and wallet ownership are checked under row locks.
  A receiving wallet must be verified, personal and owned by the current user.
- Email codes bind the action, wallet, user and host; only a digest is stored.
  Exact six-digit validation replaces padded comparisons. Consumption and
  destination/wallet writes share a transaction and roll back together.
- Receiving selection updates both the User pointer and EVM primary flags.
  Removal never automatically selects another address. Product/token/company
  references block removal; donation history cannot be cascade-deleted.
- The generic creation route no longer uses an OR filter with undefined owner
  fields to clear defaults. Manually entered addresses cannot grant proof or
  become defaults. Company creation requires current ownership, not creatorship.
- The saved-wallet form has labeled one-time-code entry, inline errors,
  explicit actions, double-submit protection, bounded requests and 44px controls.
  Removal/code cancellation sends no mutation; an already-submitted request
  cannot be undone by aborting the browser request.

## Evidence and limits

Initial focused batch: 78 checks pass, including 34 real PostgreSQL cases in a
validated random disposable schema of the isolated Preview database. One first
request-unit import failed because it reached the Next-only DB module; the
test boundary now mocks the unused DB dependency. No guard was weakened.

Initial strict build passes (38.6s webpack, 16.9s TypeScript, 188 pages), as do
standalone TypeScript and touched-file lint. Initial local browser **9/9**
passes (19.3s, no retries/skips), covering 360/390/844/1280/2560 widths,
receiving selection, incorrect-code errors, removal cancellation, confirmation,
unverified-wallet disablement, endpoint denials and previous linking/cache tests.
390px and 1280px action screenshots were visually reviewed. Real Chrome local
390px scrolling/empty-state checks pass; the viewport override was reset.
Positive browser mutations use intercepted fixtures; real database behavior
is exercised by the isolated tests, with mocked email and no funded wallet.

The generic-create hardening was added after that initial build. The final
expanded batch passes **88 checks**: 36 isolated PostgreSQL cases and 52
request/client unit checks. The real database tests include manual creation,
company ownership and preservation of another account's default wallet.
The final strict build passes (36.8s webpack, 16.5s TypeScript, 188 pages),
as does touched-file lint. The final local browser batch passes **9/9 (18.6s)**,
no retries/skips, including real anonymous/cross-origin denials for creation.
Artifacts: `frontend/test-results-release-wallet-mutation-local-final/` (ignored).
Live deployment and Live acceptance are still pending, not implied by these tests.

## Next required work before complete payout acceptance

- `actions/seller-payment.ts` set/remove-default actions remain a parallel path:
  they do not use action-scoped email codes or the same atomic primary flags.
  Both user and company settings must be reconciled, not merely the EVM API.
- Wallet login must reject unverified/manual records, consume nonces atomically
  and bind them to the host. Review last-login-method removal/recovery too.
- Genuine extension signing, production crypto checkout and owner-only provider
  permissions remain separate acceptance items. No real wallet signature,
  receiving choice, purchase, email or customer-data mutation occurred here.
- The pre-hydration Settings help-disclosure first-click issue remains open.

The interface-guidelines skill informed labeled controls, inline feedback and
responsive wrapping. The webapp-testing skill informed targeted rendered-state
checks; the existing app Playwright runner supplies the isolated fixtures.
