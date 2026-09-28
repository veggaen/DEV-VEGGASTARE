# AI conversation navigation — September 2026

## Confirmed findings

- `frontend/app/ai/AiChatShell.tsx` (previous `load`/rail): real Chrome first
  displayed “No conversations yet”, then replaced it with an existing chat.
  Failed reads were silently treated the same way. A nullable, validated result
  now distinguishes loading, failure, valid empty results and retained stale data.
- Previous rail search only filtered the first 50 rows, with no way to page.
  Search now reaches the server-owned title scope, debounces for 200ms, cancels
  obsolete reads and cannot be replaced by a late response. Pages deduplicate;
  at 250 loaded matches the UI asks for a narrower search instead of growing
  without bound. Rows use content visibility and an independent scroll region.
- Previous rename input committed on blur, including when Cancel was clicked.
  Explicit Save/Enter and Cancel/Escape now have distinct behavior. Failed saves
  retain the draft. Touch controls are 44px with named inputs and focus states.
- The sidebar formerly fetched message previews and counts it did not display.
  Its private `view=rail` response contains only id/title/update timestamp and a
  next cursor. Query bounds, duplicate parameters, cursor ownership/search scope,
  deterministic ordering, read limits and safe retryable failures are enforced.
- Session PATCH/DELETE retain owner authorization and gain route-local origin,
  demo and write-rate checks in addition to proxy protection. Soft-deleted
  conversations are not returned by detail or message reads. Message access now
  requires active membership, closing the legacy inactive-participant gap.
  No provider, model-price,
  credit ledger, grant or payment behavior changes.

The [Web Interface Guidelines](https://github.com/vercel-labs/web-interface-guidelines/blob/main/command.md)
informed loading/error distinctions, focus, touch targets, scroll containment,
bounded lists and reduced-motion loading. No second design system was added.

## Verification

Touched lint passes. **95 focused tests pass**, including 30 navigation API and
six actual React rename/draft tests; 21 opt-in ledger cases were skipped, not
counted as passed. The final strict production build passes. Final local checks
pass **3/3**, plus **1/1** dark-mode responsive replay, covering navigation, real
read API and the retained transcript/drawer/composer regression. Preview/live
are recorded below. For one synthetic chat, measured JSON response size is **161 bytes**
for the rail versus **575 bytes** for the full response; this is not a field-CWV
or all-user page-load claim.
Browser scenarios hold the initial response, inject failed and malformed
reads, preserve stale rows, page/deduplicate, race searches, wheel-scroll the rail,
check drawer focus return and eight requested viewport sizes. A separate actual
API check covers private authentication, compact data and scoped search.

The first browser run encountered a late cookie banner covering Load more, plus
a missing saved-transcript fixture. The consent check now waits for the normal
Essential Only action; no overlay is forcibly bypassed. A later wheel check
measured the drawer while its opening animation was still moving; waiting for
the actual animation to finish fixes the target without weakening the assertion.
The dedicated local demo had no chat history, so one explicitly labelled private
synthetic transcript was created through the normal app API. No model was called,
no credits were charged, and no real customer chat was modified. The original
transcript regression then passed unchanged. The Preview demo also lacked
history; one equivalent private synthetic fixture was created there. Live's
retained demo already had a real saved transcript, so no live fixture was added.
A subsequent Preview model-picker wheel check ended 20px short while async
availability/fonts could still change geometry. The test now waits for the
actual credit link, completed model availability and font readiness; the same
strict bottom, focus and overflow assertions then passed. No app scroll behavior
was suppressed or replaced by programmatic scrolling.

## Preview acceptance

Source `eb1b784`, deployment `dpl_25BvsSzVonAQ22emucgmNS89Sisf`
(`dev-veggastare-f65bmr6jw-v3ggas-projects.vercel.app`), is READY and verified at
the stable showcase Preview alias. Build/typecheck pass against the isolated
Preview Neon endpoint; 48 migrations, none pending. Final browser acceptance is
**3/3 plus 1/1 dark-mode replay**.

## Production acceptance

Source `a8ce335` (application changes `eb1b784`), deployment
`dpl_6HAJX4GQhTNZETCPQe5V9GUGfUUP`
(`dev-veggastare-or352kft0-v3ggas-projects.vercel.app`), passed the strict Vercel
build/typecheck against the production Neon endpoint; 48 migrations, none
pending. Candidate health returned healthy. Promotion succeeded and inspecting
`www.veggat.com` resolved to this exact deployment.

Final live browser acceptance passes **3/3 in 34.0s plus 1/1 dark-mode replay
in 9.8s**, with retries disabled. This covers the fixture-driven navigation
failure/search/paging/race/scroll scenarios, actual private read API, and existing
saved-transcript/model-drawer/composer regression. Eight viewport sizes span
360–2560px. The 390px light and 1280px dark screenshots were visually reviewed.
These checks do not call providers, submit payments or mutate saved chats.

In the owner's real Chrome session, the live rail showed explicit loading before
two existing conversations. Searching an existing title returned one result.
Typing a temporary rename draft and clicking Cancel retained the original title;
Refresh and reopening the existing transcript also retained it. No Save, Delete,
Share or Send action was submitted. The existing transcript and pinned composer
were visually inspected at the actual desktop viewport; captured error-level
console logs were empty. The prior real-Chrome viewport override limitation is
not treated as mobile evidence. The open owner payment/login/inbox handoffs
remain uncompleted, separate from this read-only navigation acceptance.

Rollback reference: Sales app `0699868` /
`dpl_GQDV8P3CbfNz2WNNYAfEdvR4HXZh`. No migration or new secret is required.
Owner Live payment/refund, human inbox, remaining OAuth/wallet/backend acceptance
and full-route/native 125% zoom remain separate gates. Navigation tests do not
prove a new provider response, payment or deletion of a real customer chat.
