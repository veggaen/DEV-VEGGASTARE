# Seller publication acceptance — September 2026

## Release authority

Application commits: `35b3f68` and upload-race correction `9eac374` on
`release/showcase-september`; main is unchanged. `9eac374` is the final source.
Final Preview: `dpl_3AZGznne17sBRqyT6Gpdq8kbRXpU`,
`dev-veggastare-9fzo7xcfo-v3ggas-projects.vercel.app`, assigned to and inspected
through the stable `showcase-ai-revival` alias. The initial `35b3f68` Preview
(`dpl_7SUPR3vCghn8nwtXXWs1vKoaUSZR`) was superseded, never promoted.
Production: `dpl_Epxd7YKi27qXwmqF8AfdwMcAN1Nb`,
`dev-veggastare-77vp7p36k-v3ggas-projects.vercel.app`. Candidate health and payment
capabilities were checked before promotion; `www.veggat.com` was inspected and
resolved to this exact ID before live acceptance.
Rollback before this slice: application `6816380`, production
`dpl_72qycJnr4Zwp4os4xyFxRmBFJ7Xj` (`cbslddl49`). No schema migration is needed.

## What changed

- Product publication uses one serializable transaction. Session identity,
  current company permissions, active unused file ownership, verified receiving
  wallets, category references and seller-scoped warehouses are checked before
  publication. A relation failure rolls back the whole listing. A postcode
  alone can no longer select another seller's warehouse.
- Private-file registration checks the storage provider's actual owner path
  and file size, reads private bytes through the scoped storage helper, and
  stores a real SHA-256 checksum. Client URLs/checksum claims are not proof.
  Anonymous/demo/cross-origin writes fail closed. Company reads require
  permission and return bounded metadata, never private storage locations.
- Successful publication remains successful if subsequent cache refresh fails;
  the UI does not invite duplicate publication after a committed transaction.
- Review shows required-field errors, retains entered draft values and focuses
  the selected section when fixing an issue. Category and price fields have
  explicit accessible names. Demo mode makes no publication/upload request or
  unnecessary payout-status Server Action. Its final publish button is disabled.
- The old owner-only USD 1 test-listing mutator is retired. Its compatibility
  action only returns the existing reviewer listing. Owner tools link to the
  released reviewer products and settings, not a misleading fake Live test.
- The price selector no longer offers an unimplemented crypto denomination
  that could silently save a crypto quantity as USD. Verified Web3 checkout is
  still unreleased; registering a receiving address does not enable payment.
- Publishing creates a browse-only general listing, not a purchasable one.
  Existing reviewer-only checkout and payment/refund reconciliation are unchanged.

## Local verification

- Touched-file ESLint, `git diff --check`, strict production build and TypeScript
  pass; 188 generated routes. No environment, dependency or schema change.
- **77/77 focused units** across publication, registration, Server Action,
  storage policy and private-download helpers.
- **4/4 real Postgres tests (7.01s)** on the isolated Preview database, in a
  temporary UUID schema. No production rows copied. Actual successful publish,
  foreign-asset rejection, rollback after a post-create failure, and correct
  warehouse scoping pass. The validated test schema is removed in cleanup.
- **2/2 final local browser tests (4.3s)**: demo review/recovery and unmocked asset
  HTTP guards. Review runs at 390/1280 and resizes through 360, 390, 844 landscape,
  768, 1024, 1280, 1920 and 2560, with no horizontal overflow. The submit remains
  reachable by scrolling. **1/1 final dark replay (4.3s)** passes.
- **1/1 final real upload/publish journey (10.5s)**: a temporary password seller signs
  in, uploads the existing showcase JPG and a synthetic private TXT, registers
  the private asset, publishes, and sees its actual browse-only PDP. No payment
  and no intercepted upload/publication response. The guarded runner only
  permits localhost and the isolated Preview alias, never production. The final
  local run restores a stale guest storage cookie before publishing and still
  completes the real private upload; the cover must decode successfully before
  the result screenshot is accepted. That screenshot was visually inspected.
- After the write test, only that temporary seller's listings are archived,
  its uploaded assets deactivated, and password removed/session version bumped.
  Small QA storage objects remain inactive; nothing is represented as a paid
  listing or deleted from the live database.
- Real Chrome at 390 confirms that the review's title Fix control moves focus
  to `Describe your product`, with readable fields and errors. The settled
  1280 layout has the persistent rail and section navigation; actual content
  scrolling was exercised. Temporary viewport override was restored.
- Fresh `npm audit --omit=dev`: **0 critical, 0 high, 25 moderate** findings.
  GitHub's default-branch alert count is not the same artifact as this release
  branch; neither result certifies the entire repository free of vulnerabilities.

### Failed attempts retained

- Initial database fixtures reused public-schema enums. Prisma expected the
  temporary schema's enum types; the fixture now recreates the enum geometry
  and casts copied empty columns/defaults. The same four assertions then pass.
- The first browser test tried to check the visually hidden Digital radio.
  Its visible label intercepted the click; testing the actual visible label
  resolves this without force-clicking or weakening the checked-state assertion.
- The zero-write demo assertion caught an unnecessary payout-status read action
  rejected by demo policy. The form now skips that request in demo mode; it was
  not evidence that a demo successfully published a product.
- The immediate screenshot after a viewport change still showed the old width.
  The later settled observation is the desktop evidence.
- A subsequent real Preview run exposed `Upload not allowed for the current
  context` before registration. Restoring only the test browser's previously
  issued guest storage cookie after password sign-in reproduced the failure.
  Server identity checks correctly rejected it; they must not be relaxed.
  Publication now awaits the SDK's documented context reset before uploading,
  and waits for initial storage setup before enabling publication. Raw provider
  errors are no longer logged or displayed by the publication/upload handlers.
  Final local and deployed Preview acceptance include the same stale-context
  regression, which now succeeds without weakening the server checks.
  Reference: [EdgeStore context refresh after login/logout](https://edgestore.dev/docs/configuration).
- The first decoded-image replay matched a hidden Next.js streaming copy of
  the publication notice. Scoping to the real main landmark fixes that test
  ambiguity, preserving visibility and image-decoding assertions.

## Deployed Preview verification

- Final `9eac374` Preview passed **1/1 real stale-context upload/publication
  journey (29.1s)**, **2/2 review/HTTP-boundary checks (5.9s)** and **1/1 dark
  review replay (8.3s)**. All use the exact inspected stable alias. The real
  uploaded cover decoded successfully and its result screenshot was inspected.
- Real Chrome on the deployed form also confirms Digital selection, five
  missing-field review issues, focused Review heading and disabled demo publish.
- Both Preview builds used the isolated Neon endpoint and reported 48 migrations,
  none pending. The earlier successful happy-path run did not conceal the later
  stale-context failure; the correction and same controlled regression are
  separately recorded above.

## Production verification

- Final production build and TypeScript pass, using the production Neon endpoint,
  48 migrations and none pending. Candidate `/api/health` reports healthy;
  `/api/payments` reports Live PayPal for the two reviewer SKUs only, paused
  general checkout and unreleased verified Web3. No key or environment changed.
- After exact-domain promotion, live **2/2 review/HTTP-boundary checks (15.8s)**
  and **1/1 dark review replay (11.9s)** pass. The same eight-size reflow and
  scroll-to-submit assertions run. These are read-only demo/anonymous checks;
  they do not create live listings or prove paid fulfillment.
- Real Chrome's signed-in owner session shows the live publication notice.
  Expanding Owner checkout tools exposes only the existing Interview Pack,
  credits, payment settings and wallet links. Actual 390px scrolling reaches
  those tools, and the settled screenshot confirms their alignment. No listing,
  settings change or payment was submitted. Viewport restored; existing owner
  payment/PayPal/email handoff tabs preserved.
- Artifacts remain local, uncommitted and excluded from deployment:
  `frontend/test-results-release-publishing-{local-final,local-dark,preview,preview-dark,live,live-dark}/`
  and `frontend/test-results-release-publishing-write-{local,preview}/`.

## Remaining boundaries

General marketplace checkout, verified Web3, owner Live micro-purchases/refund,
human-inbox delivery and legal review remain incomplete. The listing form still
needs broader field-level accessibility/contrast and saved-draft currency QA.
This is not all-route, physical-phone keyboard, native 125% zoom, or field Core
Web Vitals acceptance. No unconditional claim that the app is excellent or
production-complete is supported by this slice.

Webapp-testing informed real write/cleanup versus read-only assertions. Web
Interface Guidelines informed review focus, accessible labels and bounded
reflow. Computer-use guided real-browser observation and viewport restoration.
