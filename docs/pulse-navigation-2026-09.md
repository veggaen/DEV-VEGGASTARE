# Pulse reading and navigation acceptance

Scope: open a public post from the feed, read/scroll it, close it, reopen with
browser Forward or the keyboard, and follow/clear a tag. This is not a claim
that all Pulse publishing, moderation or polling interactions have been tested.

## Confirmed defects and changes

- Opening a post replaced the feed's history entry. In the signed-in baseline,
  Escape returned to `/` instead of `/pulse`. Opening now pushes an entry.
- The custom overlay had no dialog semantics or focus handling and imposed a
  520px minimum height on landscape phones. It now uses the shared dialog,
  viewport-bounded height, an internally scrolling transcript and a pinned
  composer. Close returns focus without moving the feed.
- The comment count is now a real keyboard-accessible post link.
- Following a tag previously combined competing close/navigation operations.
  One navigation and a matching empty parallel-route slot now dismiss the post.
- Tag state is read from the URL, preserved behind an open post, and removable
  at every width. Clearing filters also clears their URL parameters.
- Reduced-motion styling now overrides the dialog's state-specific animation.
  The landscape test exposed a moving scroll target before this correction.
- Visual review at 360px found a cramped header even after functional tests
  passed. Share/Expand now use accessible icon-only buttons on small screens.

The UI review used the [Web Interface Guidelines](https://github.com/vercel-labs/web-interface-guidelines):
semantic navigation, focus return, reduced motion, contained scrolling and
visible filter state. No new design system or payment behavior was introduced.

## Verification

The focused suite covers 360×800, 390×844, 844×390, 768×1024, 1024×1366,
1280×800, 1920×1080 and 2560×1440. It checks:

- Open → Escape → Forward → scroll to the final reply → Close → keyboard reopen.
- Feed scroll position and focus restoration.
- Tag navigation, query sent to the API, reading with a tag active, and clearing.
- Dialog horizontal overflow, reachable Close, header spacing and reduced motion.
- Existing footer pagination/retry and independent navigation-drawer scrolling.

The long conversation is a browser-only API fixture using a real app-issued demo
session. It creates no public posts or messages. An expired local session was
renewed through the normal public demo button; no signup cap was changed.
No provider generation, paid credit grant, purchase or refund is part of this test.

Strict production build/TypeScript and touched-file lint pass (three existing
internal hard-navigation warnings; Expand deliberately performs a full navigation).
Initial focused acceptance: four tests passed locally in 39.8s. Final compact-header
acceptance also passes all four tests in 39.1s, with the header spacing assertion
and fresh visual review at 360px. Results are in the ignored
`frontend/test-results-release-pulse-detail-local-header/` directory.
Production acceptance is pending deployment.

### Reproduce

Use the documented isolated local environment on `http://localhost:3000`; never
copy Live PayPal keys into localhost. Supply a private, current demo storage-state
file in `E2E_DEMO_STORAGE_STATE`, and set `E2E_PULSE_DETAIL=1` and `E2E_BASE_URL`.

```powershell
node node_modules/@playwright/test/cli.js test --project=no-auth --no-deps --grep='S8 Pulse detail preserves|Pulse filters, footer|Pulse footer waits' --retries=0 --reporter=list,json
```

## Boundaries

The real Chrome local database currently has no public posts; its empty state and
sorting were checked without publishing owner content. Fixture-based navigation
is separate from real Live post verification. Physical phone keyboard behavior,
legacy `?open=` links, all mutating buttons and native 125% zoom are not proven by
this slice. The overall production scoreboard remains partial.

Live artwork refund remains unsubmitted and requires separate owner approval;
the owner's recent explanation request did not authorize a refund.
