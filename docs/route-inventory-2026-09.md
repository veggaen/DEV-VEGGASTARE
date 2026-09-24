# Route rendering and storage resilience — 24 September 2026

## Scope and result

Source `ac82106`: local production build and strict TypeScript pass; touched-file
lint passes. **24 storage units** pass. Local focused browser batch **4/4** passes
in 1.9 minutes, including gate setup, controlled storage outage, production-only
preview gating and a static-route inventory.

The app has **101 page files**. This inventory visits **77 static routes at 390px
and 2560px** with a retained demo session, sends real wheel input, records final
URLs/headings, and checks page errors, server 500s and document-width overflow.
The accepted run has 154 observations: 152 HTTP 200 and two intentional 404s.
All observations have a main element. This is NOT acceptance of every button,
every role, scroll stability, loading completion, native zoom, or all features.
The 24 dynamic page files (including intercepted variants) still need concrete
fixtures; existing PDP/receipt/profile/warehouse tests cover only some of them.

## Findings and changes

1. `/dev/chat-preview` threw `notFound()` inside its client preview during
   production SSR, producing React #419 in the baseline inventory. The guard now
   lives in a server page; the interactive preview remains development-only.
   Real Chrome confirms the unavailable page. The focused regression passes
   at 390/1280/2560. Its first draft used a guest and correctly reached sign-in;
   the regression now uses a retained demo session, without weakening auth.
2. The longer rerun found `EdgeStoreApiClientError` on otherwise readable pages.
   A controlled `/api/edgestore/init` 503 reliably reproduced an unhandled
   rejection. The installed SDK's mount effect called `void init()` while its
   initializer rethrew after setting error state. A versioned patch catches only
   that unattended mount promise. `state.error` remains true, failed explicit
   resets still reject, later resets recover, and upload/security routes are
   unchanged. Tests verify those distinctions. No global error suppression and
   no rate-limit relaxation were introduced.
3. The first patched build reused the old vendor behavior. The patch file is now
   a webpack build dependency, so changes invalidate cached dependency chunks.
   The subsequent build passes the controlled outage regression.

The SDK correction uses `patch-package --error-on-fail` in postinstall, affecting
both ESM/CJS distributions. It applied successfully during Preview installation.
See [patch maintenance notes](../frontend/patches/README.md). No migration is needed.

## Other evidence and limitations

- Real Chrome Jobs loads its empty state; Post request shows a read-only demo
  explanation. No request or upload was submitted.
- A Chrome zoom shortcut through the browser connection did not alter DPR or
  viewport width. **Actual 125% browser zoom remains unverified.**
- Before adding patch-package, this release's `npm audit --omit=dev` reported
  25 moderate, zero high/critical advisories. This is not a clean-security claim;
  GitHub's larger warning refers to the default branch, not this release.
- Local artifact folders: `test-results-release-route-inventory-local*`,
  `test-results-release-preview-gate-local`, `test-results-release-storage-init-baseline`.
  Accepted inventory data is embedded in the JSON report attachment.
- Payment status remains unchanged: **Live capture/refund is untested**. Railway
  remains blocked on identifying/restoring the owner's paid workspace.

Preview `dpl_Hc7CysK2G1ULmihSvFGiTRKXs7wm` is READY at
`https://dev-veggastare-jwpa7952p-v3ggas-projects.vercel.app`, assigned to the
existing isolated Preview alias. Patch application, strict build/TypeScript and
49 existing migrations (none pending) pass. The controlled outage passes there.
The first focused preview-gate check timed out waiting for global network idle;
it now checks the unavailable heading and an enabled hydrated Open menu instead.
A first readiness selector used the desktop Basket control, which is absent on
mobile; corrected to the shared menu. The corrected three-size regression passes
locally and on Preview (2/2 including setup each). Application code did not change
for these test corrections.

The full Preview inventory and live verification remain pending. Do not treat
this document as proof of production acceptance until deployment evidence is added.
