# Seller purchase-request review — 24 September 2026

Status: release candidate, not yet deployed. This adds an operational review
inbox; it does not certify legal compliance or complete a payment/refund.

## Behavior and security boundaries

- `/my-sales/requests` is linked from Sales and requires a real session.
  Its private/no-store API pages at 20 requests and includes only orders whose
  **every line** belongs to the seller or a company they own/manage. Admins may
  inspect nonempty orders. Demo identities see no real buyer correspondence,
  cannot submit seller decisions, and retain access to their own buyer notices.
- The server returns limited order/payment evidence, file-request counts and
  retained delivery-request wording. It does not disclose buyer emails, private
  file URLs, or a raw checkout quote. File requests do **not** prove a complete
  download, a file being read, or automatic loss of mandatory rights.
- An approval is explicitly **for follow-up**, not “money refunded.” A decline
  requires a buyer-visible explanation. Neither decision grants/revokes files,
  edits credits, captures PayPal, or changes the order/payment state. The old
  REFUND action continues to reject unverified refunds; provider reconciliation
  remains the only path for confirmed financial reversals.
- Origin, session, durable rate limit and whole-order permission checks remain.
  The browser must send the revision it reviewed; outdated revisions return
  409. A transactional status/revision compare-and-swap prevents competing
  decisions from overwriting each other. Ownership is checked before that
  transaction; this is not a claim of atomicity with concurrent company-role edits.
- Filters/pagination live in the URL. In-flight loads are abortable and malformed
  successful responses cannot announce a saved decision. Drafts survive service
  failure, stale revision and uncertain response refresh. Filter/page controls
  are disabled while a draft is unsaved; beforeunload warns on leaving. Internal
  client-side navigation is not a comprehensive persistent-draft system.
- No real buyer decision was submitted by QA. Seller decision email notices are
  not added by this slice; the buyer reads the response on the receipt.

## Verification

- Touched ESLint passes. Focused payment/demo/cron units: **229 passed**, 11 opt-in
  database/provider cases skipped by the ordinary run.
- **Four actual PostgreSQL tests pass** in a random disposable schema on the
  isolated Preview branch, with certificate-verified TLS. Synthetic fixtures
  prove mixed/foreign/empty/non-manager exclusions, next-read role revocation,
  admin/demo limits and one winner among eight competing revision updates.
  The concurrency case exercises the Prisma statement, not a signed-in HTTP
  seller mutation. The temporary schema is removed; public records are untouched.
- The real query test caught an issue the mocked query-shape test missed:
  negating `owner OR nullable-company` under SQL's three-valued logic admitted
  foreign lines. An explicit `companyId IS NOT NULL` guard fixes the predicate.
  `Product.userId` is non-nullable in the real schema. The initial attempt to
  apply a nullable filter to it failed Prisma/TypeScript and was corrected,
  without weakening the original mixed-seller assertions. Nothing was deployed
  from either failing version.
- Browser acceptance uses two complementary checks: intercepted synthetic seller
  responses for failure/success UI, plus **unmocked** anonymous/demo route guards.
  There is no fabricated real payment or claim of an actual seller refund.
  A first selector matched Next.js's route announcer as well as the intended
  error; scoping it to the request content corrected the test, not the behavior.
- UI guidance informed labelled 48px controls, keyboard focus, retained drafts,
  error-vs-empty states, bounded content width and reduced-motion skeletons.
  Scroll/overflow checks cover 360, 390, 844 landscape, 768, 1024, 1280, 1920 and
  2560. Local 390/1280 screenshots revealed a clipped native option and stale
  validation text; the option is shorter and field errors clear after correction.
  Native 125% desktop zoom is not verified by these viewport tests.
- Final-source strict production-style build/TypeScript and touched lint pass.
  Local five-check browser acceptance passes; deployed results follow below.

## Release and rollback

No schema or environment changes are required. Until promotion, production stays
on `82727bd` / `dpl_5yuYw7bESbW9aW6AWsSjM6xFmsrr`; that is also the rollback
target for this slice. Existing correspondence and review records must be kept.

Open gates: owner Live micro-purchases/refund verification, real-person email
delivery, full-agreement durable delivery and Norwegian legal review, remaining
OAuth/wallet/integration checks, and full-route interactive QA. A passing seller
slice is not an “excellent app” or whole-mission completion claim.

Guideline source: [Web Interface Guidelines](https://github.com/vercel-labs/web-interface-guidelines/blob/main/command.md).
