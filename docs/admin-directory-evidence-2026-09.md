# Admin directory acceptance — September 2026

Scope: `/admin/users`, its list endpoint and cache behavior of the existing admin gate. This is not acceptance of user-edit/delete/impersonation or the legacy `/api/users` directory.

## Reproduced and changed

- The role picker used an invalid empty Radix item value; it now uses a labelled native select and an `all` sentinel.
- Search previously requested on every keystroke and only debounced a page reset. Search now debounces requests, resets pagination, stores filters in the URL and aborts superseded requests.
- Rapid-input regression caught a late navigation overwriting a newer draft/filter. Filter updates now use Next's supported [native History API integration](https://nextjs.org/docs/app/getting-started/linking-and-navigating#native-history-api), avoiding an RSC navigation for client-side filters.
- Slow/error responses cannot leave another query's rows on screen. Failures have inline retry; changing the signed-in actor or losing the admin role unmounts private rows.
- Removed the non-existent `/edit` link and the non-functional Delete action. Manage links to the existing detail screen; Profile is a normal link. No account-management power was added.
- Responsive rows wrap long names/emails, use semantic tokens and 44px controls, and no longer stagger their appearance. Search, filter and pagination state remain readable without tooltips.
- The list API validates bounded pages, limits, roles and sort fields, escapes literal SQL wildcards, uses stable ordering, checks current authorization/demo restrictions and throttles reads. The projection excludes password and provider-token fields. Failed reads return generic messages.
- Unsupported bulk POST returns 405 instead of reporting a fictitious mutation/audit entry.
- Browser testing discovered the optional admin gate intercepted the initial tests. Its cookie-dependent refusal/redirect now has private/no-store headers. Tests use the existing password when needed; the gate was not disabled.

Design review used the [Web Interface Guidelines](https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md): labelled native controls, semantic links, visible focus, reduced motion, long-content handling and URL state. The testing skill's Python launcher was unavailable; the existing TypeScript Playwright suite is used instead.

## Verification

- 60 focused unit/regression tests pass: directory, gate caching, public-company routing and people discovery. Authorization/query tests use mocks; they do not prove every database or deployment behavior.
- Touched-file lint passes; strict production-mode local build passes against the isolated Preview database, with Sandbox PayPal only.
- Local browser acceptance: **2/2 pass, no retries/skips**, 10.5 seconds. Read-only real endpoint refuses anonymous/demo identities; browser-only owner/20-row fixtures cover filters, pagination, empty/error/retry, rapid input, obsolete responses and role loss. No real account receives an admin role.
- Layout checks cover 360×800, 390×844, 844×390, 768×1024, 1024×1280, 1280×800, 1920×1080 and 2560×1440. Long names/emails do not create horizontal overflow; controls are at least 44px. Screenshots at 390/1280/2560 were visually inspected. Other screenshot captures are supporting evidence, not an assertion every pixel was reviewed.
- Initial runs identified missing gate-cache headers, test setup's demo write refusal, the gate rate limit and an ambiguous screen-reader text selector. Setup now obtains/reuses an actual gate cookie anonymously without weakening demo restrictions. The subsequent rapid-input failure prompted the History API fix above.
- Local dark-mode browser run also passes **2/2**, no retries/skips, 10.3 seconds; the 1280px dark screenshot was visually inspected.
- Preview browser run passes **2/2**, no retries/skips, 19.5 seconds. Live browser run passes **2/2**, no retries/skips, 22.0 seconds. These use the same real denial checks and browser-only privileged fixtures described above, not a genuine admin account mutation.
- Real Chrome's local and Live tabs require the existing admin gate password. The local exact owner action was requested; positive real-Chrome admin-session acceptance remains **PARTIAL**. No secrets were copied into browser tool output.

## Deployed runtime

- Commit `02a0771cb252aaead22c484004e8427c082f4856`; staged redacted secret scan: no findings. This does not clear the separate historical repository exposure.
- Isolated Preview: `dpl_6qCh4JdwCdHpgXVtDRCHcDtQqw8R`, `https://dev-veggastare-p7m6hxj9c-v3ggas-projects.vercel.app`, assigned to the stable Sandbox Preview alias. Health healthy at `2026-09-25T13:07:34.100Z`.
- Production: `dpl_ANzfTB8VgGnV61MXiqbVeZGYUo4H`, `https://dev-veggastare-63mu3f9uk-v3ggas-projects.vercel.app`. Health healthy at `2026-09-25T13:08:04.653Z`; promoted after Preview acceptance; `www.veggat.com` inspection resolves to this deployment.
- Both remote strict builds passed; 53 migrations present with none pending. No new database migration or billing change.
- Reports stay local/ignored: `frontend/test-results-release-admin-directory-{local,local-dark,preview,live}/results.json` and per-viewport screenshots.

## Remaining scope

Legacy `/api/users`, company-creation employee lookup and privileged user-detail mutations remain separate audit work. In-memory rate-limit fallback is per-instance, not a distributed/global guarantee. No member records, permissions, purchases, refunds or outbound emails were changed by this slice.
