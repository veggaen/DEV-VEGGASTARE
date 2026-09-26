# Full-product acceptance contract

The 77-route render/scroll audit is **not** end-to-end feature acceptance. This
matrix extends that audit following the owner's September 26 request. Previous
unit, isolated-database and intercepted-browser evidence remains useful, but
does not establish that a whole customer workflow works.

## Definition of DONE

For each advertised workflow: use the actual UI and server with disposable
accounts in the isolated test environment; verify committed data through a
fresh session; exercise role denials, invalid input, retry/double-submit and
failure recovery. Label mocked external services explicitly. A route returning
200, a disabled placeholder, or an intercepted success does not pass a workflow.
Do not claim long-term retention from a single reload: also check storage,
cleanup/expiry jobs and cross-session/account isolation.

Review phone 360/390, landscape 844×390, tablet 768, portrait 1024, desktop
1280×800/1920 and ultrawide 2560, plus 125% zoom. Scroll the page, sidebar,
tables, drawers and dialogs. Check keyboard, focus, readable light/dark states,
empty/error/loading states, actionable controls and console/network failures.
Reuse existing tokens/components; keep copy short and secondary help disclosed.

## Workflow matrix

| Area | Required acceptance | Current full-flow status |
| --- | --- | --- |
| Accounts | Register, verify/reset, password and configured OAuth, logout, revoked sessions, unauthorized deep links; two independent users | PARTIAL — prior scoped evidence; not all combinations rerun |
| Personal products | Create physical and digital listings; image/file upload, validation, edit, hide, restore, archive; fresh-session public visibility and private file rejection | PARTIAL — publication transaction tests exist; complete UI lifecycle pending |
| Companies | Create company, owner controls, add second user, roles and individual permissions, revoke/remove; unauthorized and cross-company denials | PARTIAL — joined database workflow and real form/team-endpoint lifecycle pass; full joined team-dialog UI flow pending |
| Employee products | Publish physical/digital on behalf of company; verify seller attribution, stock/assets/wallet ownership; edit/hide/archive with independent permissions; revoke author and retry old tab | PARTIAL — authorization gap fixed; real UI edits/archive/revocation pass; complete upload/publishing wizard still pending |
| Warehouses | Create/edit location, stock allocation and movement, employee scope, concurrent orders, no negative/double stock; shipping failure recovery | PARTIAL — access checks only do not prove fulfillment |
| Marketplace/order | Discover → PDP → cart → checkout → verified payment → receipt/download; physical shipping/fulfillment; buyer + employee + owner order views | PARTIAL — curated digital checkout exists; general-listing checkout explicitly unavailable |
| Payments/credits | Sandbox capture/cancel/refund/webhook replay, mixed cart, amount authority, caps; credit reservation/refund/zero balance/concurrency; seller routing | PARTIAL — retain prior evidence; do not infer all sellers/payment methods work |
| Jobs | Post as personal/company actor, discover, apply/claim by second account, accept/reject/cancel/complete, permissions, duplicate claim and stale edits | PARTIAL — detail/read coverage does not prove the lifecycle |
| Paper trading | Create portfolio, buy/sell/swap; cash/positions/history and fees; reload, logout/login, second browser, isolated second user, aged records, reset consent; concurrency and price outage | PARTIAL — database models exist; retention report and execution safety unverified |
| P2P trading | Two independent users/wallets; invite/decline, edit offer resets both approvals, double-confirm/replay/disconnect/expiry; only verified settlement completes | PARTIAL — no complete two-party acceptance established |
| Local chain | Isolated Anvil/devnet accounts; connect/switch wrong chain, balances, submit, receipt/confirmations, revert/replacement/replay, history and reconnect | PARTIAL — no completed local-chain acceptance established; never use real assets |
| AI | Fresh chat, per-chat draft/attachments, reorder, providers/models, stream/stop/retry, image/video states, durable history and credit safety | PARTIAL — retain scoped evidence; no blanket all-provider claim |
| Pulse/messages | Post/reply/edit/delete, media, visibility, reactions, polls, search, profile pins, moderation; independent user permissions and persistence | PARTIAL — messaging slice verified; remaining Pulse actions pending |
| Platform/admin | Notifications/preferences, consent analytics, company/seller analytics, contact/legal, administration and exports; no fake controls, secret or private-data exposure | PARTIAL — each mutation/report needs separate acceptance |

## Execution rules

- Start with company → permission grant → physical/digital publication →
  lifecycle → permission revocation, then paper-trading persistence/execution.
- Keep an evidence record per scenario: actors, route, actual interactions,
  expected/observed state, test command, environment, commit and remaining gaps.
- Real writes only against exact disposable fixtures in the isolated database;
  clean up only those fixtures. Never delete customer records to test deletion.
- Use sandbox payments and isolated local-chain funds. Live purchases need a
  separate owner handoff; never infer a payment from a return URL.
- Do not promote unrelated pending money/schema changes with a UI/security fix.
- DONE applies only to demonstrated scenarios. Missing credentials may be
  BLOCKED with the exact missing configuration; untested work stays PARTIAL.

## Initial concrete findings

Product lifecycle findings below have scoped fixes and local verification in
[product lifecycle evidence](product-lifecycle-evidence-2026-09.md). Paper trading
findings remain open; database storage alone does not establish reliable persistence.

- `frontend/actions/products.ts`: company product authors retain edit/archive
  rights after membership removal; edit/delete/visibility permissions are merged
  for lifecycle actions; authorization occurs outside the write transaction.
- `frontend/app/products/[...id]/ProductClient.tsx`: same author bypass and
  merged lifecycle controls; an edit-only employee is shown archive controls.
- `frontend/actions/paper-trade.ts`: portfolios are already database-backed,
  so “stored only in the browser” is not an established cause. Buy/sell/swap
  balance checks run before transactions; unified history writes are
  fire-and-forget. These require execution/concurrency tests.
- `frontend/app/dashboard/paper-trading/page.tsx`: failed portfolio reads clear
  the displayed portfolio, conflating a failed load with no saved portfolio.
  Confirm the reported disappearance through an actual saved-user workflow.
