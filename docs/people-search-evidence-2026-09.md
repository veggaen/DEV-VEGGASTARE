# People-search privacy and acceptance

Scope: `/api/users/search`, used by team forms, messages and social pickers.
Other profile/suggestion/admin endpoints need separate acceptance; this does not
claim the entire social-data privacy surface is complete.

## Findings and change

- Demo UI disabled real-member search, but the endpoint still returned real
  people. Demo requests now return an empty result without directory queries.
- All responses, including errors, are private/no-store. Account-based read
  throttling now returns 429 with Retry-After. It reuses the existing limiter;
  its in-memory fallback is not a globally guaranteed anti-enumeration cap.
- Results are limited to 20, exclude ephemeral demos, have stable name/id order,
  and treat percent/underscore input literally rather than as SQL wildcards.
- Ordinary viewers receive shared/own email only and no platform role. Missing
  email visibility fails closed. Current admin/owner visibility is preserved.
- The auth callback already refreshes user identity/role from the database on
  each request. This audit did not reproduce a stale-role exploit.
- Empty/short searches avoid result and follow queries. Nonempty results load
  independent follow aggregates concurrently. Error logs omit raw provider data.

## Verification

- New specification suite before changes: 21 failures, 1 pass. These include new
  privacy/boundary/response requirements, not 21 independent vulnerabilities.
- Final units: 22/22. Real PostgreSQL: 7/7 in a unique disposable
  `qa_people_search_*` schema on isolated Preview. Verified hidden-email search,
  own/shared/admin visibility, demo isolation, exact prefix, limits and literal
  wildcard characters. Schema removed and absence checked. Initial database
  fixture omitted the EmailDisplayMode enum; fixture corrected before acceptance.
- Touched endpoint/test lint and strict production-style local build pass.
- Final local browser: 4/4, 11.0s, no retries/skips. Covers real API anonymous/demo
  boundaries, responsive team controls, demo messaging and intercepted composer
  search/send failures. First run 3/4: old composer fixture did not refresh its
  server-rendered demo session; fixed by waiting for hydration and refreshing
  the intercepted session. No message was sent to a real member.
- Real Chrome local signed-in normal-account search returns results; hidden
  addresses stay omitted. Search cleared; no conversation created.
- Final Preview browser **4/4, 26.6s**; Live **4/4, 27.7s**; zero retries/skips.
  The same source is strictly built in both environments. A combined 58-test
  unit regression run also passes (search plus team-entrypoint/private reads).
- Runtime `026504e`, Preview `dpl_7tYqAr5s4PoKphodeazbAcsRgcmq`
  (`https://dev-veggastare-3ygu962s3-v3ggas-projects.vercel.app`), production
  `dpl_HL9N6CcyyuZimaX1K4XY6rW4iPhF`
  (`https://dev-veggastare-3guafq0yl-v3ggas-projects.vercel.app`). Both READY and
  healthy; stable Preview alias updated, production promoted, www alias verified.
- First generic Preview deploy failed the callback-origin safety guard before
  migrations. Retried only after terminal failure using the existing ignored
  `deploy-checkout-preview.mjs` helper, which verifies the Sandbox webhook and
  sets Preview-only origin/webhook overrides. No production settings changed.
- Real Chrome Live: empty search settles correctly, positive search returns ten
  bounded results, search cleared, no recipient selected or message submitted.
  No captured console errors. Admin search still shows existing system/QA
  identities; identifying retained test records for a safe directory cleanup
  remains separate. Do not delete accounts based on names alone.

Reports: `frontend/test-results-release-people-search-local-final/results.json`,
`frontend/test-results-release-people-search-preview/results.json`,
`frontend/test-results-release-people-search-live/results.json`.
