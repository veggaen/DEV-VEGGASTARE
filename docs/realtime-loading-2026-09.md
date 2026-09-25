# Realtime loading and listener ownership

## Local evidence — 26 September 2026

The shared `usePusher` hook now imports the browser SDK only for a configured,
non-empty subscription. Provider boundaries and server-rendered content remain
unchanged. A channel registry unbinds each consumer's own listener and only
unsubscribes a channel after its last consumer leaves. Callback changes update a
ref rather than reconnecting. This follows Pusher's
[specific-listener unbinding API](https://pusher.com/docs/channels/using_channels/events/).

- Production build and TypeScript: passed.
- Focused hook/registry units: 9/9; touched-file ESLint: passed.
- `playwright.realtime.config.ts`: 3/3, no retries. Guest homepage opens no Pusher
  socket; retained isolated demo sessions receive a cart refresh via the real SDK
  and retain the subscription across client navigation at 390 and 1280 pixels.
- Only WebSocket transport and cart GET response are mocked. No Pusher event is
  published externally, and no persistent cart, payment, credit or email changes.
- First mobile test failed because the cart link is inside the mobile drawer;
  the test now opens the actual menu before clicking. This was a test assumption,
  not a reproduced app defect.
- One cold throttled local homepage sample: JS 1,051,479 bytes versus the prior
  integrated sample's 1,069,283 bytes (17,804 fewer, about 1.7%). LCP/FCP 1,476 ms,
  CLS 0.045813, no page errors or horizontal overflow. Single-run lab evidence,
  not proof of field or all-route improvement. Global wallet bundles remain large.

Run with an already authenticated demo storage state:

```powershell
$env:E2E_DEMO_STORAGE_STATE='.private-showcase/release-local-demo.json'
npx playwright test --config=playwright.realtime.config.ts --reporter=list
```

Preview and Live verification remain pending. Do not promote the integrated
native-currency/schema changes as part of this small loading correction.
