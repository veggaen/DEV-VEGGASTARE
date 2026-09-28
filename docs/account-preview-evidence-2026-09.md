# Read-only account preview — September 2026

## Scope and changes

Account preview is limited to a current OWNER viewing an ordinary, non-demo
USER. Start rechecks the owner's session version and the reviewed target's
updated timestamp under ordered PostgreSQL share locks. Session encoding and
the required audit record must succeed before a cookie is issued. Failures do
not report a successful switch or leak exception details. Old chunked session
and unsigned preview metadata cookies are cleared.

Encrypted preview claims bind both accounts' credential versions and an
absolute one-hour deadline, which Auth.js rolling renewal cannot extend.
Deleted users, changed roles, revoked credentials and expired/legacy claims
produce a null session instead of falling back to an ordinary member session.
Returning to the owner requires the same current proofs and an audit record.
Origin validation, bounded strict input, durable throttling and no-store
responses apply; the existing admin gate still protects starting a preview.
Ending a valid preview remains possible after that gate cookie expires.

The proxy blocks writes, Server Actions and identity-linking requests in preview,
including known legacy GET mutations and private file delivery. Normal sign-out
remains available. The banner sits below the header, wraps long names, provides
44px actions and shows retry/sign-out recovery if returning fails. Identity
switches deliberately use a full navigation to discard the previous client cache.

## Local verification

- Touched-file ESLint and `git diff --check`: pass.
- Strict production build: pass, localhost:3000; isolated Preview database and
  authenticated Sandbox PayPal credentials only. No Live PayPal keys locally.
- 98 focused tests across auth-session, impersonation service, proxy perimeter
  and installed Auth.js parser regressions: pass. Includes real encrypted-cookie
  Auth.js session-handler checks that owner/target revocation and expiry return
  JSON null and clear the cookie.
- Three isolated PostgreSQL tests: pass. Disposable schema only, real signing
  and audit writes, unavailable audit table fails closed, credential-revocation
  update serializes against issuance and invalidates the earlier version.
  The test schema is removed by the test's validated cleanup.
- Playwright local light **3/3**, dark **3/3**, zero skips/retries: real anonymous
  and demo start/end denial; browser-only preview-banner recovery and keyboard
  return; regression of account/profile security forms. Sizes: 360x800, 390x844,
  844x390, 768x1024, 1024x1280, 1280x800, 1920x1080 and 2560x1440. No horizontal
  overflow; banner does not cover menu; 44px End Preview action. Screenshot
  inspection includes phone and desktop. Fixtures intercept mutation responses;
  they do not prove a real customer's owner-restoration flow.
- Connected real Chrome: existing local signed-in security page renders at
  390x844, scrolls to its footer and keeps Update Security Settings accessible.
  No setting, password, purchase or customer account was changed.
- An additional localhost HTTP/browser integration run uses two disposable
  principals in the isolated Preview database and test-issued encrypted cookies.
  Real start/end endpoints, the actual admin confirmation/button/banner flow
  (390/1280px), authenticated session transitions, checkout/AI/message write
  denial, owner-version revocation and ordered start/end audits pass without
  response interception. It is not a password/OAuth login test. Two fixture
  issues were corrected first: use the reviewed API timestamp rather than the
  direct pg driver's date conversion; filter IMPERSONATE audits separately from
  legitimate VIEW events. Each run removes only its two temporary users and
  matching test audits. No real customer was used.

## Deployment acceptance

Runtime commit `9624ca1`:

- Preview `dpl_DeKpGfCLtvYqgsPnV25i2YYwaXdh`, immutable
  `https://dev-veggastare-9xnetruac-v3ggas-projects.vercel.app`, aliased to the
  existing isolated Sandbox Preview. Strict remote build and health pass;
  light **3/3** and dark **3/3**, zero skips/retries.
- Production `dpl_6EdfXa99sJMRZyL2FDbmN1uhji5X`, immutable
  `https://dev-veggastare-pl90c6lqa-v3ggas-projects.vercel.app`. Strict remote
  build and health pass before promotion; CLI inspection confirms www.veggat.com
  resolves to this release. Live light **3/3**, dark **3/3**, zero skips/retries.
- Connected real Chrome confirms the existing Live owner session still renders
  settings, with no preview banner; phone scroll reaches the footer, desktop
  layout has no page horizontal overflow. No security settings were submitted.
  Temporary viewport override reset.
- Staged redacted secret scan passes for this change only. This does not clear
  the historical public-repository exposure or blocked GitHub CI.

## Marketplace regression after the auth change

The CI showcase case initially reached a new demo receipt but failed on its old
`region` locator: the compact receipt now uses a labelled `details`/`group`.
The test now opens “Terms & delivery record” and verifies the visible exact
terms version. A fresh local rerun was correctly denied by the existing daily
demo signup cap; neither signup nor purchase caps were reset or loosened.

An explicit `E2E_RETAINED_SHOWCASE` option reuses an existing app-issued demo
session for release QA only. Default CI still begins with the fresh demo button.
The retained path clears only that disposable demo's cart and checks one added
order against its prior order list. Final local, Preview and Live runs each pass
**1/1**, no retries/skips: 122 credits update without an Apply button, cart,
simulated checkout outage/recovery, actual unpaid demo completion, saved full
terms, anonymous confirmation denial and idempotent replay without a duplicate
order. Phone/desktop cart layouts have no page horizontal overflow.

PayPal browser transport is explicitly aborted; these checks prove the demo
flow, not another Live capture. No email is sent and the receipt records 0 NOK
charged. The new test-only changes pass TypeScript and touched ESLint, and do
not require another runtime deployment. Other old opt-in receipt tests still
have stale region selectors and need their own follow-up; this is not a claim
that the entire historical E2E suite passes.

## Explicit limits / next work

This is a scoped security improvement, not completion of the full account audit.
Real customer owner-to-member UI acceptance remains unperformed; the actual UI
flow is covered locally with disposable test principals. Known side-effectful GET
paths are denied; the remaining read handlers still need broader review.
The original release only replaced the current cookie on End Preview. That
copied-token gap is now closed by a durable server grant in runtime `bd0b5ad`;
see [follow-up revocation evidence](account-preview-revocation-evidence-2026-09.md).
Ordinary Sign Out of a preview was subsequently covered by its own atomic
revocation and checked recovery flow in `6f8de52`; see
[preview sign-out evidence](preview-signout-evidence-2026-09.md). Old preview
cookies without the current proof fields expire on validation. Ordinary
non-preview JWT logout semantics are unchanged.

Privileged profile/role edits were subsequently hardened in `f4e1343`; see
[admin detail evidence](admin-user-detail-evidence-2026-09.md). Verified email
replacement and retention-safe erasure remain unfinished. No production customer
was impersonated, deleted, emailed or charged by these checks.
