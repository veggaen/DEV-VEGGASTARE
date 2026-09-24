# Seller purchase-request review — 24 September 2026

Status: deployed and verified locally, in Preview and on www.veggat.com. This adds an operational review
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
  Local five-check browser acceptance passes **5/5 (11.1s)**.
  Final Preview acceptance passes **5/5 (17.9s)** without changing assertions.
  Live acceptance passes **5/5 (30.7s)**. Deployed 390/1280 screenshots were
  reviewed; all eight viewport/scroll checks run inside the seller UI journey.
  Real Chrome's existing owner session loads its actual admin-authorized inbox
  and expands retained evidence for the unpaid demo notice. No approval/decline
  or financial action is submitted. The visible evidence says no paid consent.
  Its initial run was 4/5: the first navigation returned the app's not-found page
  immediately after the stable alias switch. The next unmocked route guard
  passed, alias inspection resolved the exact candidate, and an unchanged seller
  rerun passed 2/2 before the final full batch. Alias propagation is a possible
  explanation, not a proved root cause. The initial failure is retained here.
  Real Chrome also verified the actual local demo filter URL and bottom-of-page
  footer at 2498px, plus Sales → Purchase requests → Sales navigation.
  The older Sales dashboard still has mixed-language/legacy styling, an unnamed
  icon link and error-to-empty handling to audit separately; this link addition
  is not a redesign of that dashboard. Old fetch errors occurred during the intentional local server
  stop; no claim of clean historical server/browser logs is made.

## Release and rollback

No schema or environment changes are required. The previous production release
`82727bd` / `dpl_5yuYw7bESbW9aW6AWsSjM6xFmsrr` is the rollback
target for this slice. Existing correspondence and review records must be kept.

Preview **`dpl_FcYcC3KQ7VUcdZBxkDp6QL4GsAUe`**, source **`a902b42`**, is READY at
`https://dev-veggastare-31cjrm3ly-v3ggas-projects.vercel.app` and assigned to the
stable Showcase Preview alias. Its strict build selected isolated Neon
`ep-jolly-smoke-abgwws6k`, with 48 migrations and none pending.

Production **`dpl_2Ed57ytaWJr1BzyuE8ueLH6F2K1F`**, source **`a902b42`**, is READY at
`https://dev-veggastare-kdriviqoq-v3ggas-projects.vercel.app`. It was built without
switching the public domain, passed candidate health, then promoted. CLI inspection
of www.veggat.com resolves this exact deployment. Production selected Neon
`ep-orange-wildflower-abp9cs2l`, with 48 migrations and none pending. The sampled
candidate DB check took 1150ms; this is not a page-speed or percentile claim.
Local :3000 stays on the same app source with isolated Preview data and Sandbox
credentials only. No real payment, refund, new provider call or customer email
was triggered by this slice.

Open gates: owner Live micro-purchases/refund verification, real-person email
delivery, full-agreement durable delivery and Norwegian legal review, remaining
OAuth/wallet/integration checks, and full-route interactive QA. A passing seller
slice is not an “excellent app” or whole-mission completion claim.

Guideline source: [Web Interface Guidelines](https://github.com/vercel-labs/web-interface-guidelines/blob/main/command.md).
