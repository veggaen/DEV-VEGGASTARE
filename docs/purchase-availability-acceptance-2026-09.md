# Purchase availability acceptance — September 2026

## Release authority

Application commit: `6816380` on `release/showcase-september`; main is unchanged.
Preview: `dpl_Cihybd12e4BQM3h7Lp4tHNfCfaZS`,
`dev-veggastare-pmeyzpdcn-v3ggas-projects.vercel.app`, assigned to the existing
`dev-veggastare-git-showcase-ai-revival-v3ggas-projects.vercel.app` alias.
Production: `dpl_72qycJnr4Zwp4os4xyFxRmBFJ7Xj`,
`dev-veggastare-cbslddl49-v3ggas-projects.vercel.app`, promoted after candidate
health and Live PayPal capability checks. `www.veggat.com` was inspected and
resolved to that exact deployment ID before live browser acceptance.
Rollback before this slice: application `6654f24`, production
`dpl_HmPFfAVgHNXUxj6s2TSf6rARTHhy` (`jbnv6j873`).

## Changes and boundaries

- A shared purchase-state function makes the existing released scope explicit:
  the two public digital reviewer SKUs are eligible; other listings are browse
  only; non-public or delivery-paused products are unavailable. This does not
  release general-marketplace, multi-seller, or Web3 payment.
- Catalog and product detail explain browse-only/paused states before a buyer
  tries to pay. They retain detail and navigation links without misleading
  active Buy controls or a mobile pinned purchase bar. Eligible products keep
  their existing purchase controls. The count now says `1 product`.
- Mixed carts name the unsupported item and allow the buyer to remove it.
  There is no automatic deletion. Existing quantity and checkout limits remain.
- The server checkout page reads current product availability before showing
  payment controls. New checkout preparation also rejects
  `downloadsEnabled=false`, before an order or checkout attempt is created.
  This closes the prior gap where visibility/type were checked but paused
  delivery was not. It does not cancel existing approved orders or prevent
  capture/refund reconciliation; those paths are unchanged.
- The owner runtime page shows `Not changed yet — system defaults` instead of
  January 1970 for an unset timestamp. No runtime switches were changed.
- No database migration, key, environment value, payment, refund, or new public
  product was introduced. This is purchase availability, not fulfillment proof.

## Verification

- Touched-file ESLint, `git diff --check`, strict local production build and
  TypeScript pass. Both Vercel builds pass; 48 migrations, none pending.
- **78/78 focused units**, six files: purchase-state combinations, checkout
  recovery rendering, public catalog, server preparation, payment policy and
  fulfillment-store regression coverage. Both paused reviewer SKUs are rejected
  without order/attempt creation. Rendering tests show the specific unavailable
  line and cart link, without payment controls. Provider calls are mocked here.
- **6/6 local in 16.6s**, **6/6 Preview in 32.4s**, **6/6 live in 40.6s**:
  browse-only/paused catalog and PDP, mixed-cart recovery at 390/1280, existing
  product retry at both widths, guest safe-login return, and direct/client-nav
  product skeleton geometry. Availability reflow checks cover 360, 390,
  844 landscape, 768, 1024, 1280, 1920 and 2560, with no horizontal overflow.
- Additional dark availability replay: **1/1 local in 4.0s**, **1/1 Preview in
  6.5s**, **1/1 live in 5.6s**. Inspected phone/desktop fixture screenshots.
- Availability and mixed-cart edge cases use intercepted API fixtures, not
  deliberately broken production listings. Cart removal is intercepted and
  asserted exactly once for the intended item. No actual payment is performed
  by these checks. Existing test setup can refresh reviewer seed timestamps.
- Real Chrome local: actual catalog search `Interviewer` shows `1 product` at
  390×844; the eligible credits page retains its editable credit amount and
  mobile purchase bar. Actual scrolling reaches the single footer, bottom
  763.58, above that bar; scrollTop 2076 of 2795−719. No horizontal overflow.
- Real Chrome live owner runtime: the default timestamp is human-readable at
  390×844; settled screenshot shows it, the disabled legacy switch, webhook
  section and footer. No switch was clicked; normal viewport restored.

### Failed or inconclusive attempts

- Initial lint invocation used the repository root rather than frontend config
  directory. The correct touched-file invocation passes.
- One CUA observation expression had an extra parenthesis; no UI action ran.
- An exact-text lookup omitted `Changed at:` and found no node. The actual
  complete label was then verified in the live accessibility tree and screenshot.
- Immediate post-scroll geometry preceded smooth-scroll settlement; the later
  screenshot and settled geometry above are the evidence, not the initial zero.
- Seller-form reconnaissance found blank-step navigation, but source comments
  confirm navigation is deliberately soft until review. It is not evidence of
  invalid publication. No listing was submitted. Review recovery and truthful
  owner listing tools need their own next slice.

Artifacts: `frontend/test-results-release-purchase-availability-{local,preview,live}/`
and their `-dark` counterparts. Screenshots, sessions and reports remain
uncommitted and excluded from deployment.

## Remaining work

Whole-app acceptance remains partial: owner Live micro-purchases/refund,
human-inbox delivery/legal sufficiency, remaining OAuth/wallet/backend checks,
verified Web3 and general-listing checkout, full-route interactions and native
125% zoom. No field Core Web Vitals or universal device approval is claimed.

Webapp-testing informed scoped assertions and fixture boundaries. Web Interface
Guidelines informed clear availability, retained navigation and bounded reflow.
Computer-use guided real-browser observation and restoration of the viewport.
