# Permanent products and responsive purchasing

25 September 2026. Scope: the two existing Veggat Studio SKUs, credit amount
editing, and actual text-provider checks. This is not a whole-app design sign-off.

## Product and layout changes

- Veggat AI Credits replaces the public Interviewer AI Credits name. Stable IDs
  remain unchanged, preserving carts, payment associations and historical orders.
- Fjord Study — Digital Artwork replaces Veggat Interview Pack. The listing
  accurately describes AI-generated 1536 × 1024 artwork, personal-use terms,
  and a useful plain-text wallpaper/setup guide. It does not claim photography,
  4K resolution, exclusive copyright or image/video-generation capability.
- The new guide is private and checksum-verified. Anonymous raw storage access
  returned 403 in Preview and Production. Only the future-delivery association
  was replaced; old assets, issued tokens and historical order records remain.
- Credits use a compact header and two balanced sections from 1280px, stacking
  below that breakpoint. There is no oversized decorative gallery or narrow
  purchase sidebar. Extra information and management controls use disclosures.
- Generic artwork media and its skeleton use equal columns from 1280px. Credit
  route navigation selects the same credit skeleton as subsequent data loading.
- Credit and budget edits apply automatically. Cart/checkout wait for the server;
  failed saves block payment. Invalid amounts cannot become payable quotes.

The [Web Interface Guidelines](https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md)
informed semantics, focus, touch targets and reflow. Research also included
[Anthropic's frontend-design guidance](https://github.com/anthropics/skills/tree/main/skills/frontend-design),
[Vercel Commerce](https://github.com/vercel/commerce) and
[Baymard payment UX](https://baymard.com/blog/payment-ux). No reviewed repository
was verified to be entirely Fable/Mythos-generated; that provenance is not claimed.
The implementation retains Veggat's existing tokens and components.

## Important pricing distinction

Typing `100` now keeps `100` in the budget field and updates the credit selection
without a submit click. It is still a maximum spending budget for whole credits,
not an exact foreign-currency charge. The actual quote remains server-priced in
NOK, with clearly labelled reference-rate equivalents. Exact USD 100 settlement
is not implemented and must not be simulated by rounding the displayed total.

## Text-provider acceptance

- Local OpenAI Luna returned a useful wallpaper tip, persisted the assistant
  reply and debited the retained demo allowance 5 → 3.
- Local Grok returned a response and debited the existing Sandbox balance 8 → 0.
  It refused the artificial exact-phrase prompt; a normal request worked live.
- In real Chrome on www.veggat.com, OpenAI Luna answered a product-description
  question; Grok wrote a short wallpaper description. The actual purchased
  balance moved 10 → 8 → 0. Premium sending is disabled at zero and retains drafts.
- Read-only production ledger: one PURCHASE +10, RESERVE −2 and RESERVE −8;
  both provider reservations COMPLETED; balance 0 and refund adjustment 0.
- Anthropic is BLOCKED by missing `ANTHROPIC_API_KEY` / `CLAUDE_API_KEY` and is
  disabled in the picker. Image/video generation is not implemented in this app.
  Provider API capabilities are not evidence of an implemented Veggat feature.
- No additional PayPal purchase, refund, automatic top-up or credit grant was made.

## Verification

Strict production-style local build and touched-file lint pass. Focused pricing,
provider and ledger unit selection: 98 pass; 21 database-gated cases are skipped
in this invocation, not counted as newly verified integration coverage.

Focused browser tests cover automatic inputs, server confirmation/error locking,
9 NOK starter pricing, budget persistence, selected amount preview, gallery
geometry, keyboard controls and scrolling. Viewports: 360, 390, phone landscape,
768, 1024 portrait, 1280 × 800, 1920 and 2560; credit/checkout checks in both themes.
The checkout controls fit the 1280 × 800 initial viewport. Tests never submit a
real payment and preserve the retained disposable demo cart.

Local artifacts: `frontend/test-results-release-product-polish-local-final2/`.
Production deployment and final live acceptance are recorded in the scoreboard.

Remaining scope includes exact-currency settlement, Anthropic credentials,
image/video product design, provider-account hard-cap verification and the
separately stashed unpaid-order recovery feature. No universal overcharge or
all-route responsive-completion claim is made.
