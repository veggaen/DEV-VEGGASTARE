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

Artifacts: `test-results-release-dynamic-missing-local-fixed` (2/2, 50.8 seconds).
The failed baseline runs are retained separately. Production deployment and
post-deployment verification are pending; successful-record fixtures, physical
phone testing and every-button audit remain separate work.
