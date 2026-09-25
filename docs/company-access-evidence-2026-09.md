# Company access boundary — September 2026

Status: **DONE for this read-access slice — deployed and locally/hosted verified.
Full company payment and layout acceptance remains PARTIAL.**

## Findings and changes

- `frontend/app/api/companies/[companyId]/route.ts:26` — internal company
  details previously returned to anonymous callers. Three baseline route tests
  reproduced HTTP 200 instead of 401 for details, stock and warehouse contents.
- `frontend/app/api/companies/[companyId]/warehouses/stock/route.ts:14` and
  `warehouses/[warehouseId]/route.ts:30` — membership now constrains the database
  query itself; the warehouse must also belong to the requested company.
- `frontend/app/api/companies/[companyId]/reach/route.ts:17` — analytics now
  requires the same membership. Its former limited response could still expose
  non-public product metadata to unrelated signed-in users.
- `frontend/lib/company-read-access.ts` — current owner or staff membership,
  or a current database ADMIN/OWNER role, is required. Historical founder status
  and a stale privileged session are insufficient. Missing and inaccessible
  records share 404; deleted/anonymous identities receive 401. Responses use
  private/no-store and safe errors. Owner/creator account queries select only
  the five summary fields rather than loading complete account records.
- `frontend/proxy.ts:414` — first browser run revealed the public storefront
  was still redirected to sign-in. Only the directory and one CUID storefront
  are now public; creation, settings, hub and nested warehouses stay protected.
- `frontend/app/companies/[id]/settings/CompanySettingsClient.tsx:157` and
  `hub/CompanyHubClient.tsx:90` — compact recovery/sign-in/access states replace
  raw response errors, with bounded fetches and late-response guards. Stock and
  analytics are not requested before a successful company read.

The [Web Interface Guidelines](https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md)
informed the compact copy, semantic status, keyboard-native actions, 44px touch
targets and token-based recovery cards. This is not a full settings-page redesign.

## Evidence

- 48 focused unit tests pass, including public routing, storefront rendering,
  all four internal handlers and existing legal-route marker regressions.
- Opt-in isolated PostgreSQL acceptance passes 37 actual route checks: anonymous,
  unrelated user, former founder, owner, employee, administrator, cross-company
  warehouse ID, staff removal, role demotion and ownership transfer. Every fixture
  is rolled back and absence is checked afterwards. No production DB mutation.
- Touched ESLint passes. Initial browser recovery test passes across 360, 390,
  844 landscape, 768, 1024 portrait, 1280, 1920 and 2560. Local screenshots at 390
  and 2560 were visually inspected. The first actual public-storefront check
  failed on the pre-existing login redirect; routing was corrected before release.
- Final strict local build passes (webpack 33.2s, TypeScript 12.6s, 189 pages).
  Both final local browser tests pass in 9.5s without retries/skips: real anonymous
  and unrelated-demo requests to all four handlers, public storefront, protected
  management redirects, safe 401/404/500 states, retry and public-profile recovery.
  Real Chrome confirms the existing signed-in non-member is denied; actual DOM
  viewport is 390×844 with scroll width 390. No new session or grant was created.
  Artifacts: `frontend/test-results-release-company-access-local-final/` (ignored).

## Hosted acceptance

- Source `cc31221` is READY on isolated Preview as
  `dpl_49vNCn8A3HmvKCYNZSETSJEQ8V3e` at
  `https://dev-veggastare-825tk6q47-v3ggas-projects.vercel.app`. Strict build:
  webpack 53s, TypeScript 17.7s, 189 pages. Jolly-smoke Preview database,
  53 migrations, none pending. Candidate health passes; the existing public
  Sandbox alias was advanced without changing deployment protection.
- Stable Preview browser acceptance: **2/2, 22.6s, zero retries/skips**. Real
  Chrome independently confirms the retained unrelated account sees the compact
  access notice. The local phone storefront, footer and menu scrolling were
  visually checked in real Chrome; temporary viewport override was reset.
- Same source is READY in Production as `dpl_C4eiasxJTxHeGd63WqtrLPY1WyCj` at
  `https://dev-veggastare-9kvwgf3ek-v3ggas-projects.vercel.app`. Strict build:
  webpack 54s, TypeScript 17.6s, 189 pages. Correct orange-wildflower Production
  database, 53 migrations, none pending. Candidate health and anonymous detail
  rejection (401) passed before promotion. The prior main deployment was verified
  as `dpl_DbYF6shZVj6jzstPgrbB7Z4XHcLg`; CLI inspection confirms the new main target.
- Live browser acceptance: **2/2, 27.0s, zero retries/skips**. www.veggat.com
  health is 200/healthy (single observed database latency 30ms, not a percentile).
  Real Chrome retains the owner's existing sign-in and opens company settings
  through the public profile. No console errors, ownership, payment or email
  mutations. Positive owner access remains available while outsiders are denied.
- Hosted artifacts: `frontend/test-results-release-company-access-preview/` and
  `frontend/test-results-release-company-access-live/` (ignored).

## Remaining

Company payment editing, email-verification race handling, full owner-page responsive layout and
role-specific employee/warehouse actions still need their separate audit. This
slice does not claim those flows complete. No payout destination, email, payment,
refund or wallet state has been changed.

Concrete next issues: the live owner page displays **Invalid company ID** in the
payment panel. `actions/seller-payment.ts` requires exactly 25 characters, while
the existing permanent company ID has 26. Preserve that ID and its existing
orders; fix validation without relaxing ownership checks. PayPal email verification
also reads a token and later marks the target verified without atomically binding
the current email to the token email. Test and fix save/verify/remove races before
claiming payout setup complete. The owner page's oversized banner and fact cards
push payment controls down; shorten/reorder it and audit real scrolling/resizing.
