# Owner audit log — September 2026

## Findings and scope

The previous demo-only route sweep could not exercise OWNER controls. A local
browser-only owner fixture reached `/admin/audit-log` and rendered “Something
went wrong.” The page used empty Radix SelectItem values, had no inline retry,
replaced the entire list on refresh and let older responses overwrite filters.
The endpoint parsed unchecked page/limit/date values, returned complete audit
JSON in every list and omitted private/no-store headers.

The repair keeps the OWNER-only boundary and existing admin gate. It does not
add an export, edit, delete or impersonation action, or rewrite stored records.

- Labelled native filters cover every current action and record type. Filters,
  pagination and selected details are URL-backed. Back navigation works.
- Twenty summaries per page omit before/after JSON and request metadata.
  Details are read only when opened. Query validation rejects invalid/duplicate
  values; bounded pagination has a stable timestamp/ID ordering and a consistent
  count snapshot. Reads are rate-limited and private/no-store, including errors.
- Anonymous, demo, ADMIN and account-preview identities are denied. The shared
  authenticated session handler supplies the current role. Losing access removes
  both list and detail data; a subsequent network failure cannot restore them.
- Refresh keeps the last successful same-filter list, clearly marked on failure.
  Filter changes never show a previous filter's rows. Bounded requests abort on
  navigation and ignore late responses. Error output is fixed/safe, not raw DB
  or browser exception text.
- Detail JSON redacts common credential-field names and bounds depth, breadth,
  text and total visited nodes. This is a display projection, not a claim that
  arbitrary historic free text has been scrubbed. Originals remain unchanged.
- Existing surface tokens, 44px controls, wrapped identifiers, a bounded canvas
  and a separately scrolling dialog replace the tall delayed animated list.
  The dialog remains closable in short landscape layouts and returns focus.

The web-design-guidelines skill informed labels, focus, touch targets, token
surfaces and overflow handling; see the
[Vercel interface guidelines](https://github.com/vercel-labs/web-interface-guidelines).
The webapp-testing workflow uses the repository's existing TypeScript Playwright
runner (the Python helper is unavailable in this environment).

## Verification

- 64 focused API/policy/directory regression tests pass. Touched lint passes.
- Initial strict local production build and full TypeScript pass.
- Real local HTTP/UI acceptance uses one disposable owner and three synthetic
  audit entries in the isolated Preview database: authenticated filtered reads,
  equal-timestamp pagination, compact rows, redacted detail, 390/1280 layouts,
  and role revocation pass. Direct DB comparison confirms the original three
  records did not change. Only this owner and these three fixture entries are
  removed afterwards. No production, payment, provider call or email is changed.
- The first browser run passes denial and reaches all eight layout sizes, then
  exposes detail reopening over the list after access retry. The recovery now
  clears the selected entry on denied access. This failed run is not a pass.
- Final strict local production build and full TypeScript pass. The actual
  localhost HTTP/UI run also passes again against this rebuilt candidate;
  scoped fixture cleanup is confirmed.
- Final local light **2/2** and dark **2/2** pass without retries/skips. The
  browser fixtures exercise all action/type controls, URL/back navigation,
  paging, last-data retry, on-demand detail failure/retry, focus return, late
  response rejection and access-loss clearing. Eight sizes include 360, 390,
  844x390, 768, 1024, 1280, 1920 and 2560. Real wheel input reaches pagination
  and scrolls inside the short detail dialog. Screenshots were reviewed in
  phone, desktop and landscape layouts. No horizontal page/dialog overflow.
- Local real Chrome opens the correct URL but stops at the unchanged admin
  gate. It is not counted as a signed-in local Chrome pass.
- Preview and Live each pass light **2/2** and dark **2/2**, without retries
  or skips. Hosted privileged UI cases use browser-only fixtures; they do not
  promote the retained demo account or mutate customer records. Actual hosted
  anonymous/demo reads remain denied.
- Real Chrome uses the retained signed-in production owner session. The
  owner's administrator filter loads ten existing entries; selecting View
  returns four. Opening the latest own-user View entry loads a read-only
  detail with Before/After honestly marked Not recorded. At 390x844 the
  dialog fits without horizontal overflow; Close returns focus to its exact
  Details button. Real wheel scrolling reaches the phone footer. The normal
  desktop viewport is restored and the filtered page is retained. No captured
  console errors were returned for this check. No customer account, audit
  entry, payment, provider call or email was changed.

## Deployment

Runtime commit `69b21de` is deployed:

- Preview `dpl_5qBm1537RrjM1gUzveQqCmmQYQVy`, immutable
  `https://dev-veggastare-37amoqu3x-v3ggas-projects.vercel.app`, assigned to
  the existing showcase-ai-revival Preview alias.
- Production `dpl_Br5VH55HrqRSyHHqkVfYF2uxbSbW`, immutable
  `https://dev-veggastare-nngtokdox-v3ggas-projects.vercel.app`, promoted only
  after Preview acceptance. Inspection confirms `www.veggat.com` points here.
- Both strict remote builds and health checks pass. All 54 existing migrations
  are applied; this slice adds no migration. The staged-change secret scan
  passes; this is not clearance of the repository's historical contents.
- Previous production rollback candidate:
  `dpl_9apZWJjqFi3qeZ8PsDVHCSH1JDLv` (`6f8de52`).

## Limits

This is owner read/UI acceptance, not a comprehensive guarantee of all historic
audit content, write completeness, retention or tamper resistance. Existing
legacy audit writers and remaining administrative routes need their own audit.
No full-app completion or measured field-loading improvement is claimed.
Next scoped route defect: company-admin View/Edit links target detail/edit
pages that are absent from the route inventory. They are not fixed by this
audit-log release.
