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

**Historical capture finding (owner-display clarification below).** At 1280x800, scrolling the right
people panel still produces screenshots with blank left-card interiors. A fresh
screenshot repeats it; the article DOM retains text, opacity 1, visibility visible,
and no backdrop filter or content-visibility suppression. The blur removal did
not resolve this observation. It also repeats at the normal screen size after
resetting the viewport override, so it is not limited to phone/device emulation.
Owner screen confirmation is requested to distinguish
an actual display problem from a capture-only issue. No speculative global GPU/CSS
workaround was applied and the regression is not called fixed.

## Owner-display clarification — September 25

Repeated the Live interaction at a measured 1280x800 in real Chrome. The Explore
panel moved from scrollTop 0 to 218; the main feed stayed at 0. Both browser
capture methods showed missing card interiors while the DOM retained its content
and normal paint properties. Asked the owner to inspect the actual display. The
owner explicitly confirmed: **"No, posts remain visible."**

This closes the reported user-facing blank-post finding as **not reproduced on
the actual display**. It is a capture-path artifact in this observed session,
not evidence that a CSS repair fixed rendering. Keep this limitation when
interpreting future screenshots; do not mask it with GPU/compositing workarounds.
The temporary viewport override was reset. No real follows or posts were submitted.

## Post controls — local acceptance

- Post options and heartbeat controls have explicit accessible names and 44px
  targets. Heartbeat exposes pressed/busy state and keeps keyboard focus during
  its request; the existing handler still blocks a second in-flight submission.
- Tags are native buttons; quoted posts are actual links. Clicking a child link
  no longer also invokes the parent card. Card hover no longer moves the reading
  surface, and reduced-motion disables its transition. Existing theme tokens
  and badge styles are reused, with no additional explanatory copy.
- The first keyboard run exposed focus loss from disabling the active button.
  The regression now holds the mocked request open, presses Space twice,
  verifies one request and retained focus, then verifies a second completed
  toggle. A test hydration race and incorrect CSS-duration assertion were also
  corrected; neither was an application defect.
- Final strict local build/TypeScript pass. Touched lint has no errors and one
  pre-existing internal-navigation warning at `app/feed/page.tsx:2528`.
  Local browser **3/3, 11.0s**, zero retries/skips: real anonymous/demo discovery
  boundaries, populated responsive search, and new post-control acceptance.
  The new case checks 360/390/844-landscape/1024-portrait/1280/2560, keyboard
  menus/Escape focus, tag URL state, actual quote/detail hrefs, 44px controls,
  reduced motion and no page errors/horizontal page overflow. Screenshots at
  360 and 1280 were visually inspected. All reactions/follows are intercepted;
  no real social writes, payments or emails are submitted.
- Real Chrome local reload at 2498x1319 shows the isolated empty feed without
  horizontal page overflow. Populated interaction evidence above is explicitly
  a Playwright UI fixture, not fabricated persistent posts.

Runtime `b4a3140` is READY on isolated Preview as
`dpl_2KosieHQQy2a2ikYcmKNGhxMW7qo`. The stable Sandbox alias was explicitly moved
to that deployment; its build/full TypeScript passed and all 55 existing
migrations were already applied. Initial hosted checks encountered an expired
retained demo session before acceptance. The normal public demo-login flow renewed
the disposable session; no cap was bypassed and no owner credits were granted.
Final hosted browser **3/3, 12.8s**, zero retries/skips, also includes explicit
main-scroller/card overflow assertions (local follow-up **3/3, 11.0s**).

Real Chrome on Preview at measured 390x844 shows no main-scroller horizontal
overflow. The navigation drawer opens, scrolls to the wallet/cookie/sign-out
controls, and Escape closes it with focus returned to Menu. No wallet connection
or account action was submitted. Temporary viewport sizing was reset.

Production alias inspection still points to
`dpl_3GCyDg5BuzBghdjkSnhKut2J7cdu` (`92c5ac7`). This UI update is **Preview only**:
the release branch also contains native-currency payment work, whose production
activation remains gated on the separate Live merchant receiving check. The
retained PayPal merchant page still requests sign-in, independently of Developer
authentication. No Live charge, refund, credential or payment setting changed.

Reference: Chrome's [rendering diagnostics](https://developer.chrome.com/docs/devtools/rendering/performance)
and [compositing explanation](https://developer.chrome.com/blog/inside-browser-part3)
guide further investigation; they do not establish the cause of this observation.

Remaining separate audit: `/api/admin/users` needs strict sort/pagination bounds
and honest handling of its placeholder bulk-action response. The legacy admin
`/api/users` list is unbounded and is still consumed by company creation. The admin
directory Edit action points to `/admin/users/[id]/edit`, while the route inventory
only contains `/admin/users/[userId]`. These paths have not been changed here.
