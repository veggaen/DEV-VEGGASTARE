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

## Verification in progress

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
**3/3 plus 1/1 dark-mode replay**. Production candidate/live acceptance is pending.

Rollback reference: Sales app `0699868` /
`dpl_GQDV8P3CbfNz2WNNYAfEdvR4HXZh`. No migration or new secret is required.
Owner Live payment/refund, human inbox, remaining OAuth/wallet/backend acceptance
and full-route/native 125% zoom remain separate gates. Navigation tests do not
prove a new provider response, payment or deletion of a real customer chat.
