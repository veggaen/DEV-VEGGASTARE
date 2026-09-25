# Consent first-paint performance follow-up

## Current baseline

September 25, anonymous cold contexts at 390x844, reduced motion, Chromium,
4x CPU throttling, 1.6 Mbps down / 750 Kbps up and 150ms latency. Cache disabled;
25-second observation followed by a bounded network-idle check. No analytics
choice, provider request or payment was submitted. These are lab diagnostics,
not Lighthouse scores, INP measurements or field percentiles. The machine's
background workload and different local/Live delivery paths limit comparisons.

| Before | LCP | FCP | CLS | Transferred | Script transfer |
| --- | ---: | ---: | ---: | ---: | ---: |
| Local optimized build | 8,032ms | 1,664ms | 0.0458 | 1,212,897 B | 1,069,282 B |
| Live `92c5ac7` | 8,312ms | 2,228ms | 0.0458 | 1,246,713 B | 1,061,816 B |

Both samples identify the late cookie-notice paragraph as their final largest
paint. TTFB was approximately 53/88ms, so this particular delay is not explained
by a slow initial server response. Both had no page exceptions or document
horizontal overflow. These observations do not imply every route is fast.

## Candidate

- Render the existing notice in server HTML without an opacity entrance. A small
  nonce-bearing inline presentation check hides a previously saved valid choice
  before paint, then hands presentation back to React synchronously at hydration.
- The bootstrap never writes consent, creates cookies, grants tracking, calls a
  network service or reads account/payment data. Invalid/blocked storage leaves
  the notice visible. The existing telemetry policy independently checks consent
  before mounting either SDK and before each event; it is unchanged.
- Keep the existing CSP policy and request-generated nonce. No new script host,
  unsafe-inline allowance, authentication or caching relaxation is introduced.
- Hide the inert panel with `noscript` when JavaScript is disabled: optional SDKs
  cannot run, and public terms/download links must remain readable and reachable.
- Existing save/failure/reopen/focus and immediate-dismissal behavior is retained.
  No new explanation or marketing copy was added to the UI.

## Local acceptance

Focused consent/policy/telemetry units: **35/35**. Optimized build and TypeScript
passed. Touched-file ESLint and whitespace checks passed. The three focused browser
tests passed again on September 26 in 16 seconds, without retries or skips:
pre-bundle consent visibility (five storage states), responsive consent controls and
immediate scrolling, and no-JavaScript sales terms and downloads at eight widths.

Two serial cold local samples using the baseline settings:

| After | LCP | FCP | CLS | Transferred | Script transfer |
| --- | ---: | ---: | ---: | ---: | ---: |
| Local sample 1 | 1,656ms | 1,656ms | 0.0458 | 1,214,005 B | 1,069,254 B |
| Local sample 2 | 1,660ms | 1,660ms | 0.0458 | 1,213,998 B | 1,069,254 B |

The notice now paints with initial content rather than arriving after hydration.
Neither sample had page exceptions or horizontal document overflow. Script payload
and CLS are effectively unchanged: this is not evidence of faster interactivity,
field Core Web Vitals, or completion of performance work on all routes. Wallet
initialization and route-specific loading remain separate work. Hosted acceptance
is still pending; production has not changed.
