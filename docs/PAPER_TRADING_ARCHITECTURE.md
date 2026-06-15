# Paper Trading & DEX Integration Architecture

> **Last Updated:** 2025-07-21
> **Status:** RFC (Request for Comments) — awaiting owner approval before implementation
> **Author:** Copilot + v3gga

---

## Executive Summary

Build a **production-grade paper trading system** that lets users practice buying, selling, swapping, and P2P trading crypto with **virtual funds in a live market environment** — zero financial risk. Then layer on **DEX swap integration** (both real and simulated) to make VeggaStare a one-stop crypto trading platform.

---

## Table of Contents

1. [Current State Audit](#1-current-state-audit)
2. [Architecture Vision](#2-architecture-vision)
3. [Phase 1 — DB-Simulated Paper Trading](#3-phase-1--db-simulated-paper-trading)
4. [Phase 2 — On-Chain Paper Trading (Tenderly / Anvil)](#4-phase-2--on-chain-paper-trading-tenderly--anvil)
5. [Phase 3 — DEX / Swap Integration](#5-phase-3--dex--swap-integration)
6. [Schema Changes](#6-schema-changes)
7. [Deployment Options Matrix](#7-deployment-options-matrix)
8. [Mock Token Seeding](#8-mock-token-seeding)
9. [Gap Fixes for Existing Infrastructure](#9-gap-fixes-for-existing-infrastructure)
10. [Security & Abuse Prevention](#10-security--abuse-prevention)
11. [Monetisation Hooks](#11-monetisation-hooks)
12. [Implementation Roadmap](#12-implementation-roadmap)

---

## 1. Current State Audit

### What exists today

| Component | Location | Status |
|-----------|----------|--------|
| **Ganache local chains** | `.vscode/tasks.json` — `local-rpc:31337` (port 8545), `local-rpc:1337` (port 7545) | ✅ Working (dev-only) |
| **AppKit chain registration** | `AppKitInit.tsx` — `anvilLocal` + `ganacheLocal` wagmi chains | ✅ Working |
| **LocalDevTools panel** | `SidebarWalletPanel.tsx` lines 888-1310 — mine, snapshot, revert, set-balance, send-from-account | ✅ Working |
| **Self-trade window** | `OsrsTradeWindow.tsx` — OSRS-style dual 4×4 grid, self-trade mode | ✅ Native ETH only |
| **Trade API** | `api/trades/` — 5 routes (create, list, get, ready, confirm, cancel) | ✅ Working |
| **Trade DB model** | `Trade` + `TradeItem` + `TradeStatus` enum | ✅ No paper/env flag |
| **Token balances hook** | `use-token-balances.ts` — polls every 12s, LOCAL_RPC override | ✅ Working |
| **Active wallet context** | `active-wallet-context.tsx` — localStorage override for LOCAL_RPC wallets | ✅ Working |
| **Visibility gate** | `NEXT_PUBLIC_ENABLE_LOCAL_CHAINS` / `NEXT_PUBLIC_TEST_MODE` / dev mode | ✅ Working |

### What's missing

| Gap | Impact | Priority |
|-----|--------|----------|
| **No paper/testnet flag** on Trade model | Can't separate paper trades from real ones | 🔴 Critical |
| **No ERC-20 support** in self-trade (TODO in OsrsTradeWindow) | Only native ETH transfers work | 🔴 Critical |
| **Empty KNOWN_TOKENS** for local chains | No ERC-20 inventory on 31337/1337 | 🟡 High |
| **No mock token deployment** script | Users have no tokens to trade | 🟡 High |
| **No DEX/swap integration** | No Uniswap, no aggregator, no swap UI | 🟡 High |
| **Ganache not in package.json** | Relies on `npx ganache` — fragile, slow cold-start | 🟠 Medium |
| **No Anvil installed** | Tasks named "anvil" but run Ganache, confusing | 🟠 Medium |
| **Env vars not in .env.example** | `NEXT_PUBLIC_ANVIL_RPC_URL`, `NEXT_PUBLIC_GANACHE_RPC_URL` undocumented | 🟠 Medium |
| **Self-trade "coming soon" on real chains** | P2P trade only works locally, not on mainnet | 🟡 Future |
| **No paper wallet portfolio tracking** | No leaderboard, no P&L, no trade history analysis | 🟡 Future |

---

## 2. Architecture Vision

```
┌─────────────────────────────────────────────────────────────┐
│                    VeggaStare Trading                       │
├─────────┬────────────┬──────────────┬───────────────────────┤
│  Paper  │  Testnet   │   Mainnet    │   DEX Swaps           │
│  Mode   │  Mode      │   Mode       │   (Aggregated)        │
├─────────┴────────────┴──────────────┴───────────────────────┤
│                  Trade Engine (shared)                       │
│  • OsrsTradeWindow (P2P)                                    │
│  • SwapPanel (DEX — new)                                    │
│  • Portfolio Tracker (new)                                  │
├─────────────────────────────────────────────────────────────┤
│               Environment Router                            │
│  Paper → DB-sim + price feeds     (Phase 1)                 │
│  Paper → Tenderly fork            (Phase 2)                 │
│  Testnet → Sepolia / Base Sepolia (existing)                │
│  Mainnet → Ethereum / Base / etc  (existing)                │
├─────────────────────────────────────────────────────────────┤
│               Data Layer                                    │
│  Prisma: Trade, TradeItem, PaperPortfolio, PaperPosition    │
│  Price Feed: CoinGecko / 0x API                             │
│  On-chain: wagmi + viem + AppKit                            │
└─────────────────────────────────────────────────────────────┘
```

### Three trading environments

| Environment | Chain | Settlement | Cost | Users See |
|-------------|-------|-----------|------|-----------|
| **PAPER** | None (DB-simulated) or Tenderly fork | Instant DB update | Free | "📝 Paper Trade" badge |
| **TESTNET** | Sepolia, Base Sepolia | Real testnet tx | Free (faucet ETH) | "🧪 Testnet" badge |
| **MAINNET** | Ethereum, Base, Polygon, etc. | Real mainnet tx | Gas fees | No badge (default) |

---

## 3. Phase 1 — DB-Simulated Paper Trading

**Goal:** Production users on veggat.com can paper trade immediately with zero blockchain infrastructure.

### How it works

1. **User activates paper mode** → toggle in wallet sidebar or settings
2. **System creates a `PaperPortfolio`** with starting virtual balance (e.g. $100,000 in paper USD)
3. **User "buys" tokens** → backend records the purchase at the *real current market price* (via CoinGecko/0x API), deducting paper USD and crediting paper tokens
4. **User "sells" tokens** → reverse; paper tokens deducted, paper USD credited at current market price
5. **P2P paper trades** → use existing OsrsTradeWindow, but items come from `PaperPosition` instead of on-chain balances
6. **Portfolio P&L** → calculated from entry price vs current price in real-time

### Why DB-first?

- **No infra cost** — runs on existing Vercel + Neon DB
- **Instant** — no block confirmation wait
- **Serverless-friendly** — no persistent blockchain node needed
- **Production-ready** — works for all users immediately
- **Real prices** — uses live market data, so paper P&L is realistic

### Key components

```
PaperPortfolio (1 per user)
  ├── startingBalance: $100,000
  ├── cashBalance: $87,500  (paper USD remaining)
  └── PaperPositions[]
       ├── ETH:  2.5 @ avg $1,850  (entry value: $4,625)
       ├── USDC: 5,000 @ $1.00
       └── UNI:  100 @ $7.50

PaperTrade (history)
  ├── BUY  2.5 ETH @ $1,850  ($4,625 paper USD spent)
  ├── BUY  100 UNI @ $7.50   ($750 paper USD spent)
  └── SELL 0.5 ETH @ $1,900  ($950 paper USD received)
```

### Price feed strategy

| Source | Use Case | Cost | Rate Limit |
|--------|----------|------|------------|
| **CoinGecko Free API** | Paper buy/sell price quotes | Free | 10-30 calls/min |
| **0x Swap API (quotes only)** | DEX-accurate pricing with slippage | Free quotes | 100/min on free tier |
| **Chainlink on Tenderly** (Phase 2) | On-chain oracle prices in fork | Free with Tenderly | Unlimited |

### Paper trading rules

- Starting balance: **$100,000** (configurable per user)
- Supports: major tokens across any chain (ETH, USDC, USDT, DAI, WBTC, LINK, UNI, HEX, PLS, etc.)
- Order types (v1): **Market only** (instant fill at current price)
- Order types (v2): Market + **Limit orders** (fill when price hits target)
- Fees: Simulated **0.3%** swap fee (mimics Uniswap V3) — can be toggled off
- Resets: Users can reset their paper portfolio to start fresh
- Leaderboard: Top paper traders by % return (optional social feature)

---

## 4. Phase 2 — On-Chain Paper Trading (Tenderly / Anvil)

**Goal:** For power users who want realistic on-chain execution (gas estimation, contract interaction, actual tx simulation).

### Option A: Tenderly Virtual TestNets (Recommended for production)

[Tenderly Virtual TestNets](https://docs.tenderly.co/virtual-testnets) let you fork any mainnet and get a private RPC endpoint.

**Pros:**
- ✅ Free tier: 5 virtual networks, 50 RPC calls/sec
- ✅ Forks mainnet state → all Uniswap/Aave/etc. contracts already deployed
- ✅ Hosted — no infra to manage
- ✅ Built-in faucet, time travel, state override
- ✅ Each user can get their own fork (isolated)
- ✅ Chainlink oracles work (live mainnet data)

**Cons:**
- ❌ Free tier limited (may need paid plan for scale)
- ❌ API key management per-tenant
- ❌ Forks are ephemeral (state resets possible)

**Integration pattern:**
```typescript
// Server action: create a paper chain for a user
async function createPaperChain(userId: string) {
  const res = await fetch("https://api.tenderly.co/api/v1/account/{account}/project/{project}/vnets", {
    method: "POST",
    headers: { "X-Access-Key": process.env.TENDERLY_API_KEY },
    body: JSON.stringify({
      slug: `paper-${userId}`,
      display_name: `Paper Trading - ${userId}`,
      fork_config: {
        network_id: 1, // Fork Ethereum mainnet
      },
      virtual_network_config: {
        chain_config: { chain_id: 73571 }, // Custom chain ID for paper
      },
    }),
  });
  const vnet = await res.json();
  // Returns RPC URL that user's wallet can connect to
  return vnet.rpcs[0].url;
}
```

### Option B: Railway-hosted Anvil (Self-hosted, full control)

Run Anvil (Foundry) on Railway as a persistent service that forks mainnet.

```bash
# Railway Dockerfile
FROM ghcr.io/foundry-rs/foundry:latest
ENTRYPOINT ["anvil", \
  "--fork-url", "https://eth-mainnet.g.alchemy.com/v2/$ALCHEMY_KEY", \
  "--host", "0.0.0.0", \
  "--port", "8545", \
  "--chain-id", "73571", \
  "--accounts", "0", \
  "--block-time", "2"]
```

**Pros:**
- ✅ Full control, no vendor limits
- ✅ Anvil is fast (Rust-based)
- ✅ Can pre-deploy custom contracts

**Cons:**
- ❌ ~$5-10/mo on Railway
- ❌ Single instance = shared state (not per-user isolated unless you run multiple)
- ❌ Need to manage Alchemy/Infura for fork source

### Option C: Hybrid (Recommended)

- **Phase 1:** DB-simulated (immediate, free)
- **Phase 2a:** Tenderly Virtual TestNets for users who want on-chain execution
- **Phase 2b:** Railway Anvil for the owner's dev/staging environment
- **Phase 3:** Let users choose their environment

---

## 5. Phase 3 — DEX / Swap Integration

### Swap Aggregator: 0x API (powers Matcha.xyz)

The **0x Swap API** is the best free aggregator. It aggregates across Uniswap, SushiSwap, Curve, Balancer, PancakeSwap, and 100+ DEX sources.

| Feature | 0x API | Uniswap SDK | 1inch API |
|---------|--------|-------------|-----------|
| **Aggregation** | 100+ sources | Uniswap only | 300+ sources |
| **Free tier** | Free quotes, pay per swap tx | Free (SDK) | Free quotes |
| **Chains** | ETH, Base, Polygon, Arbitrum, Optimism, BSC, Avalanche | ETH, Base, Polygon, Arbitrum, Optimism | Same as 0x |
| **Gasless swaps** | ✅ (Tx Relay) | ❌ | ✅ (Fusion) |
| **Limit orders** | ✅ | ❌ | ✅ |
| **Paper mode** | Quote-only (no tx) | Simulate with Tenderly | Quote-only |
| **Complexity** | REST API — simple | SDK — complex | REST API — simple |
| **Best for** | Production swaps | Deep pool analytics | Maximum liquidity |

**Recommendation: 0x API** — simple REST calls, free quotes, supports gasless swaps, powers Matcha.xyz which the user already mentioned.

### Integration Architecture

```
User clicks "Swap" in Trade Window
  │
  ├── Paper Mode?
  │   ├── YES → GET /swap/v1/price (quote only)
  │   │         Record in PaperTrade table at quoted price
  │   │         Update PaperPosition balances
  │   │
  │   └── NO → GET /swap/v1/quote (full tx data)
  │             User signs tx in wallet
  │             POST tx to chain
  │             Record in Trade table
  │
  └── Display: token pair, rate, slippage, gas estimate, route breakdown
```

### Swap UI Component (new: `SwapPanel.tsx`)

Lives alongside the existing OsrsTradeWindow as a new tab/mode:

```
┌─────────────────────────────┐
│  Swap                 Paper │  ← environment badge
├─────────────────────────────┤
│  You Pay                    │
│  ┌────────────────────────┐ │
│  │ 1.5        ETH    ▼   │ │
│  │ ≈ $2,775.00           │ │
│  └────────────────────────┘ │
│           ↕ (swap direction)│
│  You Receive                │
│  ┌────────────────────────┐ │
│  │ 2,768.42   USDC   ▼   │ │
│  │ Rate: 1 ETH = 1845.61 │ │
│  └────────────────────────┘ │
│                             │
│  Slippage: 0.5%  |  Route  │
│  Via: Uniswap V3 (67%)     │
│       Curve (33%)           │
│                             │
│  Gas: ~0.003 ETH ($5.54)   │
│                             │
│  [ Swap ]                   │
└─────────────────────────────┘
```

### API integration code (0x)

```typescript
// lib/dex/zero-x.ts
const ZX_BASE = "https://api.0x.org";

export async function getSwapQuote(params: {
  sellToken: string;    // "ETH" or contract address
  buyToken: string;     // "USDC" or contract address
  sellAmount: string;   // in wei
  chainId: number;
  takerAddress?: string;
}) {
  const url = new URL(`${ZX_BASE}/swap/v1/quote`);
  url.searchParams.set("sellToken", params.sellToken);
  url.searchParams.set("buyToken", params.buyToken);
  url.searchParams.set("sellAmount", params.sellAmount);
  if (params.takerAddress) url.searchParams.set("takerAddress", params.takerAddress);

  const res = await fetch(url.toString(), {
    headers: { "0x-api-key": process.env.ZERO_X_API_KEY ?? "" },
  });
  return res.json() as Promise<ZeroXQuoteResponse>;
}

export async function getSwapPrice(params: {
  sellToken: string;
  buyToken: string;
  sellAmount: string;
  chainId: number;
}) {
  const url = new URL(`${ZX_BASE}/swap/v1/price`);
  url.searchParams.set("sellToken", params.sellToken);
  url.searchParams.set("buyToken", params.buyToken);
  url.searchParams.set("sellAmount", params.sellAmount);

  const res = await fetch(url.toString(), {
    headers: { "0x-api-key": process.env.ZERO_X_API_KEY ?? "" },
  });
  return res.json() as Promise<ZeroXPriceResponse>;
}
```

---

## 6. Schema Changes

### New enums

```prisma
enum TradeEnvironment {
  MAINNET     // Real chain, real money
  TESTNET     // Sepolia etc., faucet tokens
  PAPER       // Simulated — no chain interaction
}
```

### Modified models

```prisma
model Trade {
  // ... existing fields ...
  environment    TradeEnvironment @default(MAINNET)  // ← NEW
  // ... rest unchanged ...
}
```

### New models

```prisma
/// Virtual portfolio for paper trading (one per user)
model PaperPortfolio {
  id              String           @id @default(cuid())
  userId          String           @unique
  startingBalance Float            @default(100000) // $100k starting paper USD
  cashBalance     Float            @default(100000) // remaining paper USD
  resetCount      Int              @default(0)
  lastResetAt     DateTime?
  createdAt       DateTime         @default(now())
  updatedAt       DateTime         @updatedAt

  User            User             @relation(fields: [userId], references: [id], onDelete: Cascade)
  Positions       PaperPosition[]
  Trades          PaperTrade[]

  @@index([userId])
}

/// Individual token position in a paper portfolio
model PaperPosition {
  id              String          @id @default(cuid())
  portfolioId     String
  tokenSymbol     String          // "ETH", "USDC", etc.
  tokenAddress    String          // contract address or "0x0" for native
  chainId         Int             // which chain this token "lives on"
  decimals        Int             @default(18)
  amount          String          // BigInt string (raw units)
  displayAmount   String          // human-readable
  avgEntryPrice   Float           // USD price when bought (weighted avg)
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt

  Portfolio       PaperPortfolio  @relation(fields: [portfolioId], references: [id], onDelete: Cascade)

  @@unique([portfolioId, tokenSymbol, chainId])
  @@index([portfolioId])
}

/// Record of a paper trade execution
model PaperTrade {
  id              String          @id @default(cuid())
  portfolioId     String
  type            PaperTradeType  // BUY, SELL, SWAP, P2P_SEND, P2P_RECEIVE
  // Sell side
  sellToken       String?         // token sold (or "USD" for paper cash)
  sellAmount      String?
  sellPrice       Float?          // USD price at execution
  // Buy side
  buyToken        String?         // token bought (or "USD" for paper cash)
  buyAmount       String?
  buyPrice        Float?          // USD price at execution
  // Metadata
  chainId         Int?
  fee             Float?          // simulated trading fee in USD
  priceSource     String?         // "coingecko" | "0x" | "manual"
  metadata        Json?
  executedAt      DateTime        @default(now())

  Portfolio       PaperPortfolio  @relation(fields: [portfolioId], references: [id], onDelete: Cascade)

  @@index([portfolioId, executedAt])
}

enum PaperTradeType {
  BUY
  SELL
  SWAP
  P2P_SEND
  P2P_RECEIVE
  FAUCET      // initial token grant
}
```

### User model addition

```prisma
model User {
  // ... existing fields ...
  PaperPortfolio    PaperPortfolio?    // ← NEW relation
}
```

---

## 7. Deployment Options Matrix

| Option | Cost | Setup | Per-User Isolation | Mainnet Fork | Best For |
|--------|------|-------|--------------------|--------------|----------|
| **DB-Simulated** (Phase 1) | $0 | None | ✅ (DB rows) | ❌ | MVP paper trading |
| **Tenderly Virtual TestNets** | Free tier: 5 vnets | API key + SDK | ✅ (per-vnet) | ✅ | Production on-chain paper |
| **Railway Anvil** | ~$5-10/mo | Dockerfile | ❌ (shared) | ✅ (--fork-url) | Dev/staging |
| **Local Ganache** (existing) | $0 | VS Code task | N/A | ❌ | Local development |
| **Local Anvil** | $0 | `foundryup` install | N/A | ✅ (--fork-url) | Local dev with fork |
| **Alchemy Forked RPC** | Free tier: 300M CU/mo | API key | ✅ | ✅ | Alternative to Tenderly |

**Recommended path:**
1. **Now:** DB-Simulated (Phase 1) — works on Vercel, zero infra
2. **Later:** Tenderly for power users who want real tx simulation
3. **Dev:** Keep local Ganache + install Anvil for local testing

---

## 8. Mock Token Seeding

For local development and Tenderly forks, deploy mock ERC-20 tokens:

```solidity
// contracts/MockERC20.sol
// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockERC20 is ERC20 {
    uint8 private _decimals;

    constructor(string memory name, string memory symbol, uint8 dec)
        ERC20(name, symbol) {
        _decimals = dec;
    }

    function decimals() public view override returns (uint8) {
        return _decimals;
    }

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}
```

**Deployment script** (Hardhat or Foundry):

| Token | Symbol | Decimals | Mint Amount |
|-------|--------|----------|-------------|
| Mock USDC | USDC | 6 | 1,000,000 |
| Mock USDT | USDT | 6 | 1,000,000 |
| Mock DAI | DAI | 18 | 1,000,000 |
| Mock WBTC | WBTC | 8 | 100 |
| Mock LINK | LINK | 18 | 50,000 |
| Mock UNI | UNI | 18 | 50,000 |

After deployment, update `KNOWN_TOKENS[31337]` and `KNOWN_TOKENS[1337]` in `use-token-balances.ts` with the deployed contract addresses.

---

## 9. Gap Fixes for Existing Infrastructure

These can be fixed independently of the paper trading feature:

### 9.1 Add missing env vars to .env.example

```env
# Local blockchain (development only)
NEXT_PUBLIC_ENABLE_LOCAL_CHAINS=true
NEXT_PUBLIC_ANVIL_RPC_URL=http://127.0.0.1:8545
NEXT_PUBLIC_GANACHE_RPC_URL=http://127.0.0.1:7545

# Paper trading price feeds
COINGECKO_API_KEY=           # optional — improves rate limits
ZERO_X_API_KEY=              # required for DEX swaps

# Tenderly (Phase 2 — on-chain paper trading)
TENDERLY_API_KEY=
TENDERLY_ACCOUNT=
TENDERLY_PROJECT=
```

### 9.2 Install Foundry/Anvil (optional, better local dev)

```powershell
# Install Foundry (includes Anvil, Forge, Cast)
curl -L https://foundry.paradigm.xyz | bash
foundryup
```

Then update `.vscode/tasks.json` to use real Anvil for the 31337 task:
```json
{
  "label": "local-rpc:31337",
  "type": "shell",
  "command": "anvil --host 127.0.0.1 --port 8545 --chain-id 31337 --accounts 10 --balance 10000",
  "isBackground": true
}
```

### 9.3 Add ganache as devDependency (reliability)

```bash
cd frontend && npm install -D ganache
```

### 9.4 ERC-20 transfer support in OsrsTradeWindow

Currently only native ETH. Need to add `erc20_transfer` using wagmi's `writeContract`:

```typescript
// In OsrsTradeWindow.tsx — replace the native-only transfer
import { encodeFunctionData } from "viem";

const ERC20_TRANSFER_ABI = [
  {
    name: "transfer",
    type: "function",
    inputs: [
      { name: "to", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

async function transferERC20(rpcUrl: string, from: string, to: string, token: string, amount: bigint) {
  const data = encodeFunctionData({
    abi: ERC20_TRANSFER_ABI,
    functionName: "transfer",
    args: [to as `0x${string}`, amount],
  });

  return rpcCall<string>(rpcUrl, "eth_sendTransaction", [{
    from,
    to: token,
    data,
  }]);
}
```

### 9.5 Rename confusing tasks

The task `local-rpc:31337` says "Anvil" but runs Ganache. Either:
- Install Anvil and use it for 31337 (recommended)
- Or rename the task label to be honest about running Ganache

---

## 10. Security & Abuse Prevention

| Threat | Mitigation |
|--------|-----------|
| Paper trading spam (fake leaderboard) | Rate limit paper trades (100/day). Require verified account. |
| Price manipulation via stale quotes | Always fetch fresh price from CoinGecko/0x at execution time. Short TTL on cached prices (30s). |
| Portfolio reset abuse | Rate limit resets (1/week). Track reset count. |
| Tenderly RPC abuse | One vnet per user. API key in server-side only. |
| Paper portfolio extraction to real | Paper tokens CANNOT be converted to real tokens. Clear UI separation. |
| DDoS on price feed | Cache CoinGecko responses in Redis/KV. Circuit breaker on failure. |

---

## 11. Monetisation Hooks

Paper trading creates natural upgrade paths:

| Free Tier | Premium |
|-----------|---------|
| $100k starting balance | Custom starting balance |
| Market orders only | Limit orders + stop-loss |
| 3 resets/month | Unlimited resets |
| Basic P&L | Advanced analytics (Sharpe ratio, max drawdown) |
| No leaderboard rank | Public leaderboard ranking |
| Paper trading only | Paper + real trading in one UI |
| — | Copy-trade: replicate paper strategy on mainnet |

Connects to existing BYOK AI chat — "Ask AI about your paper portfolio performance."

---

## 12. Implementation Roadmap

### Phase 1: DB Paper Trading (2-3 weeks)

| # | Task | Effort | Status |
|---|------|--------|--------|
| 1.1 | Add `TradeEnvironment` enum + `environment` field to Trade model | 1h | ✅ Done |
| 1.2 | Create `PaperPortfolio`, `PaperPosition`, `PaperTrade` models | 2h | ✅ Done |
| 1.3 | Build price feed service (`lib/paper/price-feed.ts`) | 4h | ✅ Done |
| 1.4 | Build paper trading server actions (`actions/paper-trade.ts`) | 6h | ✅ Done |
| 1.5 | Paper mode toggle in wallet sidebar | 3h | ⏳ Next |
| 1.6 | Paper buy/sell UI (swap panel) | 8h | ⏳ |
| 1.7 | Paper portfolio dashboard | 6h | ⏳ |
| 1.8 | Paper P2P trades via OsrsTradeWindow | 4h | ⏳ |
| 1.9 | Paper trade history | 3h | ⏳ |

### Gap Fixes (pre-requisites)

| # | Task | Status |
|---|------|--------|
| G.1 | Add missing env vars to .env.example | ✅ Done |
| G.2 | ERC-20 transfer support in OsrsTradeWindow | ✅ Done |
| G.3 | KNOWN_TOKENS guidance for local chains | ✅ Done |
| G.4 | Clarify confusing task labels | ✅ Done |

### Phase 2: On-Chain Paper + DEX (3-4 weeks)

| # | Task | Effort | Dependencies |
|---|------|--------|-------------|
| 2.1 | Install Foundry, deploy mock ERC-20s locally | 4h | — |
| 2.2 | Populate `KNOWN_TOKENS` for local chains | 2h | 2.1 |
| 2.3 | ERC-20 transfer support in OsrsTradeWindow | 4h | 2.2 |
| 2.4 | Tenderly Virtual TestNet integration | 6h | Tenderly account |
| 2.5 | 0x API swap integration (`lib/dex/zero-x.ts`) | 6h | 0x API key |
| 2.6 | SwapPanel.tsx component | 8h | 2.5 |
| 2.7 | Real swap execution (mainnet) | 4h | 2.6 |
| 2.8 | Paper swap execution (quote-only) | 3h | 2.5, 1.4 |

### Phase 3: Polish & Scale (2-3 weeks)

| # | Task | Effort | Dependencies |
|---|------|--------|-------------|
| 3.1 | Paper trading leaderboard | 6h | 1.7 |
| 3.2 | Limit orders for paper trades | 8h | 1.4 |
| 3.3 | Copy-trade (paper → mainnet) | 8h | 2.7 |
| 3.4 | Advanced analytics (Sharpe, drawdown, charts) | 8h | 1.7 |
| 3.5 | Fix env vars, task naming, ganache devDep | 2h | — |
| 3.6 | Update MasterContext/agent.md/architecture.md | 2h | All |

---

## Decision Points for Owner

Before implementation, confirm:

1. **Phase 1 approach?** DB-simulated paper trading (recommended) vs. jump straight to on-chain?
2. **Starting balance?** $100,000 (standard for paper trading platforms)?
3. **DEX aggregator?** 0x API (recommended, powers Matcha) vs. 1inch vs. Uniswap SDK?
4. **Tenderly vs Railway** for Phase 2 on-chain paper trading?
5. **Priority:** Paper trading first, or DEX swaps first, or gap fixes first?
