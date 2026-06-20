# Veggat Toolbelt

This is the practical tool map for helping humans and agents improve Veggat without
rebuilding proven infrastructure.

## Default Loop

1. Understand the product problem and trust boundary.
2. Run the smallest local proof.
3. Capture evidence: logs, screenshots, traces, or a written report.
4. If the tool output is weak, create the missing helper tool before continuing.
5. Convert repeated failures into tests, rules, or dashboards.

## Commands

Predict tools for a problem:

```powershell
npm run toolbelt -- --problem="wallet receiver address does not save"
```

Run the core build-backed audit:

```powershell
npm run audit:experience:build
```

Reports are written under:

```text
scripts/_probe/
```

## Tool Strategy

### Visual UX

Use Playwright for route flows, screenshots, hover/click regressions, and traces.
Playwright supports screenshot comparison through `toHaveScreenshot()`, and it
can generate reference screenshots on first run, then compare later runs against
those references.

Next Veggat upgrade: route-specific visual probes for `/products`,
`/products/create`, `/settings?section=wallet`, checkout, and voice settings.

Source: https://playwright.dev/docs/test-snapshots

### Accessibility

Use `@axe-core/playwright` for automated accessibility checks inside Playwright.
Playwright's own accessibility guide calls out common problems it can catch:
contrast issues, unlabeled controls, and duplicate IDs. It also warns that
automated accessibility checks do not replace manual review.

Next Veggat upgrade: install `@axe-core/playwright` and add WCAG A/AA scans for
the marketplace, product creation, checkout, settings, and voice modal.

Source: https://playwright.dev/docs/accessibility-testing

### Performance

Use Lighthouse CI for performance budgets and repeatable audits. Lighthouse CI
supports config files, environment variables, and CLI overrides, with `autorun`
for collect/assert/upload workflows.

Next Veggat upgrade: add a `.lighthouserc.cjs` budget for route classes instead
of optimizing by vibes.

Source: https://github.com/GoogleChrome/lighthouse-ci/blob/main/docs/configuration.md

### Security

Use CodeQL in GitHub for deeper code scanning. Veggat already has a CodeQL
workflow. Use Semgrep later for fast local rules that match Veggat-specific
mistakes: unsafe digital downloads, missing auth checks, untrusted redirects,
payment webhook assumptions, and wallet ownership bypasses.

Sources:
- https://docs.github.com/en/code-security/concepts/code-scanning/codeql/codeql-code-scanning
- https://semgrep.dev/docs/semgrep-ci/overview

### Runtime Evidence

Use Vercel Analytics and Speed Insights for real-user evidence; install Sentry
when a project/DSN exists. Sentry's Next.js wizard can configure client, server,
and edge initialization, source maps, traces, replay, and logs.

Next Veggat upgrade: before enabling replay, define privacy scrubbing for emails,
wallet addresses, order IDs, and payment data.

Source: https://docs.sentry.io/platforms/javascript/guides/nextjs/

### Payments

Do not guess payment health from UI text. Build provider-specific probes:

- PayPal sandbox/live environment detection
- merchant app configured vs seller payout approved
- webhook delivery status
- order confirmation idempotency
- buyer checkout route replay

Next Veggat upgrade: an owner-only checkout simulator that creates a draft order,
walks the selected payment path, and reports exactly which provider capability is
missing.

### Wallets

Separate wallet session from wallet identity:

- connect/disconnect is a browser session action
- verify/link/remove is an account identity action
- payout routing is a seller/payment action

Next Veggat upgrade: invariant tests for EVM shared receivers, Solana receivers,
primary wallet selection, per-product overrides, and disconnect without unlink.

### Voice

Use LiveKit for room/tracks and Playwright with fake media devices for browser
permission/device behavior. Voice quality needs explicit permission tests, fake
microphone streams, device switching, output selection, and visible meter checks.

Next Veggat upgrade: a voice harness that opens the settings modal, grants or
denies microphone permissions, enumerates devices, and verifies live level meter
movement.

## Tool Creation Rule

Every time a tool fails, ask what evidence was missing:

- no screenshot: add screenshot capture
- no browser console: capture console and network failures
- flaky flow: create seeded fixture data
- vague error: parse and surface provider/server details
- repeated manual step: create a CLI wrapper
- hard-to-reason state: write an invariant test
- agent forgets context: write a report to `scripts/_probe/`

The goal is not more tools. The goal is less guessing.
