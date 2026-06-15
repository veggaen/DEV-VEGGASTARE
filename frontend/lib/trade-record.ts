/**
 * @fileOverview  Shared utility for creating TradeRecord entries.
 *                Centralizes the write logic so P2P, DEX, Paper, Self, and
 *                LocalChain flows all produce consistent records.
 * @stability     experimental
 */

import "server-only";

import { dbPrisma } from "@/lib/db";
import { getExchangeRates } from "@/lib/currency-rates";
import type { TradeMode, TradeRecordStatus, TradeEnvironment } from "@/generated/prisma/client";

// ── Types ───────────────────────────────────────────────────────────────────

export interface CreateTradeRecordInput {
  userId: string;
  mode: TradeMode;

  // What was sold
  sellToken: string;
  sellTokenAddress: string;
  sellAmount: string;       // BigInt string (raw smallest unit)
  sellDisplayAmt: string;   // Human-readable
  sellDecimals?: number;
  sellChainId: number;

  // What was bought
  buyToken: string;
  buyTokenAddress: string;
  buyAmount: string;
  buyDisplayAmt: string;
  buyDecimals?: number;
  buyChainId: number;

  // Price data
  priceUsd?: number | null;
  feeUsd?: number | null;
  exchangeRate?: number | null;
  priceSource?: string | null;

  // Context
  tradeId?: string | null;        // P2P trade ID
  paperTradeId?: string | null;   // Paper trade ID
  txHash?: string | null;         // On-chain tx hash
  blockNumber?: number | null;
  walletAddress?: string | null;
  walletId?: string | null;
  counterpartyId?: string | null;
  counterpartyAddr?: string | null;
  environment?: TradeEnvironment;
  status?: TradeRecordStatus;
  failReason?: string | null;

  // Tax
  costBasisUsd?: number | null;
  gainLossUsd?: number | null;

  // Ownership
  companyId?: string | null;
  metadata?: Record<string, unknown> | null;
}

// ── Constants ───────────────────────────────────────────────────────────────

const NATIVE_ADDR = "0x0000000000000000000000000000000000000000";

// ── Helper ──────────────────────────────────────────────────────────────────

/**
 * Convert a USD amount to NOK using live ECB exchange rates.
 * Returns null if exchange rate is unavailable.
 */
async function usdToNok(usd: number | null | undefined): Promise<number | null> {
  if (usd == null || usd === 0) return null;
  try {
    const rates = await getExchangeRates();
    const nokRate = rates.NOK;
    if (!nokRate || nokRate === 0) return null;
    // getExchangeRates returns rates relative to USD — NOK is NOK/USD
    return usd * (1 / nokRate);
  } catch {
    return null;
  }
}

/**
 * Compute the tax year from a Date (defaults to current year).
 */
function getTaxYear(date?: Date): number {
  return (date ?? new Date()).getFullYear();
}

// ── Main Function ───────────────────────────────────────────────────────────

/**
 * Create a TradeRecord in the database.
 *
 * Usage:
 * ```ts
 * await createTradeRecord({
 *   userId: "clxyz...",
 *   mode: "DEX",
 *   sellToken: "ETH",
 *   sellTokenAddress: "0xEeee...",
 *   sellAmount: "1000000000000000000",
 *   sellDisplayAmt: "1.0",
 *   sellChainId: 1,
 *   buyToken: "USDC",
 *   buyTokenAddress: "0xA0b86991...",
 *   buyAmount: "3000000000",
 *   buyDisplayAmt: "3000.0",
 *   buyChainId: 1,
 *   priceUsd: 3000,
 *   txHash: "0xabc...",
 *   walletAddress: "0x123...",
 * });
 * ```
 */
export async function createTradeRecord(input: CreateTradeRecordInput) {
  const now = new Date();

  // Compute NOK values in parallel
  const [priceNok, feeNok, costBasisNok, gainLossNok] = await Promise.all([
    usdToNok(input.priceUsd),
    usdToNok(input.feeUsd),
    usdToNok(input.costBasisUsd),
    usdToNok(input.gainLossUsd),
  ]);

  return dbPrisma.tradeRecord.create({
    data: {
      userId: input.userId,
      mode: input.mode,

      sellToken: input.sellToken,
      sellTokenAddress: input.sellTokenAddress || NATIVE_ADDR,
      sellAmount: input.sellAmount,
      sellDisplayAmt: input.sellDisplayAmt,
      sellDecimals: input.sellDecimals ?? 18,
      sellChainId: input.sellChainId,

      buyToken: input.buyToken,
      buyTokenAddress: input.buyTokenAddress || NATIVE_ADDR,
      buyAmount: input.buyAmount,
      buyDisplayAmt: input.buyDisplayAmt,
      buyDecimals: input.buyDecimals ?? 18,
      buyChainId: input.buyChainId,

      priceUsd: input.priceUsd ?? null,
      priceNok: priceNok,
      feeUsd: input.feeUsd ?? null,
      feeNok: feeNok,
      exchangeRate: input.exchangeRate ?? null,
      priceSource: input.priceSource ?? null,

      tradeId: input.tradeId ?? null,
      paperTradeId: input.paperTradeId ?? null,
      txHash: input.txHash ?? null,
      blockNumber: input.blockNumber ?? null,
      walletAddress: input.walletAddress ?? null,
      walletId: input.walletId ?? null,
      counterpartyId: input.counterpartyId ?? null,
      counterpartyAddr: input.counterpartyAddr ?? null,
      environment: input.environment ?? "MAINNET",
      status: input.status ?? "COMPLETED",
      failReason: input.failReason ?? null,

      costBasisUsd: input.costBasisUsd ?? null,
      costBasisNok: costBasisNok,
      gainLossUsd: input.gainLossUsd ?? null,
      gainLossNok: gainLossNok,

      taxYear: getTaxYear(now),

      companyId: input.companyId ?? null,
      metadata: input.metadata as any ?? undefined,

      executedAt: now,
    },
  });
}

/**
 * Convenience: create TradeRecords for both sides of a P2P trade.
 * Returns array of 2 records [initiatorRecord, responderRecord].
 */
export async function createP2PTradeRecords(opts: {
  trade: {
    id: string;
    initiatorId: string;
    responderId: string;
    chainId: number | null;
    environment: TradeEnvironment;
    metadata: Record<string, unknown> | null;
  };
  initiatorItems: Array<{
    tokenSymbol: string;
    tokenAddress: string;
    amount: string;
    displayAmount: string;
    tokenDecimals: number;
    chainId: number;
  }>;
  responderItems: Array<{
    tokenSymbol: string;
    tokenAddress: string;
    amount: string;
    displayAmount: string;
    tokenDecimals: number;
    chainId: number;
  }>;
}) {
  const { trade, initiatorItems, responderItems } = opts;
  const chainId = trade.chainId ?? 1;
  const meta = trade.metadata ?? {};

  // Build condensed sell/buy summaries
  // Initiator: sold initiatorItems, bought responderItems
  // Responder: sold responderItems, bought initiatorItems
  const condense = (items: typeof initiatorItems) => {
    if (items.length === 0) {
      return {
        token: "NOTHING",
        address: NATIVE_ADDR,
        amount: "0",
        displayAmt: "0",
        decimals: 18,
        chainId,
      };
    }
    if (items.length === 1) {
      return {
        token: items[0].tokenSymbol,
        address: items[0].tokenAddress,
        amount: items[0].amount,
        displayAmt: items[0].displayAmount,
        decimals: items[0].tokenDecimals,
        chainId: items[0].chainId,
      };
    }
    // Multiple items: use first token as primary, store full list in metadata
    return {
      token: `${items[0].tokenSymbol}+${items.length - 1}`,
      address: items[0].tokenAddress,
      amount: items[0].amount,
      displayAmt: items[0].displayAmount,
      decimals: items[0].tokenDecimals,
      chainId: items[0].chainId,
    };
  };

  const initSell = condense(initiatorItems);
  const initBuy = condense(responderItems);
  const respSell = condense(responderItems);
  const respBuy = condense(initiatorItems);

  const initiatorWallet = (meta.initiatorWallet as string) ?? null;
  const responderWallet = (meta.responderWallet as string) ?? null;

  const [initiatorRecord, responderRecord] = await Promise.all([
    createTradeRecord({
      userId: trade.initiatorId,
      mode: "P2P",
      sellToken: initSell.token,
      sellTokenAddress: initSell.address,
      sellAmount: initSell.amount,
      sellDisplayAmt: initSell.displayAmt,
      sellDecimals: initSell.decimals,
      sellChainId: initSell.chainId,
      buyToken: initBuy.token,
      buyTokenAddress: initBuy.address,
      buyAmount: initBuy.amount,
      buyDisplayAmt: initBuy.displayAmt,
      buyDecimals: initBuy.decimals,
      buyChainId: initBuy.chainId,
      tradeId: trade.id,
      walletAddress: initiatorWallet,
      counterpartyId: trade.responderId,
      counterpartyAddr: responderWallet,
      environment: trade.environment,
      priceSource: "p2p_agreed",
      metadata: {
        initiatorItems,
        responderItems,
        fullTradeMetadata: meta,
      },
    }),
    createTradeRecord({
      userId: trade.responderId,
      mode: "P2P",
      sellToken: respSell.token,
      sellTokenAddress: respSell.address,
      sellAmount: respSell.amount,
      sellDisplayAmt: respSell.displayAmt,
      sellDecimals: respSell.decimals,
      sellChainId: respSell.chainId,
      buyToken: respBuy.token,
      buyTokenAddress: respBuy.address,
      buyAmount: respBuy.amount,
      buyDisplayAmt: respBuy.displayAmt,
      buyDecimals: respBuy.decimals,
      buyChainId: respBuy.chainId,
      tradeId: trade.id,
      walletAddress: responderWallet,
      counterpartyId: trade.initiatorId,
      counterpartyAddr: initiatorWallet,
      environment: trade.environment,
      priceSource: "p2p_agreed",
      metadata: {
        initiatorItems,
        responderItems,
        fullTradeMetadata: meta,
      },
    }),
  ]);

  return [initiatorRecord, responderRecord];
}
