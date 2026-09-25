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

## Populated-feed follow-up

The first Live revision passed 3/3 checks (18.4s), following Preview 3/3 (17.3s).
Real Chrome then exposed a weakness in the empty-feed UI fixture: the mobile
disclosure was below all posts. It is moved above the feed, and the fixture now
contains 12 posts with an explicit disclosure-before-feed assertion.

Real Chrome at 1280x800 also showed a paint problem while scrolling the Explore
panel: feed-card contents disappeared while the DOM text remained, then repainted
when scrolling over the main feed. Card backdrop blur is removed as a targeted
paint/performance simplification. The regression fixture now exercises independent
sidebar scrolling, unchanged main scroll position and blur-free cards. Final real
Chrome acceptance must repeat this interaction; a DOM visibility assertion alone
does not prove the paint issue is resolved on the owner's GPU/browser.

## Final deployment and outstanding visual finding

Runtime `60e99a9` is now deployed to isolated Preview
`dpl_5GNpTzsh4K4xZ81yV4EKW15VNq6z` and promoted to `www.veggat.com` as
`dpl_5ZcQot1hG9J4bGZMX7WE8brdiggo`. Both strict remote builds completed, the
production health endpoint reports healthy, and alias inspection confirms the
production target. No migrations were pending.

The populated fixture passes **3/3 locally (9.6s), 3/3 on Preview (17.6s), and
3/3 Live (20.3s)** with zero retries/skips. The local dark-mode UI case also passes
(7.1s). Reports are retained outside tracked source under
`frontend/test-results-release-people-discovery-*-populated/` and
`frontend/test-results-release-people-discovery-local-populated-dark/`.

Real Chrome confirms the mobile disclosure above populated Live posts and real
local/Live search results. No follows, messages, purchases or account settings
were submitted. Routine feed viewing may update normal view counts.

**Desktop paint acceptance remains PARTIAL.** At 1280x800, scrolling the right
people panel still produces screenshots with blank left-card interiors. A fresh
screenshot repeats it; the article DOM retains text, opacity 1, visibility visible,
and no backdrop filter or content-visibility suppression. The blur removal did
not resolve this observation. It also repeats at the normal screen size after
resetting the viewport override, so it is not limited to phone/device emulation.
Owner screen confirmation is requested to distinguish
an actual display problem from a capture-only issue. No speculative global GPU/CSS
workaround was applied and the regression is not called fixed.

Reference: Chrome's [rendering diagnostics](https://developer.chrome.com/docs/devtools/rendering/performance)
and [compositing explanation](https://developer.chrome.com/blog/inside-browser-part3)
guide further investigation; they do not establish the cause of this observation.

Remaining separate audit: `/api/admin/users` needs strict sort/pagination bounds
and honest handling of its placeholder bulk-action response. The legacy admin
`/api/users` list is unbounded and is still consumed by company creation. The admin
directory Edit action points to `/admin/users/[id]/edit`, while the route inventory
only contains `/admin/users/[userId]`. These paths have not been changed here.
