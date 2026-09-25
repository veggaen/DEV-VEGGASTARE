# People discovery privacy and interaction audit

Scope: exact-person lookup, relationship suggestions and Pulse's people panel.
This does not claim completion of the wider admin/profile/social audit.

## Findings and fixes

- `/api/validate-user` previously matched hidden email before redacting it in the
  response. A positive match could reveal that the email belongs to an account.
  Email visibility now filters the database query itself. Public name/ID lookup,
  own email and current admin/owner visibility remain supported.
- Both handlers now bound input, return private/no-store responses, throttle by
  authenticated account, omit raw provider errors and exclude ephemeral demo
  identities. Demo suggestions are empty without relationship queries. Exact
  lookup also guards demo identities directly; deployed demo POSTs are denied
  earlier by the existing 403 middleware guard, now explicitly private/no-store.
  The existing limiter's in-memory fallback is not a globally guaranteed cap.
- Suggestions preserve recent-chat/friend/follow/colleague priority, deduplicate,
  bound relationship reads, fetch independent data concurrently and skip empty
  aggregate queries. There is no global-directory fallback.
- Pulse's panel replaces hover-only actions and the nonexistent `/users` link
  with always-visible 44px follow controls and real profile links. Search is
  labelled, bounded and debounced; old requests are aborted, requests time out,
  errors offer retry, and account switches discard previous results.
- Follow changes wait for server confirmation, lock concurrent toggles and
  require refresh after an uncertain failure. No real follows are needed for QA.
- Mobile gets a compact disclosure. Desktop keeps the existing independently
  scrollable Explore panel. Offscreen/closed panels do not duplicate requests.
  Theme tokens, one mobile heading and reduced-motion skeletons follow the
  reviewed Web Interface Guidelines; no new design system was introduced.

## Evidence so far

- Specification baseline: 21 failed / 5 passed; these are individual checks,
  not 21 independently demonstrated vulnerabilities.
- 72 focused unit checks pass (discovery, existing search and demo policy).
- 11 PostgreSQL checks pass in a unique Preview-only `qa_people_search_*`
  disposable schema. They cover real hidden-email query behavior, relationship
  joins/priority, demo exclusion, own/shared/admin email visibility, stable
  limits and literal wildcard handling. Schema removal and absence verified.
- Touched endpoint/component/test/proxy lint passes. The existing large feed
  file has two unrelated navigation warnings, no lint errors.
- First browser run: UI passed; endpoint expectation failed because the existing
  demo middleware correctly denied POST with 403 before the handler's 404.
  Test updated to assert that real boundary; security guard not relaxed.

- Final strict production-style local build passes. Final local browser **3/3,
  9.1s**, zero retries/skips. Real anonymous/demo endpoints are not mocked. UI
  fixtures cover failed/retired requests, account switching, keyboard follow,
  uncertain-follow refresh, actual profile hrefs, and visible controls at
  360/390/768/1024/1280/1920/2560 plus 844x390 landscape. All follow writes are
  intercepted; no real member was followed. No page errors or horizontal overflow.
- Real Chrome local: signed-in search returned actual Preview users, query was
  cleared, mobile disclosure/search and page/footer scrolling visually checked.
  Follow controls were not clicked. The mobile panel has one visible heading.

Deployment and remote acceptance are recorded below after verification.
