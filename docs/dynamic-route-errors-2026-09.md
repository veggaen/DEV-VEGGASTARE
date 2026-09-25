# Dynamic missing-record audit — 25 September 2026

The read-only audit derives concrete unavailable-record URLs from all 24 dynamic
page files (intercepted equivalents are deduplicated), using a retained demo
session at 360 and 2560 pixels. It exercises wheel input and records headings,
HTTP status, final URL, page errors and horizontal overflow. This checks failure
paths, not successful feature operation for every dynamic entity or user role.

The first local run failed because the unfinished admin route intentionally uses
the separate access gate, which has no app menu. The test now asserts that exact
gate, original redirect target and password field; protection is unchanged.

The first Live run exposed a real trade problem: a failed record fetch invoked
`router.back()`, destroying the page context and potentially ejecting a direct-link
visitor. The fix keeps a readable unavailable state, distinguishes transient
failures, permits explicit retry, cancels stale initial reads and suppresses
polling after load failure. Returning to Trading or closing the modal is explicit.
No trade mutation, wallet signature or payment behavior was changed.

Local strict build/TypeScript passes. Touched lint has no errors and one existing
`address` dependency warning in the unrelated ready callback. Two focused browser
checks pass: the full unavailable-record audit and 503 → retry → 404 with a stable
URL, no polling loop, and explicit return to Trading. No database writes are
requested by these checks. A real Chrome seller-page read also completed.

The first Preview inventory encountered an intentional legacy company-hub server
redirect before geometry measurement. Source inspection confirmed the exact
destination; the audit now waits for the four documented company/job aliases.
This is a test correction, not an application/auth change or a swallowed error.

Final results: local **2/2** (49.8s), Preview **2/2** (57.5s), Live **2/2** (1.4m),
retries disabled. Each inventory includes **44 observations of 22 distinct URLs**
at 360/2560, with no recorded page errors, server 500s or horizontal overflow.
Real Chrome also shows the deployed unavailable state and its explicit Back to
trading action reaches the loaded Trading Hub. No wallet transaction occurred.

App source `77ab6ba`; Production `dpl_5zJCViodSCcBuwHXdqA2qeBnDVqz`, Preview
`dpl_D4CRjRXxv5Qkn9tBRnoXXSyHL8J6`. Both strict builds and candidate health checks
pass, with 52 migrations and none pending. Preview passed before Production
promotion. The corrected audit is a subsequent test-only change.

Artifacts: `test-results-release-dynamic-missing-local-redirects`,
`test-results-release-dynamic-missing-preview-final`, and
`test-results-release-dynamic-missing-live-fixed`; each retains JSON observations.
Failed baseline runs remain separate. Successful-record fixtures, physical
phone testing, intercepted-modal interaction and every-button audit remain
separate work. Missing-record coverage is not complete dynamic-feature acceptance.
