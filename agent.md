# VeggaStare — Agent Context

> Last Updated: 2026-09-28

The best senior engineers in history combined technical mastery with visionary impact, shaping modern infrastructure and technology. You are an expert full-stack engineer specialized in expanding the VeggaStare monorepo.

---

## Main Rules

Always presume dev servers are running in VSCode terminal window because I (the human Vegga from the basement) usually start this with `C:\Users\v3gga\Documents\DEV-VEGGASTARE> npm run start:project`.

---

## Project Structure (never change this)

```
Root: C:\Users\v3gga\Documents\DEV-VEGGASTARE\
├── package.json          # monorepo scripts: npm run start:project, dev:fe, dev:be, etc.
├── frontend/             # Next.js 16 (React 19, App Router, Tailwind 4, shadcn/ui via Radix
│                         #   + lucide-react + framer-motion + sonner + react-hook-form + zod)
├── backend/              # Hapi.js + Prisma
├── prisma/               # schema is in frontend/prisma/schema.prisma (canonical)
│                         #   and backend/prisma/schema.prisma (synced)
├── scripts/              # dev-start.ps1, dev-stop.ps1, aggregate-context.ts
├── docs/                 # Feature specs, legal, integration guides
├── docs/architecture.md   # Service boundaries, data flows, deployment
├── docs/production-scoreboard.md # Evidence-based feature status tracking
└── docs/archive/early-concepts/ # Historical notes; not current product requirements
```

---

## Dev Workflow

- I always run `npm run start:project` in VSCode terminal.
- Presume both frontend (:3000) and backend (:3001 API + :3002 WS) dev servers are already running.
- Only give commands like "save the file and refresh browser" or "npm run prisma:generate" when needed.
- Local database: `frontend/lib/db.ts` reads `DATABASE_URL_MAINDEV` (Vercel: MAINLIVE / MAINPREVIEW). The ignored `frontend/.env.local` now points at the previously tested isolated QA database, not the February-era `DATABASE_URL` in `.env`. On 2026-09-27 the older DB contained the test user's email but no Google/GitHub account links, causing `OAuthAccountNotLinked`; those links remained intact in the QA DB. Do not switch databases or copy account links to fix OAuth. Verify the intended target without printing connection strings. No schema migration was needed for this repair.
- Local OAuth origin is `http://localhost:3000`, explicitly set as `AUTH_URL` and `NEXTAUTH_URL`. Use the development GitHub app credentials, not the production app. Environment files are ignored and are not restored by switching Git branches. Restart the frontend after changing its DB target: the development Prisma singleton keeps the previous connection.
- Discord's client secret was replaced by the owner on 2026-09-27 and saved to Vercel and ignored local configuration. Older worktree copies are invalid; do not restore them. Local Discord sign-in now passes. Its browser identity has a different email from the Google/GitHub test account; account linking must remain explicit.
- Local PayPal credentials are Sandbox-only, verified against the Sandbox OAuth endpoint. Local purchase emails remain disabled deliberately. Platform keys may be configured locally, but model availability alone is not evidence of a successful provider request. Never copy Live PayPal keys, Vercel tokens or the Live DB into local tests.
- `REDIS_URL` is optional. If it is set but nothing listens, the rate limiter now gives up after ~3s and uses memory (it used to hang every sign-in for 60s+).
- Frontend runs plain `next dev` / `next build` (see `frontend/package.json`); `next.config.mjs` carries both `turbopack.root` and a `webpack()` hook — leave both alone, do not change the bundler.

---

## Existing AI Infra (use it!)

- **Models**: `UserAiApiKey`, `DailyAiUsage`, `AiConversation`, `AiConvParticipant`, `AiConvMessage`, `AiConvReaction`, `ScheduledPoll`
- User can have multiple AI keys (OPENAI, GROQ, ANTHROPIC, etc.) stored encrypted.
- `DailyAiUsage` already tracks quota per user per day.
- There is already an `/ai/chat` page — new builder will live at `/ai/builder`.

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend framework | Next.js 16 (App Router, React 19) |
| Styling | Tailwind CSS 4, shadcn/ui (Radix primitives) |
| Animation | Framer Motion |
| Forms | react-hook-form + Zod validation |
| Toasts | Sonner |
| Icons | lucide-react, react-icons |
| Auth | NextAuth v5 (auth.ts / auth.config.ts) |
| ORM | Prisma (schema in frontend/prisma/schema.prisma) |
| Backend | Hapi.js (backend/src/) |
| Web3 | wagmi, viem, @reown/appkit, @solana/wallet-adapter |
| Real-time | Pusher (backend WebSocket on :3002) |
| Deployment | Vercel (frontend), Railway (backend) |
| CI | GitHub Actions (lint, type-check, build, Prisma validation) |

---

## Mandatory Rules (agent-friendly output)

1. **Always start every response with a short PLAN** (bullet points).
2. **Output either:**
   - Full new files with exact path (e.g. `frontend/app/ai/builder/page.tsx`)
   - OR precise git-style diffs/patches for existing files
3. **After code, always list exact commands** I need to run (e.g. "Save file → refresh browser", `npm run prisma:generate`, `npx prisma db push` if schema changes).
4. **Use ONLY existing tech**: Hapi.js routes in `backend/src/routes/`, Next.js Server Actions or fetch to `/api/ai/...` in frontend.
5. **Security:**
   - Always check user's `DailyAiUsage` quota first
   - Use user's default `UserAiApiKey` (or platform fallback)
   - Never expose keys
   - Rate limit endpoints
   - Validate all inputs with Zod
6. **UI/UX**: Premium shadcn style, tokens-first and both themes equal (`.claude/skills/award-worthy-ui/SKILL.md` is the only styling authority), framer-motion transitions, responsive, loading skeletons, sonner toasts, react-hook-form + zod. Shared chrome comes from `frontend/components/uicustom/chrome/` — see "App chrome kernel" below.
7. **Code conventions:**
   - Server Components by default. `"use client"` only when needed.
   - All mutations via server actions with Zod validation.
   - Add `@fileOverview` and `@stability` tags to new files.
   - Run `npx prisma generate` after schema changes.

---

## Response Format

Every response follows: **PLAN → CODE → COMMANDS → SECURITY/UX CHECKLIST**

### Few-Shot Examples

**Example 1 — New Route**
Task: "Add the /ai/builder page"
Plan: ...
Created `frontend/app/ai/builder/page.tsx` (full code)
Added Hapi route `backend/src/routes/ai.ts`
Commands: Save files → refresh http://localhost:3000/ai/builder

**Example 2 — Schema change**
Task: "Add a field to store generated code"
Plan: ...
Diff for `prisma/schema.prisma`
Commands: `npm run prisma:generate && npx prisma db push`

**Example 3 — Fix broken UI**
Task: "The existing AI chat page has bad mobile UX"
Plan: ...
Updated `frontend/app/ai/chat/page.tsx` with responsive grid
Commands: Save → hard refresh

---

## Git Rules

- **Never push directly to `main`.** Always `feature-branch → dev → main` or `dev → main`.
- **`dev`** is the staging branch (Vercel preview deployments).
- **`main`** is production (veggat.com + Railway backend).
- Feature branches: `feat/short-name`, `fix/short-name`, `chore/short-name`.

---

## App chrome kernel (2026-09-27)

One brand, one visual language. Landing `/` is the source of taste; every other route uses the same chrome, tokens and motion — quieter, never a second product. On-screen brand name is **Veggat** (never "VeggaStare").

| Primitive | File | Role |
|-----------|------|------|
| `BrandMark` | `frontend/components/uicustom/chrome/brand-mark.tsx` | "Veggat™" wordmark, `size="header" \| "hero"`. Kinetic per-letter hover + same-letter resonance, ™ spring jump, T/M split hover. Idle ™ colour swap is a CSS keyframe (`brandTmSwap`), not a React interval. |
| `AppRail` / `RailAction` | `frontend/components/uicustom/chrome/app-rail.tsx` | Floating glass chips. One measured, spring-driven active box + a hover chaser that parks on the active chip. `variant="header"` (md+) and `variant="dock"` (fixed bottom bar < md). Chips come from `getPrimaryNavigation()` in `site-navigation.ts`. Uses plain `next/link` on purpose (the shared `NavigationLink` progress bar would be trapped inside a transformed chip). |
| `AppHeader` | `frontend/components/uicustom/chrome/app-header.tsx` | Brand mark left; on md+ ONE glass pill on the right holding the nav chips **and** the utilities (currency, alerts, cart, messages, theme) with the account circle hanging off its end (larger than the pill). Utilities are `RailSlot`s inside `AppRail` (`RailDivider` separates them) so the rail's hover chaser travels across everything; utility triggers use `PILL_ICON_CHIP` (borderless, `hover:bg-transparent`). Below md the header keeps only theme + Menu; the dock takes the chips. Chrome layer fades in on scroll. Keeps `data-header-canvas` / `data-nav-key="logo"` for e2e. |
| `Atmosphere` | `frontend/components/uicustom/chrome/atmosphere.tsx` | `HeroParticleField` wrapper, `variant="landing" \| "quiet"`. Landing intensity only on `/`; quiet on `/auth/*`; nowhere else. |
| `ThemeToggle` | `frontend/components/uicustom/chrome/theme-toggle.tsx` | Header light/dark switch; `runThemeCrossfade()` flags `<html>` for the 500ms colour cross-fade. Theme state lives ONLY on `<html>`. |
| `MobileDock` | `frontend/components/uicustom/chrome/mobile-dock.tsx` | The dock variant wired to the session; `<main>` reserves `--mobile-rail-offset` under it. |

Wiring: `topbar.tsx` keeps all auth/wallet/notification logic and renders through `AppHeader`; `app-shell.tsx` mounts `MobileDock` (not on `/auth/*` or immersive chat). The old fat sidebar/dock (`sidemenumainauth.tsx`, `dashboard-shell.tsx`, `desktop-navigation.tsx`, `dashboard-dock-context.tsx`, `auth/auth-navigation.tsx`, `themebtn.tsx`) is deleted — there is one nav system.

Tokens added in `globals.css`: `--brand-accent-alt` (™ counter-phase tint: cyan light / violet dark), `--brand-mark-tint` (letter ink: accent on light, accent-light on dark), `--mobile-rail-offset`.

Theme parity + customisation (2026-09-27): light mirrors dark 1:1 (pure white canvas + 5% accent haze vs pure black; the particle field draws with `multiply` on light and `lighter` on dark at identical alpha; no hero scrims). The theme toggle uses the View Transitions API — a circular reveal from the button (`html.theme-vt::view-transition-new(root)`), falling back to the 320ms `.theme-transitioning` cross-fade; `swapThemeWithReveal()` in `chrome/theme-toggle.tsx` is the one entry point (header toggle, drawer, Settings). Users pick an accent preset in Settings → Appearance (`prefs.accent`: default | sky | emerald | violet | rose | amber | mono); it lands on `html[data-accent]` (boot script `lib/accent-boot.ts` prevents a flash) and every `--brand-accent*` token, `--brand-accent-rgb` (canvases) and the BrandMark follow. `UiPreferencesProvider` now gates persistence behind the initial read (StrictMode used to reset saved prefs in dev).

Light mode (2026-09-27): `--border` is `214 14% 80%` (was 86%) so faded borders (`border-border/60`) keep presence on white, matching the dark hairline on black; the particle field multiplies at 1.6x alpha on light because ink darkens less than light glows; ghost buttons get a transparent border that turns visible on hover. Washes: a translucent hover/surface wash must be ink-alpha (`bg-foreground/[0.05]`, `hover:bg-foreground/[0.07]`), never `bg-muted/NN` — muted at partial alpha is invisible on the light canvas but reads on black, which is exactly the "light mode feels different" bug. `bg-muted` at full strength is fine for real surfaces. Cards on Pulse/landing use `bg-card/70 dark:bg-surface-3/60 backdrop-blur-xl shadow-e1`. Styled `<Link>`s need an explicit display class (`block`/`inline-flex`): an inline anchor with padding + rounded border draws a notch (the old Pulse composer).

Routes sharing header + rail: everything under `AppShell` (`/`, `/products/*`, `/pulse/*`, `/auth/*`, `/dashboard`, `/ai`, `/settings`, …). Only `/gate` is outside.

Tooltips (2026-09-27): every control in the app chrome uses `HeaderTip` (`chrome/header-tip.tsx`, a Radix pill: `rounded-full border-border/60 px-3 py-1.5 text-[11px]`) — rail chips (icon-only below lg), currency, alerts, cart, messages, theme, account, and the terminal toolbar. Never a native `title` attribute on chrome controls: it ignores the theme. A Radix Tooltip needs a `TooltipProvider`; `AppHeader` provides one, `AppRail` carries its own (`MaybeTip`) because the mobile dock renders outside the header.

Trailing hover box (2026-09-27): `HoverChaser` (`chrome/hover-chaser.tsx`) is the hover treatment for grids and menus — one spring-driven accent box that slides between items in any direction (same feel as the rail chaser). Wrap the grid, mark items `data-chase`, and drop their own hover fills. The box paints ABOVE the items (`z-[1]`, 8% accent tint + hairline, no glow) so opaque cards still show it; it never captures the pointer. Used on the dashboard quick links, the drawer's Navigate/Settings tiles and the settings sidebar; use it for any new card grid or vertical menu instead of per-card hover borders.

Account drawer (2026-09-27): Navigate tab = two-column tile grid with icon wells; Settings tab = quick-settings tiles + one wallet card (verify/manage tools behind a `<details>`). Appearance and currency are NOT repeated in the drawer — they live in the header.

Marketplace (2026-09-27): `/products` = PageHeader + sticky glass toolbar (categories, search, Filters button below xl) + a filter column INSIDE the catalog frame on xl+ (`CatalogFilters`, sticky glass card) and a left Sheet below xl. The page is never pushed aside: the old draggable/dockable fixed sidebar (`product/sidebar.tsx`, dock spacers in `product-layoutProvider`) is no longer rendered; `useSidebar()` keeps `isSidebarOpen/toggleSidebar/perPage` for the toolbar and panel. Cards: glass `rounded-2xl`, type badge on a top scrim, seller initial, two-line title, fiat + crypto price, category chip, accent pill Buy + round cart. Active filters render as removable chips above the grid. Grid columns come from container queries (`@sm/@3xl/@6xl`) so they follow the width beside the column. The column can be hidden entirely (panel "Hide filters" button, or the toolbar Filters button on xl+; persisted in `localStorage veggat:catalog:filtersHidden` via `useSidebar().filterColumnHidden`): it becomes a 0px grid column (transition on `grid-template-columns`, `inert` + `aria-hidden`) so the grid widens in place. Below xl the same button opens the Sheet. The card grid is a `HoverChaser` (cards are `data-chase`, no lift/border hover of their own). Filter group headers have `py-1.5` sections so the hover fill never touches the divider lines. `useMinWidth` lives in `hooks/use-min-width.ts`.

Wallet data + drawer wallet panel (2026-09-27): `lib/evm-rpc.ts` is the one RPC map (Infura mainnet from `NEXT_PUBLIC_ETHEREUM_RPC`, public RPCs elsewhere, 127.0.0.1 for Anvil/Ganache). AppKit's `WagmiAdapter` and `createAppKit` get it as `customRpcUrls`: Reown's default RPC answers 401 unless the project's allowed origins include the page host (never localhost), which made every balance read fail. Token discovery: `GET /api/wallets/evm/tokens?chainId&address` proxies Blockscout's paginated `addresses/{addr}/tokens?type=ERC-20` (keyless; top 50 by fiat value; hosts in `lib/wallet-tokens.ts`; 30 s server cache; session + read rate limit) and `useTokenBalances` runs two passes: the known list over RPC first (fast), then the discovered tokens (client cache 60 s), confirmed by multicall with the indexed balance as the per-token fallback; a total failure sets `error`, which the inventory footer shows as "Balances didn't load · Retry". Drawer: the connected wallet's Verify ownership is a compact accent pill (`WalletVerificationAction`), the Settings-tab network picker is a DropdownMenu (`SidebarWalletInfo` in topbar.tsx), the Activate control is a small pill and falls back to matching the extension by friendly label (registry uids change per load) with an error that says to connect it from the list, every wallet row says "Transfer" and the transfer sheet has From (active wallet signs; picking another live wallet activates it; local accounts sign over RPC) and To (your wallets menu + free address input, both with copy), and the dev-chain status card lives inside "Local Dev Chains" in the connect list instead of above it. Not reproducible headless: MetaMask "navigated away" on connect (no SDK connector is configured; the drawer connects EIP-6963 extensions directly).

Stack values + trade totals + load sequence (2026-09-28): `lib/stack-value.ts` (`stackUsd`, `sumStacksUsd`, `formatUsdCompact`, `formatUsd`) prices a stack from the token's indexer `usdPrice` or, for native coins, `useCurrencyRates().cryptoPrices`; every inventory cell shows its value bottom-right (symbol bottom-left), the footer sum and the trade window's per-side totals ("Your offer ≈ $…", "+" when some stacks are unpriced) use the same helper. The hook orders by USD value on the first read and then KEEPS positions (new ids appended) so a price tick never re-sorts the grid, and it no longer publishes the short known-list on later polls (that intermediate publish rebuilt every cell twice per poll: the real flicker). Pass 2 also gives known-list stacks the indexer price. `useNftBalances` has the same signature guard. The trading page renders a "Connecting your wallet…" placeholder before hydration, during wagmi `reconnecting`, and for 1.8 s after mount, so a returning user never sees the "No wallet connected" call to action flash before the hub; the placeholder is identical on server and first client paint (no hydration mismatch).

Inventory stability (2026-09-27, last): `useTokenBalances` publishes a new `tokens` array only when the content signature (id, raw balance, price) changed, so the 12 s poll no longer rebuilds the inventory grid (which reset split stacks and anything mid-drag); `loading` is only the first read per wallet/chain and `refreshing` covers background polls (the refresh icon spins on both). Tokens carry `usdPrice` from the indexer; the inventory footer shows `≈ $…` (native priced from `useCurrencyRates().cryptoPrices`, a trailing `+` when some stacks are unpriced).

Wallet switching, the real fix (2026-09-27, last): AppKit's `handlePreviousConnectorConnection` disconnects the previous connector on every account change unless its remote feature `multiWallet` is on; the cloud config never sends it here (403) and the local `features.multiWallet` is ignored for that flag, so `ensureAppKit` calls `appKit.updateRemoteFeatures({ ...appKit.remoteFeatures, multiWallet: true })` right after `ready()`. Wagmi's injected disconnect sends `wallet_revokePermissions`, which MetaMask honours and Coinbase ignores — that asymmetry is why only the switch back to MetaMask re-prompted. Balances: the hook uses viem's `pulsechain` (has Multicall3; the custom definition had none, so every PulseChain read failed), reads one-by-one on chains without Multicall3 (Anvil/Ganache), and only reports "Balances didn't load" after two consecutive complete failures; while the first read is in flight the footer says "Reading balances…".

Wallet switching (2026-09-27, latest): `activateWallet` prefers an extension's own EIP-6963 connector over the shared `injected` (window.ethereum) one when a registry/DB wallet resolved to the latter, and only disconnects another connection when the TARGET is the shared connector; `ExtensionReconnect` skips the shared connector once EIP-6963 extensions are announced. Reason: the shared connector holds one extension at a time, so a switch through it disconnected the other extension and wagmi's disconnect revokes that site permission — the "connect twice" loop between MetaMask and Coinbase. `ensureWalletAccount` (lib/wallet-activation.ts) only prompts when `eth_accounts` on the extension's own provider is empty or a different account.

Follow-ups (2026-09-27, late): switching the active wallet between two connected extensions no longer disconnects the other one (only the legacy `injected` window.ethereum connector collides; wagmi's disconnect also revokes the site permission, which is what re-prompted "Connect this website"). The wallet card's chain footer is a chip (`● PulseChain #369`, amber for local chains) and `WalletVerificationAction` has `size="sm"` (quiet text chip) for the card, `md` for Settings. `/products` price context is an info icon with a tooltip on the Price group header (`Group hint`); `CatalogFilters` wraps itself in a `TooltipProvider` (Radix throws without one, and the panel lives outside the header's provider — it took the whole route down).

Follow-ups (2026-09-27, evening): `HoverChaser` box is `bg-brand-accent/[0.10] ring-brand-accent/60` in light and `/[0.05]` + `/40` in dark (light washed out, dark tinted photos); the product grid passes a ring-only `boxClassName` so photos are never tinted. Landing particles get ×2.4 alpha and ×1.35 radius in light; the Settings ghost on the hero has no border in either theme, only a fill. Wallets: `Web3Providers` mounts `ExtensionReconnect`, which calls wagmi `reconnect` for injected/announced connectors on load (twice: EIP-6963 extensions announce just after mount), so an unlocked extension is live again with no click and a locked one needs one Activate; `activateWallet` searches the React `useConnect().connectors` list (that is where the EIP-6963 extensions are), adds a fuzzy name/id match, and the failure message lists which extensions ARE installed. Tabs can hold stale HMR state after a dev-server crash: a hard refresh shows the current UI.

Real transfers + scam gating (2026-09-28): every path that moves tokens goes through `useSendStacks` (`hooks/use-send-stacks.ts`): it finds the wagmi connection that holds the sending account, switches its chain if needed, sends one `sendTransaction`/`writeContract(erc20 transfer)` per stack through that extension (so the wallet prompts), waits for the receipt, and only then marks the step confirmed; `SendProgress` renders the steps with explorer links. Inventory: "Send" (detail panel and right-click) opens `SendStackDialog` (paste address or pick another connected wallet, Max keeps gas back for native coins, records a SELF TradeRecord on success). Internal transfer: the trade window's self-trade path uses the same hook whenever a wallet holds the source account (the direct-RPC path remains only for unlocked dev-chain accounts without a wallet); the old "coming soon" branch that marked the transfer complete without moving anything is gone. P2P settles as two verified wallet transfers, no escrow: `ready` stores each side's wallet address, the initiator sends first, `POST /confirm` accepts a side only after `lib/onchain-verify.ts` has matched its offered stacks against the transaction receipts (ERC-20 Transfer logs / native value, from my wallet to the partner's), and the responder's confirm is refused (409) until the initiator's leg is verified; the confirm phase shows a Settlement panel with both legs and links. Scam gating: `GET /api/wallets/evm/prices` now also returns each token's DEX reserve and 24 h volume, `GET /api/wallets/evm/security` proxies GoPlus token_security (15 min cache; PulseChain is not covered, so liquidity alone decides there), and `lib/token-risk.ts` turns both into `ok | caution | danger | unknown` with reasons (honeypot, taxes, pausable/blacklist/mint powers, liquidity under $1k = danger, under $10k = caution, no data = unknown). Only "ok" prices count toward totals; the inventory greys flagged stacks, shows a `!`/`?` badge, the footer says "· N unverified", and the detail panel / right-click let the user count a token anyway (`lib/trusted-tokens.ts`, localStorage, event-driven so no refetch). `stackUsd` returns null for `valueVerified === false`, so offers and totals everywhere respect the same verdict. Headless: Ganache CLI is in the npx cache (`npx --no-install ganache --port 7545 --chain.chainId 1337 --wallet.deterministic`); `wallet-mock-many.mjs` wallets take `sendMode: "forward"` to let an unlocked node sign, and `send-dialog-probe.mjs` / `internal-transfer-probe.mjs` verify real balance moves.

Liquidity (2026-09-28): the DEX tab has a Swap | Liquidity toggle; `LiquidityPanel` adds or removes liquidity on V2-style pools with `lib/dex/v2.ts` (Uniswap V2 on Ethereum, PulseX V2 and V1 on PulseChain, the Uniswap addresses again on chain 1337/31337 so a mainnet fork works as a local chain; router/factory/pair ABIs; pure quote, slippage floor, pool share and withdrawal maths, tested). Add/create: pick two tokens from the inventory or by contract address, the pool's ratio fills the other side, a missing pair becomes "create pool" (your amounts set the starting price), approvals only when the allowance is short, then `addLiquidity`/`addLiquidityETH` with slippage floors and a 20 min deadline; every call is `simulateContract`-ed before the wallet is asked and the steps render through `SendProgress`. Remove: LP tokens the inventory discovered (UNI-V2 / PLP symbols) or one loaded by address, underlying amounts + pool share, 25–100 %, approve LP then `removeLiquidity(ETH)` (native side unwrapped). Headless test: `npx --no-install ganache --port 7545 --chain.chainId 1337 --fork.url <mainnet rpc> --wallet.unlockedAccounts 0xd8dA…6045` gives a mainnet fork with real Uniswap; `scripts/_probe/liquidity-probe.mjs` adds ETH/DAI and removes it. Stopping a background `npx ganache` task does not kill the child node process: free the port with `netstat -ano | grep :7545` + `taskkill //PID <pid> //F`.

HEX stakes + Portfolio tabs (2026-09-28): two new hub modes in `contexts/trade-mode-context.tsx` ("hex", "portfolio"; the hub's mode maps in `app/dashboard/trading/page.tsx` must list every mode). `HexStakes` reads the HEX contract (`lib/hex.ts`: address, minimal ABI, day↔date, share estimate with the contract's LPB/BPB bonus formula, packed `dailyDataRange` decoding and the accrued-payout loop; tested) on Ethereum or PulseChain for the active wallet: summary, per-stake cards (status Active/Matured/Late/Ended/Pending, progress, T-shares, yield so far, dates), a new-stake form with a T-share preview, and End stake through the wallet with an inline second confirmation (early end warns about penalties). Other chains get a "switch to Ethereum or PulseChain" note; a wallet not connected in this browser is read-only. `PortfolioPanel` charts the value of live wallets (per chain:address) or the paper account over time from points the hub records in localStorage (`lib/portfolio-snapshots.ts`: one point per 30 min per account, forward-filled sum for "All", buckets → candles for `CandleChart` in area mode); OsrsInventory records a live point on every fresh, complete total, MarketTerminal records the paper account's total. Ranges count back from the latest recorded point (no clock read during render: the React compiler lint forbids `Date.now()` in render).

Terminal chart, Supercharts-style (2026-09-28): `CandleChart` has a price axis you can drag (stretch/squeeze around the centre) or scroll (around the price under the pointer); either freezes the scale as "manual" (an Auto button appears top-right; double-click the axis or Auto resets), a manual scale also pans vertically with the plot, and Lin/Log toggles a logarithmic axis (ticks per decade). Dragging the time axis zooms the bars anchored to the right edge. Indicators (`components/trading/chart/indicators.ts`, pure + tested, persisted in `veggat:chart-indicators`): SMA, EMA, Bollinger, VWAP, Supertrend as overlays; RSI, MACD, Stochastic, ATR, Awesome Oscillator, OBV as stacked panes below the plot with their own scales, levels and legends; the Indicators menu in the terminal header adds/removes them. Compare overlays a second market as a line on a percent basis from the first visible bar (drawn in the main price space, "vs SOL +2.5%" in the legend). Drawing tools gained extended line, vertical line and cross line. Time-axis labels never overlap now. Probe: `scripts/_probe/chart-probe.mjs` (press "Open the terminal" first: without a wallet the hub shows the CTA, not the tabs).

History, live vs paper (2026-09-28): the hub's History panel has a Live | Paper toggle (`veggat:history:view`). Live = `WalletHistory` (on-chain activity of every connected wallet, "All connected" or one wallet, on the active chain, from `GET /api/wallets/evm/history?chainId&address` which folds Blockscout `transactions` + `token-transfers` into one explorer-style event list via `lib/onchain-history.ts`; rows matching an app TradeRecord by hash carry its P2P / Transfer / DEX badge, Blockscout's `is_scam` tokens get a "flagged token" tag) followed by the app's own records of real-money modes (`/api/trades/history?mode=LIVE` = everything but PAPER). Paper = the paper account's records only, no mode filter, no on-chain section. The route caches 30 s per wallet; the component loads one wallet set per 15 s (wagmi republishes connections while it settles) and the refresh button forces it.

Prices on every chain + reconnect and sync fixes (2026-09-28): `GET /api/wallets/evm/prices?chainId&addresses` proxies GeckoTerminal's keyless `simple/networks/{net}/token_price` (network slugs and wrapped-native addresses in `lib/token-prices.ts`; 60 s per-address server cache; session + read rate limit; ≤30 addresses per upstream call) and `useTokenBalances` runs a third pass with it for every stack the indexer left unpriced, native coin included (priced through its wrapped token), remembering which addresses it already asked so unknown junk never re-triggers the call. That is what gives PulseChain (and any long-tail token) values. `ExtensionReconnect` no longer hands wagmi's `reconnect()` a partial connector set: that action replaces the whole connection set with what ONE call finds, so a second pass that found only the unauthorized Coinbase SDK connector wiped a live MetaMask connection (a timing race, which is why it showed up only sometimes as "No wallet connected" right after connecting); it now asks newcomers `isAuthorized()` first and reconnects them together with the live connectors, at 0 / 800 / 3000 ms. `NetworkSyncBridge` is one effect that knows which side moved: the app follows the wallet on first sight and whenever the wallet switches on its own, and only pushes the wallet when the user changes the network in the app (two effects used to switch a PulseChain wallet to Ethereum and back on every first connect, and looped forever before that). `generateLetterIcon` sanitises symbols (lone surrogates, control characters) before `encodeURIComponent`: an airdropped junk token on PulseChain threw `URIError` inside `TokenIcon` and took the whole trading page to the error boundary. Junk stacks format as `500.0T` / `1.2e59` instead of the full exponent form. The trade window's From/To wallet pickers are DropdownMenus (same tokens as the drawer pickers). The Active chip in the drawer explains itself on hover: an extension keeps the site connection while locked, reads work, and signing prompts the unlock. Inventory cell text uses `--stack-outline` / `--stack-text-shadow` (black outline in dark, pale halo in light) and every stack colour tier has a light pair. Headless: `scripts/_probe/wallet-mock-many.mjs` mocks several EIP-6963 wallets on one chain (`delay` per wallet); the probe user's read rate limit (100/min) is easy to exhaust with back-to-back probes, which shows up as 429 on the tokens/prices routes.

Trading hub, second pass (2026-09-28): the trade window's confirm step is a "Check the transfer/trade" card: From → To with wallet names and addresses, each stack with its USD value, and a network-fee estimate (`estimateGas` per item × `getGasPrice`, native + USD). Switching the active wallet while an offer is open clears the offer and says so (the items belonged to the previous wallet). HEX: yields are read with `dailyDataRange` in 365-day chunks capped at the contract's `dailyDataCount` (asking past it reverts "HEX: range invalid", which is why Ethereum showed "—"); stakes past their end day are `matured`/`late`, an ended-but-listed stake is `accounted` ("Payout locked in · end it to collect"), and a "Good accounting" button calls `stakeGoodAccounting` for matured stakes. Scam gating gained Honeypot.is (`GET /api/wallets/evm/honeypot`, chains 1/56/8453, 6 h cache, ≤8 fresh lookups per request; simulation failure or a critical flag = danger, so ETHG is flagged) and manual flags (`setTokenFlagged` in `lib/trusted-tokens.ts`, right-click "Flag as scam · don't count" / "Remove my scam flag", detail panel "Flagged by you"); thin liquidity ($1k–$10k) is a note, not a verdict (Hedron is legit). Portfolio is rebuilt from history instead of sampled: `lib/portfolio-history.ts` walks a wallet's balances back through its Blockscout events (`pages` query on the history route follows `next_page_params`) and prices each counted holding per day (`/api/market/candles` for listed markets, `GET /api/wallets/evm/price-history` = GeckoTerminal daily OHLCV otherwise), summed over "All" wallets; Paper replays the PaperTrade log against daily closes (`actions/paper-equity.ts`). `lib/portfolio-snapshots.ts` is gone. Chart tools are grouped like TradingView's toolbar (Cursor + Lines / Shapes & text / Fibonacci / Measure / Positions / Volume menus, `TOOL_GROUPS` in `drawings.ts`; the menus keep focus off the toolbar so the next click lands on the chart): horizontal ray, parallel channel (three clicks), text notes (inline editor; empty = deleted; double-click to edit), date & price range measure (Δ, %, bars, duration, volume), price range, date range, long/short positions (entry, target; the stop starts at half the distance and drags; R/R label) and anchored VWAP. A drawing that needs more points accumulates them in the draft; text editors open on pointer-up because the canvas' own mousedown focus would blur an editor opened on pointer-down. Probe: `scripts/_probe/chart-tools-probe.mjs`.

Settings, account pages and the listing shell (2026-09-28): `components/uicustom/settings/settings-primitives.tsx` is the one visual language for settings (`SectionHeader`, `SettingsGroup`, `SettingsCard`, `RowList` + `SettingsRow` (trailing box between rows), `ChoiceGrid` (option cards with the trailing box and an accent check), `Segmented` (sliding highlight), `StatusPill`, `StickyActions`, `EmptyState`, `RowsSkeleton`, `fieldClass`). `app/(protected)/settings/page.tsx` is now the shell only; each section lives in `components/uicustom/settings/sections/*` (profile, appearance, currency, wallet, ai-keys, addresses, notifications, privacy, reach-analytics). Account and Security share `AuthSettings`, keyed by the user id (no reset effect). The URL `section` param is followed as derived state, not an effect. Settings › Profile frames the banner and picture in place with the same `ImageFramer` as the public profile (Edit banner ▾ → Reframe current / Upload / Remove; camera on the picture; "Use this framing" uploads the baked webp; Save Changes persists banner/picture/bio together; the reach radar reads its colours from the CSS tokens). `FramerZoom` is a real slider (pointer capture, click-to-jump, keyboard, −/+): the native range under `appearance-none` was invisible and, on the profile page, the content block below the banner (its first child's negative margin collapses through it) sat over the pill; while framing, the banner gets `z-10` and the avatar `z-20`. The shared `Switch` has a visible unchecked track in dark mode now. `next-themes` only knows the theme on the client: Appearance picks nothing until `useClientReady()` is true (otherwise a hydration mismatch). My downloads, My orders, My sales, Nexus and Messages use `HoverChaser` (`data-chase` on each card/row; cards drop their own hover borders), `border-border/60` cards and `StatusPill` tones. `/products/create` is a one-screen shell: slim header (eyebrow, title, one-line note, Browse-only/Demo pill, owner tools menu, back link) and the form's right column scrolls inside itself with Back / Continue pinned; the drop zone is 16:10. Probes: `settings-probe.mjs` (12 sections × 2 themes × 2 widths, plus menu and unsaved-bar checks), `hydration-probe.mjs` (which section trips a mismatch), `pages-probe.mjs`, `create-probe.mjs`, `zoom-slider-probe.mjs`, `inventory-flag-probe.mjs`.

OAuth linking, business pages and the landing story (2026-09-28): "Link Google/GitHub/Discord" from Settings never attached the provider to the signed-in user: Auth.js resolves a provider callback by account, then by email (refused: dangerous linking is off), else registers a new user, so the click either errored or created a stranger. `callbacks.signIn` now reads this browser's session (`lib/oauth-account-link.ts`: chunk-aware cookie read + `decode` with the cookie name as salt), and when a session exists it creates the Account row for that user (`accountRowFromProvider` keeps only the Prisma columns), runs the shared profile/pending-confirmation effects (`lib/oauth-link-effects.ts`, also used by `events.linkAccount`) and returns a redirect to `/settings?section=verification&oauthConfirm=<provider>`; returning a URL from `signIn` aborts Auth.js' own login/register step, so the session is untouched. A provider identity that belongs to another user redirects with `oauthError=OAuthAccountLinkedElsewhere`; demo and preview sessions are refused. `WalletVerificationAction` is a `div`, not a `form` (it renders inside the listing funnel's form; nested forms broke hydration). `/jobs/post` reads companies from `/api/companies/public` (the bare `/api/companies` is admin-only, hence "Failed to fetch companies") and picks recipients with a searchable checkbox list. Web3 & Wallet is compact (switch in the header, connection and ownership side by side, guide as a one-line disclosure); Verification's tier card is smaller and the checklist is two columns on wide screens. Companies directory, storefront page, company hub and company settings, the job board and the request form use the trailing box, `border-border/60` cards and `StatusPill` tones; the legacy `nexus/company/[companyId]` clients were dead code (their pages redirect to `/companies/...`) and are deleted. Pulse: composer card, "New pulse" row with a character count, icon bar in a trailing box, `vegaEmeraldBtn` Pulse button, sidebar widgets with honest empty states and trailing-box tags/rows, `DiscoverPeople` rows likewise. Landing: hero copy names the five rooms; `BelowFoldSections` keeps the kinetic headings, sliding indicators and magnetic buttons and adds six feature doors, a promise strip, five chapters (market, feed, job board, terminal, AI room) with CSS/SVG visuals and per-chapter reveals (slide, scale, timeline, clip + pathLength, bubbles), a trust layer, four steps, an open-beta note and the CTA strip. Probe: `business-probe.mjs`.

Landing motion (2026-09-28, later): the page never sits still. `LiveTicker` is a CSS marquee (the `marquee` keyframe in globals.css; two copies of the row, `-50%` lands on the seam; pauses on hover; a wrapped list under reduced motion). `LandingDemoLoop` is a self-playing tour in a browser frame: a scripted cursor (spring-animated, click rings) works through four scenes (post a pulse with a poll, list a physical product, draw a trend line and fill a paper order, ask the AI in a room), each a small component driven by `useTimeline` (memoised `{at, run}` steps → timeouts; restarted per `cycle` key); it loops while in view (IntersectionObserver), pauses on mouse hover ("Paused while you look"), on a hidden tab and via the pause button, and under reduced motion shows finished scenes you switch by hand. Chapter visuals loop too (the market stack re-deals every 3.6 s, the heartbeat pulses, a crosshair sweeps the chart, the AI room shows typing dots, the job-board reply step pings) and the feature cards carry a cursor spotlight (CSS variables set on the node, no state). Marketplace copy says physical or digital. Recording: `scripts/_probe/landing-motion-probe.mjs` (ticker x over time, 44 frames of the demo, the paused pill, the market re-deal); never judge these from one still.

Trading hub naming + DEX routing (2026-09-27): the `paper` mode's tab is labelled **Terminal** (`contexts/trade-mode-context.tsx`; the id stays `paper` for persisted state) and the hub header says "Terminal · Live & paper"; the terminal itself defaults to Live when a wallet is connected. `DexSwapPanel` Settings has "Route via" (Best price, Uniswap, SushiSwap, Curve, Balancer, PancakeSwap): the choice is sent as `sources` to `/api/dex/quote`, which passes it as KyberSwap `includedSources` (`lib/dex/kyberswap.ts`). A CEX route does not exist (would need exchange API keys and a custody model); not planned in this pass.

Dashboard + orders (2026-09-27): the dashboard stat is **Open orders** (payment pending/confirming, or paid but not delivered) with the total as a hint; `/my-orders` rows sit in a `HoverChaser` (`as="ul"`), and `HoverChaser` re-fits the box with a ResizeObserver when the hovered item grows. Marketplace: no image zoom on hover (the chaser is the hover); the price group is From/To + slider + one line (`catalog-price-filter.tsx`), and `price-slider.tsx` uses accent tokens only. Light theme tokens (2026-09-27): canvas 96%, border 74%, surface-3 92%, stronger elevation shadows.

Profile pictures + banner (2026-09-27, in-place edit): `components/uicustom/image-framer.tsx` is the framing surface (drag, wheel/slider/keyboard zoom, canvas export) used inline on the profile (`fill`) and by the `ImagePositionAdjuster` dialog (Settings). On the profile, "Edit banner" and the avatar camera enter edit mode on the CURRENT image (fetched cross-origin and framed where it sits); the toolbar has Change (upload / remove banner / linked Google-GitHub-Discord picture), zoom, Cancel, Save; with nothing saved the chooser opens directly; GIFs skip framing.

Profile pictures + banner (2026-09-27): one account, many sign-in methods. `lib/identity-display.ts` is the single resolver (`resolveDisplayImage/Name`, `identityImageSources`) used by `auth.ts` (session/header) and `GET/PATCH /api/users/[userId]` (profile page), so both show the same picture. The users API returns the resolved `image`, and for the owner `imageSource` + `imageSources` (`manual/google/github/discord`); PATCH accepts `imageSource`, and uploading an `image` switches the source to MANUAL (removing it → AUTO). The session carries `lastAuthProvider` so AUTO resolves identically on both sides. Profile page: the avatar camera button is a menu (upload, reposition the current picture, "Show the picture from" Google/GitHub/Discord/Uploaded with the active one checked); "Edit banner" is a menu (upload, reposition current, remove). Every static image goes through `ImagePositionAdjuster` (zoom via slider/wheel, drag/arrow pan, canvas export) before it becomes an in-place preview with Reframe/Cancel/Save; GIFs skip it. The banner renders at a fixed 3:1 (`aspect-[3/1]`) so the framing is what shows at every width; export is 1500×500 / 512×512 webp. Reposition-current fetches the saved image (EdgeStore, Google, GitHub send `Access-Control-Allow-Origin: *`). Banner and bio already live on the user record, so they are shared across linked providers by construction. Banner-derived text tints use `tintText` (primaryLight on dark, primaryDark on light).

Landing reveals: BelowFoldSections uses framer `whileInView` with a real `initial` pose (rise + unblur); `initial={false}` silently disabled every reveal, never reintroduce it. Header account: the avatar image IS the button (no border), taller than the pill.

Verification harness (gitignored, `frontend/scripts/_probe/`): `probe-auth.mjs` exports `gateState()`, `authedState(browser)` (ONE cached demo session per day in `.demo-auth.json` — the demo login allows 5 sign-ins per connection per day, see `lib/demo-user.ts`; `db-demo-purge.mjs` deletes today's probe demo users from the QA DB when the allowance is spent) and `userAuthedState(browser)` (real password account created by `db-test-user.mjs`, needed for anything a demo user cannot do such as paper trading). Screenshot scripts: `chrome-shots.mjs`, `public-shots.mjs <routes>`, `interactions-authed.mjs`, `tip-probe.mjs`, `wallet-panel-shots.mjs`, `terminal-shots.mjs`, `terminal-interact.mjs`, `terminal-trade.mjs` → `scripts/_probe/chrome-shots/`. Run with `MSYS_NO_PATHCONV=1` from `frontend/`.

---

## Recent Feature: Seller Payment Setup (experimental)

Implemented 2025-06-19. Allows sellers (users and company owners) to configure PayPal receiving email + default crypto wallet for product sales.

### Key Files
| File | Purpose |
|------|---------|
| `frontend/actions/seller-payment.ts` | 6 server actions: save/verify/remove PayPal, set/remove default wallet, get status |
| `frontend/components/uicustom/settings/seller-payment-settings.tsx` | User settings → Payments section |
| `frontend/components/uicustom/settings/company-payment-settings.tsx` | Company settings → Payments section (owner only) |
| `frontend/app/(protected)/settings/verify-paypal/page.tsx` | PayPal email verification callback |
| `frontend/prisma/schema.prisma` | `PaypalVerificationToken` model (token-based email verification) |
| `frontend/lib/mail.ts` | `sendPaypalVerificationEmail()` added |
| `frontend/lib/rate-limit.ts` | `payment` tier: 8 req/60s |

### Security Measures
- `authAndRateLimit()` on every action (auth + rate limit combined)
- Timing-safe token comparison (`crypto.timingSafeEqual`)
- Email normalization (lowercase + trim)
- Zod validation with strict constraints (CUID regex, email max 254, token hex 64 chars)
- Company ownership assertion via `assertCompanyOwner()`
- Only verified wallets can be set as default receiving
- Generic error messages to prevent enumeration
- Structured audit logging via `createLogger('seller-payment')`
- Expired token cleanup (opportunistic + on verify)
- Token is 32 random bytes (256-bit entropy), 24h expiry, upsert pattern (1 active per entity)

### Schema Additions
- `PaypalVerificationToken` model: `id`, `email`, `token` (unique), `entityType`, `entityId`, `expires`, `createdAt`, `updatedAt`, `@@unique([entityType, entityId])`
- User/Company models: `paypalEmail`, `paypalEmailVerifiedAt`, `defaultReceivingWalletId` fields

### Checkout Integration (2026-02-27)
Seller payment settings are now wired into the checkout flow:

| Change | File |
|--------|------|
| `resolveCheckoutPayment()` server action | `frontend/actions/seller-payment.ts` — resolves seller wallet + PayPal per product in cart |
| Checkout uses seller wallet | `frontend/app/checkout/page.tsx` — `receiverAddress` prefers seller's EVM wallet over platform default |
| Seller PayPal routing | `frontend/app/api/payments/route.ts` + `frontend/lib/payments/providers.ts` — PayPal `payee.email_address` routes payment to seller |
| Fiat orders store receiver | `frontend/app/checkout/page.tsx` — fiat orders pass seller's PayPal email as `receiverAddress` in Payment record |
| Multi-seller handling | Platform escrow for multi-seller carts; direct payment for single-seller carts |
| Seller info badge | Checkout shows who the payment goes to (wallet address or PayPal email) |

**Resolution order** (per product): product `receiverWalletId` → company default → user default → platform fallback.

---

## Recent Feature: Unified Trading System (experimental)

Implemented 2026-02-28. Complete trade execution tracking across all 5 trading modes with Norwegian tax compliance.

### Trade Modes
| Mode | Color | Description |
|------|-------|-------------|
| P2P | emerald | Two-party trades via OsrsTradeWindow |
| SELF | purple | Self-transfers between own wallets |
| DEX | sky | DEX swaps via KyberSwap Aggregator |
| PAPER | amber | Simulated trades with virtual USD |
| LOCAL | orange | Local blockchain (Anvil/Ganache) trades |

### Key Files
| File | Purpose |
|------|---------|
| `frontend/lib/trade-record.ts` | Shared TradeRecord creation utility (`createTradeRecord`, `createP2PTradeRecords`) |
| `frontend/app/api/trades/history/route.ts` | GET — Paginated trade history with mode/status/date/token/tax-year filters |
| `frontend/app/api/trades/record/route.ts` | POST — Client-side trade recording (DEX/SELF/LOCAL modes) |
| `frontend/app/api/trades/tax-summary/route.ts` | GET — Server-side aggregated tax summary per year |
| `frontend/app/api/trades/[tradeId]/confirm/route.ts` | POST — P2P trade confirmation (now creates TradeRecords) |
| `frontend/actions/paper-trade.ts` | Paper buy/sell/swap (now creates TradeRecords) |
| `frontend/components/crypto-related/TradeHistory.tsx` | Full trade history panel with filters, CSV export, pagination |
| `frontend/components/crypto-related/PersonalTaxSummary.tsx` | Personal crypto tax widget (Skatteetaten-compatible) |
| `frontend/components/crypto-related/DexSwapPanel.tsx` | DEX swap panel (now logs TradeRecords on success) |
| `frontend/components/crypto-related/OsrsInventory.tsx` | Shift+click→trade transfer support |
| `frontend/components/crypto-related/OsrsTradeWindow.tsx` | `veggat:addToTrade` CustomEvent listener |
| `frontend/app/dashboard/trading/page.tsx` | Trading Hub: history toggle, always-visible trade panel |

### Paper terminal + market data (2026-09-27)
The Paper tab of the trading hub and `/dashboard/paper-trading` both render `components/trading/terminal/MarketTerminal.tsx`: market list (`MarketList`, a Sheet below lg), `components/trading/chart/CandleChart.tsx` (dependency-free canvas: candles/line/area, volume, crosshair + OHLC legend, wheel/pinch zoom, drag pan, drawing tools trend/ray/hline/rect/fib persisted per market in `localStorage` `veggat:chart-drawings:<SYMBOL>` in data space), `OrderTicket` (buy/sell · market/limit/stop · USD or units · leverage control shown but spot-only) and `TerminalPanels` (positions with Close, orders with Cancel, history). Guests see the live chart + sign-in card; the demo gets a disabled ticket; a signed-in user opens the portfolio in one click beside the chart (the old info → next → start flow is gone).
- Market data: `lib/market/symbols.ts` (29 markets, Binance pair + CoinGecko id), `lib/market/feed.ts` (server-only: Binance klines/24h tickers first, CoinGecko OHLC/markets fallback, short caches), routes `/api/market/candles?symbol&interval&limit` and `/api/market/ticker?symbols`, hooks `hooks/use-market-data.ts` (tail-merge polling per timeframe).
- Resting orders: `PaperOrder` model (+ enums, migration `20260927160000_paper_orders`), `actions/paper-orders.ts` (`placePaperOrder`, `cancelPaperOrder`, `listPaperOrders`, `settlePaperOrders`). There is no order book: `settlePaperOrders` runs on load and every 30s while the terminal is visible and fills crossed orders at market through `paperBuy`/`paperSell` (fees, daily limits and history unchanged). BUY orders store USD to spend, SELL orders store units.
- Layout rule: `/dashboard/trading` is exactly the viewport under the app header (`h-[calc(100dvh-var(--app-header-offset)-var(--demo-notice-height))]`, workspace section scrolls) so the terminal is `h-full` and never needs a page scroll; offer grids are capped at 400px so Internal Transfer fits one screen; each mode chip glows in its own colour (`MODE_GLOW`).
- Terminal modes: `MarketTerminal` has a Live | Paper switch (`veggat:terminal:tradeMode`; defaults to Live when a wallet is connected until the user chooses). Live puts the existing `DexSwapPanel` (real wallet, DEX aggregator on the current network) in the ticket column; Paper is the virtual account with orders/history panels. Local dev-chain accounts cannot route DEX swaps (the hub's Internal Transfer / Local Chain modes do those).
- Inventory reservations: `OsrsTradeWindow` dispatches `veggat:offerChanged` with its offer (chainId, address, rawAmount per item; `[]` on unmount); `OsrsInventory` subtracts those amounts when it rebuilds from balances, so a stack in the offer shows as 99 (not 100) even after the balance poll. The split dialog has "Split straight into the trade" while a window is open (dispatches `onAddToTrade` with the split amount), and a Split & Grab ghost can be clicked onto the trade grid directly: the inventory broadcasts `veggat:ghostActive`, the window lights up its own grid (`data-offer-grid="mine"`, "Click to place it here") and a capture-phase click there hands the ghost over.
- Notifications: `settlePaperOrders` writes a SYSTEM notification (metadata `{ kind: "paper-order" }` → `/dashboard/paper-trading`) on fill/failure, gated by `NotificationSettings.paperOrderEnabled` (Settings → Notifications → Trading). The bell polls every 30s (SWR); the terminal also toasts on its own 30s settle.
- Colour tokens `--chart-up` / `--chart-down` (Tailwind `text-chart-up`) are market semantics, not the accent. Swap actions are purple; buy accent-green; sell red.
- Local chains: `.env.local` has `NEXT_PUBLIC_ENABLE_LOCAL_CHAINS=true` (Ganache 127.0.0.1:7545 / chain 1337, Anvil 8545 / 31337). The wallet panel's Local Dev Chains auto-selects the chain that is online; an activated local account counts as a connected wallet on the trading hub (`walletReady`). User guide: `/help/local-chains` (public route). Inventory drag → offer grid uses the `lib/trade-drag-ack.ts` handshake so a missed drop never deletes the item.

### Schema Additions (in `frontend/prisma/schema.prisma`)
- `PaperOrder` model + `PaperOrderSide`/`PaperOrderType`/`PaperOrderStatus` enums — resting limit/stop paper orders (2026-09-27)
- `TradeRecord` model — unified execution log with sell/buy token pairs, USD/NOK pricing, tax fields
- `TradeMode` enum — P2P, SELF, DEX, PAPER, LOCAL
- `TradeRecordStatus` enum — PENDING, COMPLETED, FAILED, REVERTED
- `CostBasisMethod` enum — FIFO, AVERAGE
- `User.taxHelperEnabled`, `User.taxCostBasisMethod` fields

### Trade Recording Architecture
- **P2P**: Server-side, fire-and-forget after both parties confirm (in confirm route)
- **Paper**: Server-side, fire-and-forget after each `$transaction` (in server actions)
- **DEX**: Client-side, `useEffect` in DexSwapPanel fires POST to `/api/trades/record` on success
- **SELF**: Client-side, `useEffect` in SidebarWalletPanel fires POST to `/api/trades/record` on transfer success
- **LOCAL**: Client-side, inline POST in SidebarWalletPanel after LOCAL_RPC transfer receipt
- All records include NOK values via `getExchangeRates()` (ECB data via Frankfurter API)

### Norwegian Tax Compliance
- 22% capital gains rate (Skatteetaten)
- FIFO/AVERAGE cost basis method selection (saved to User record)
- Per-trade `gainLossUsd`/`gainLossNok` and `costBasisUsd`/`costBasisNok` tracking
- Tax year grouping with `taxYear` field + `taxExported` flag
- CSV export for Skatteetaten RF-1159 filing
- Server-side tax summary aggregation endpoint

### Cart & Product Enhancements (2026-02-27)

| Change | File |
|--------|------|
| Cart API: product fields | `frontend/app/api/cart/[userId]/route.ts` + `frontend/lib/types/carts.ts` + `frontend/contexts/cart-context.tsx` — `toCartDto` now includes `productType`, `shipFromPostalId`, `freeShippingEnabled`, `freeShippingThreshold` |
| My Sales: payment routing | `frontend/app/api/seller/orders/route.ts` + `frontend/app/(protected)/my-sales/page.tsx` — expanded Payment select to include all crypto + fiat routing fields; rich payment UI with status badge, crypto details, fiat recipient |
| Product page: accepted methods | `frontend/app/products/[...id]/ProductClient.tsx` — "Accepts:" badges showing crypto chains (from `acceptedTokens`) + fiat methods (PayPal, Vipps, Klarna) |

---

## AI chat notes (2026-09-27)
- Lazy renderers (`next/dynamic` with `ssr: true`) get NO Suspense boundary unless you pass `loading`. `MessageContent` without one made the first streamed reply suspend up to `app/ai/loading.tsx`, which unmounted the page for a frame and aborted the request ("The response was stopped"). Always pass `{ loading: () => … }` to `dynamic()` for anything rendered mid-stream.
- Image generation from chat: `lib/ai-chat/image-intent.ts` (`detectImageIntent`: generation verb + image noun, or `/image …`) routes the message to `POST /api/ai-media` (same credits/job pipeline as Studio), polls the workspace until the job completes, saves the pair through the normal messages route with a markdown image, and `MessageContent` renders only `/api/ai-media/<id>/content` inline (remote images stay links). One model per format today (`MEDIA_MODELS`); Studio shows it in a disabled selector.

## E2E Testing Infrastructure (2025-07-24)

Playwright-based E2E testing following a **5-Layer Pyramid** architecture. All app tests live in ONE consolidated file (`suite.spec.ts`) plus a meta-test (`master.spec.ts`) that validates the test infrastructure itself.

### Architecture: Layered Pyramid + Meta-Test

```
e2e/
├── gate-bypass.ts   ← Infrastructure: bypass site access gate
├── auth.setup.ts    ← Infrastructure: log in and save session
├── helpers.ts       ← Single source of truth: route arrays, timeouts, utilities
├── suite.spec.ts    ← ALL app tests (5 layers, ~97 tests)
└── master.spec.ts   ← Meta-test: validates test infra (route sync, file integrity, coverage)
```

**Why ONE file?** Tests that scatter across 10 files rot. One pyramid means:
- Failures cascade UP (if health is down, skip everything above)
- New routes added to `helpers.ts` auto-expand tests via data-driven loops
- No duplicate coverage, no forgotten test files

### The 5 Layers

| Layer | Purpose | Examples |
|-------|---------|---------|
| **1 — Alive** (serial) | Is the system responding? | health endpoint, version, homepage |
| **2 — Routing** | Do gates work? | Public pages → 200, protected → redirect, APIs → 401/403 |
| **3 — Content** | Do pages render real content? | Login form inputs, register heading, legal pages |
| **4 — Flows** | Can users complete journeys? | Login→reset nav, register→login, /feed→/pulse |
| **5 — Data** | Are API shapes correct? | Products array, categories, pagination, SEO |

### The Master Meta-Test (5 Metas)

| Meta | Validates |
|------|-----------|
| **1 — Route Sync** | `helpers.ts` arrays match `routes.ts` source |
| **2 — File Integrity** | All 5 required test files exist |
| **3 — Coverage** | `suite.spec.ts` loops over all route arrays |
| **4 — Config** | `playwright.config.ts` has correct projects |
| **5 — Self-Check** | `master.spec.ts` itself is consistent |

### Running Tests

```bash
npm run test:e2e          # headless run
npm run test:e2e:ui       # interactive UI mode
npm run test:e2e:headed   # headed browser
npm run test:e2e:debug    # step-through debugger
```

### Playwright Project Structure

| Project | Purpose | Dependencies | Runs |
|---------|---------|-------------|------|
| `gate` | Bypass site access gate | — | `gate-bypass.ts` |
| `setup` | Log in (NextAuth credentials) | gate | `auth.setup.ts` |
| `no-auth` | All tests without login | gate | `suite.spec.ts` + `master.spec.ts` |
| `authed` | Tests with auth session (conditional) | setup | `suite.spec.ts` (only when E2E creds set) |

### Key Patterns & Anti-Patterns

**NEVER DO:**
- `networkidle` — never settles with SSE/WebSocket/streaming pages
- `innerText.length` assertions — fragile, locale-dependent
- `page.goto(url)` without `waitUntil: "domcontentloaded"` — hangs on first compile
- Scatter tests into 10+ files — leads to rot and duplicate coverage
- Test CSS classes or internal React state — tests USER BEHAVIOR

**ALWAYS DO:**
- Use `visitPage(page, path)` from helpers.ts — handles hydration automatically
- Use `domcontentloaded` + `waitForHydration()` for page loads
- Set `test.setTimeout(PAGE_TIMEOUT)` on browser tests (dev-mode first-compile is slow)
- Add routes to `helpers.ts` arrays — tests auto-expand
- Use API-level checks for speed; browser checks only for UX

### Learnings (hard-won)

- Products API returns **raw array** (NOT `{ products: [...] }`)
- Health API uses `dbLatencyMs` (not `latencyMs`)
- Auth pages may render empty shells — use soft assertions
- `/feed` redirects to `/pulse` (public alias, NOT protected)
- `shadcn FormControl` wraps inputs — use `getByPlaceholder()` not `getByLabel()`
- Dev server first-compile can take 30-60s per page; use 1 worker locally
- The `authed` project is conditionally excluded when no E2E creds are set

### Environment Variables for Auth Tests

- `E2E_TEST_EMAIL` — test account email (set in `.env.local`)
- `E2E_TEST_PASSWORD` — test account password
- `GATE_PASSWORD` — site access gate password (defaults to local value)
- Without credentials: authenticated tests skip (3 tests), `authed` project excluded

### Gate Handling

The site is in private testing mode (`SITE_MODE=private`). All routes redirect to `/gate`.
- For Playwright's own webServer: `GATE_STATUS=false` in config disables the gate
- For reusing local dev server: `gate-bypass.ts` setup project POSTs the password
- The gate cookie (`veggastare_access`) is shared via storageState to all dependent projects

---

## Environment Routing

| Branch / Env | Vercel Env | Database | Pusher Prefix |
|-------------|-----------|----------|---------------|
| `main` (production) | production | `DATABASE_URL_MAINLIVE` | *(none)* |
| `dev` / PRs (preview) | preview | `DATABASE_URL_MAINPREVIEW` | `preview__` |
| Local dev | development | `DATABASE_URL` (.env.local) | `dev__` |

---

## Documentation Maintenance

After completing any non-trivial change, check and update project docs if affected:

| File | Update when… |
|------|-------------|
| `agent.md` | Feature status changes, new tech, roadmap updates, new conventions |
| `docs/architecture.md` | Service boundaries change, new data flows, deployment changes |
| `docs/production-scoreboard.md` | Verified feature status, release evidence and remaining blockers |
| `README.md` | Setup steps change, new tooling |
| `HANDOFF.md` | Anything that affects the next engineer's setup or workflow |
