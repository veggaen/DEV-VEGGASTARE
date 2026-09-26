# Message reading and composer layout — 26 September 2026

## Scope

Human-to-human conversation reading/editing layout, plus reduced-motion and
resize behavior in the shared latest-message button. No API, payment, model,
credit-ledger or schema changes. Full route and messaging acceptance is separate.

## Reproduced defects

- `message-list.tsx`: both list effects forced a scroll to the newest message on
  every update. A real SDK callback with fixture transport moved a reader 1,033px
  after one incoming reply. The baseline test failed before the fix.
- The latest-message control lived inside the scrolling content, rather than
  over the transcript viewport. It now sits in a separate positioned wrapper for
  human conversations. AI's separate transcript placement is not changed here.
- The conversation's viewport-height calculation omitted the demo banner. A
  360px screenshot revealed a clipped Send button; the stricter baseline assertion
  measured only 25% of that button inside the viewport. The thread now flexes into
  the actual remaining shell height, including banners, instead of estimating it.
- Purple-gradient bubbles and green-on-purple edit controls ignored the shared
  theme. Bubbles/edit controls now use existing semantic tokens; ordinary words
  wrap naturally, with long unbroken strings still bounded. Attachments are native
  keyboard-accessible links and retain their complete image aspect ratio.

## Implementation

Incoming updates preserve the reader's position. Following resumes near the
bottom, on a new own message, or through the latest-message control. Content
resizes keep a following reader at the bottom. The composer uses a bounded,
scrollable 16px textarea, a named field, safe-area padding and compact landscape
spacing. Core message and composer icon actions have 44px targets/focus rings.
Reduced motion is respected by the shared jump action. No new design system.

The design-guidelines skill informed labels, keyboard links, shared tokens,
explicit transitions and focus states. Reference:
[Web Interface Guidelines](https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md).
This is a focused review, not a claim of whole-app accessibility compliance.

## Verification

Strict production build/TypeScript and final local browser acceptance pass:
8 reading/geometry checks (four viewports in light and dark), 21 conversation
recovery/control checks and 12 AI-canvas regressions — **41 checks**. Viewports
include 360×800, 844×390 landscape, 1280×800 and 2560×1080. Final screenshots
were inspected, including dark phone/landscape, with the complete composer and
Send control visible. The test covers a twenty-line draft and following through
composer growth/shrinkage. Preview/Live promotion remains pending.

Initial local scroll checks passed all four sizes; visual review then found the
additional clipped-composer issue above. That initial batch is not counted as
final layout acceptance.

Test transport/auth/message responses are synthetic; actual app rendering,
Pusher SDK callbacks, wheel input and geometry assertions run unchanged. No
hosted chat write or provider spend occurs. Physical phone keyboards and 125%
native browser zoom remain outside these tests.

## Follow-ups

Private human-chat storage/migration, conversation/reaction authorization,
paginated history, AI latest-button placement, voice controls and the remaining
route inventory remain open. The preceding security release has separate evidence.
