"use server";

/**
 * @fileOverview  Paper trading server actions.
 *               Create/manage paper portfolios, execute paper trades
 *               (buy/sell/swap), and query portfolio state.
 * @stability     experimental
 */

import { dbPrisma as db } from "@/lib/db";
import { MyLibUserAuth } from "@/lib/user-auth";
import { getTokenPrice, getTokenPrices, isStablecoin } from "@/lib/paper/price-feed";
import { z } from "zod";
import { PaperTradeType } from "@/generated/prisma/client";
import { createTradeRecord } from "@/lib/trade-record";

// ── Constants ───────────────────────────────────────────────────────────────

const MIN_STARTING_BALANCE = 1_000;
const MAX_STARTING_BALANCE = 10_000_000;
const DEFAULT_STARTING_BALANCE = 100_000;
const SIMULATED_FEE_RATE = 0.003; // 0.3% (mimics Uniswap V3)
const MAX_RESETS_PER_WEEK = 3;
const MAX_TRADES_PER_DAY = 200;

// ── Schemas ─────────────────────────────────────────────────────────────────

const createPortfolioSchema = z.object({
  startingBalance: z.coerce
    .number()
    .min(MIN_STARTING_BALANCE)
    .max(MAX_STARTING_BALANCE)
    .optional()
    .default(DEFAULT_STARTING_BALANCE),
});

const paperBuySchema = z.object({
  tokenSymbol: z.string().min(1).max(20),
  tokenAddress: z.string().default("0x0"),
  chainId: z.coerce.number().int().positive(),
  decimals: z.coerce.number().int().min(0).max(18).default(18),
  /** Amount of USD to spend */
  usdAmount: z.coerce.number().positive().max(10_000_000),
});

const paperSellSchema = z.object({
  tokenSymbol: z.string().min(1).max(20),
  chainId: z.coerce.number().int().positive(),
  /** Amount of token to sell (display units, e.g. "1.5") */
  tokenAmount: z.coerce.number().positive(),
});

const paperSwapSchema = z.object({
  sellSymbol: z.string().min(1).max(20),
  sellChainId: z.coerce.number().int().positive(),
  sellAmount: z.coerce.number().positive(), // display units of sell token
  buySymbol: z.string().min(1).max(20),
  buyTokenAddress: z.string().default("0x0"),
  buyChainId: z.coerce.number().int().positive(),
  buyDecimals: z.coerce.number().int().min(0).max(18).default(18),
});

// ── Helpers ─────────────────────────────────────────────────────────────────

type ActionResult<T = unknown> =
  | { success: true; data: T }
  | { success: false; error: string };

function unauthorized(): ActionResult<never> {
  return { success: false, error: "Unauthorized" };
}

function toRaw(display: number, decimals: number): string {
  // Convert display amount to raw BigInt string
  const factor = BigInt(10) ** BigInt(decimals);
  const raw = BigInt(Math.floor(display * Number(factor)));
  return raw.toString();
}

function fromRaw(raw: string, decimals: number): number {
  const factor = 10 ** decimals;
  return Number(BigInt(raw)) / factor;
}

// ── Portfolio Management ────────────────────────────────────────────────────

/**
 * Create or get the user's paper portfolio.
 */
export async function createPaperPortfolio(
  input: z.infer<typeof createPortfolioSchema>,
): Promise<ActionResult<{ portfolioId: string; cashBalance: number }>> {
  const user = await MyLibUserAuth();
  if (!user?.id) return unauthorized();

  const parsed = createPortfolioSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.message };

  const { startingBalance } = parsed.data;

  // Upsert — don't create duplicate
  const portfolio = await db.paperPortfolio.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      startingBalance,
      cashBalance: startingBalance,
    },
    update: {}, // don't overwrite existing
  });

  return {
    success: true,
    data: {
      portfolioId: portfolio.id,
      cashBalance: portfolio.cashBalance,
    },
  };
}

/**
 * Get the user's paper portfolio with positions and current prices.
 */
export async function getPaperPortfolio(): Promise<
  ActionResult<{
    portfolio: {
      id: string;
      startingBalance: number;
      cashBalance: number;
      resetCount: number;
    };
    positions: Array<{
      tokenSymbol: string;
      tokenAddress: string;
      chainId: number;
      displayAmount: string;
      avgEntryPrice: number;
      currentPriceUsd: number;
      valueUsd: number;
      pnlUsd: number;
      pnlPercent: number;
    }>;
    totalValueUsd: number;
    totalPnlUsd: number;
    totalPnlPercent: number;
  }>
> {
  const user = await MyLibUserAuth();
  if (!user?.id) return unauthorized();

  const portfolio = await db.paperPortfolio.findUnique({
    where: { userId: user.id },
    include: { Positions: true },
  });

  if (!portfolio) {
    return { success: false, error: "No paper portfolio. Create one first." };
  }

  // Fetch current prices for all positions
  const symbols = portfolio.Positions.map((p) => p.tokenSymbol);
  const prices = await getTokenPrices(symbols);

  let totalValueUsd = portfolio.cashBalance;
  const positions = portfolio.Positions.filter(
    (p) => BigInt(p.amount) > BigInt(0),
  ).map((pos) => {
    const displayAmt = parseFloat(pos.displayAmount);
    const quote = prices.get(pos.tokenSymbol.toUpperCase());
    const currentPriceUsd = quote?.usd ?? 0;
    const valueUsd = displayAmt * currentPriceUsd;
    const costBasis = pos.totalCostBasis;
    const pnlUsd = valueUsd - costBasis;
    const pnlPercent = costBasis > 0 ? (pnlUsd / costBasis) * 100 : 0;

    totalValueUsd += valueUsd;

    return {
      tokenSymbol: pos.tokenSymbol,
      tokenAddress: pos.tokenAddress,
      chainId: pos.chainId,
      displayAmount: pos.displayAmount,
      avgEntryPrice: pos.avgEntryPrice,
      currentPriceUsd,
      valueUsd,
      pnlUsd,
      pnlPercent,
    };
  });

  const totalPnlUsd = totalValueUsd - portfolio.startingBalance;
  const totalPnlPercent =
    portfolio.startingBalance > 0
      ? (totalPnlUsd / portfolio.startingBalance) * 100
      : 0;

  return {
    success: true,
    data: {
      portfolio: {
        id: portfolio.id,
        startingBalance: portfolio.startingBalance,
        cashBalance: portfolio.cashBalance,
        resetCount: portfolio.resetCount,
      },
      positions,
      totalValueUsd,
      totalPnlUsd,
      totalPnlPercent,
    },
  };
}

/**
 * Reset paper portfolio back to starting balance.
 * Rate limited to MAX_RESETS_PER_WEEK.
 */
export async function resetPaperPortfolio(): Promise<
  ActionResult<{ cashBalance: number }>
> {
  const user = await MyLibUserAuth();
  if (!user?.id) return unauthorized();

  const portfolio = await db.paperPortfolio.findUnique({
    where: { userId: user.id },
  });
  if (!portfolio) {
    return { success: false, error: "No paper portfolio found." };
  }

  // Rate limit resets
  const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  if (
    portfolio.lastResetAt &&
    portfolio.lastResetAt > oneWeekAgo &&
    portfolio.resetCount >= MAX_RESETS_PER_WEEK
  ) {
    return {
      success: false,
      error: `Max ${MAX_RESETS_PER_WEEK} resets per week. Try again later.`,
    };
  }

  // Reset portfolio — delete all positions, restore cash
  await db.$transaction([
    db.paperPosition.deleteMany({
      where: { portfolioId: portfolio.id },
    }),
    db.paperPortfolio.update({
      where: { id: portfolio.id },
      data: {
        cashBalance: portfolio.startingBalance,
        resetCount: { increment: 1 },
        lastResetAt: new Date(),
      },
    }),
    // Log the reset as a FAUCET trade
    db.paperTrade.create({
      data: {
        portfolioId: portfolio.id,
        type: "FAUCET",
        buyToken: "USD",
        buyDisplayAmt: portfolio.startingBalance.toString(),
        buyPriceUsd: 1.0,
        priceSource: "manual",
        metadata: { action: "portfolio_reset" },
      },
    }),
  ]);

  return {
    success: true,
    data: { cashBalance: portfolio.startingBalance },
  };
}

// ── Paper Buy ───────────────────────────────────────────────────────────────

/**
 * Paper-buy a token with virtual USD at real market price.
 */
export async function paperBuy(
  input: z.infer<typeof paperBuySchema>,
): Promise<ActionResult<{ tokenAmount: string; priceUsd: number; feeUsd: number }>> {
  const user = await MyLibUserAuth();
  if (!user?.id) return unauthorized();

  const parsed = paperBuySchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.message };

  const { tokenSymbol, tokenAddress, chainId, decimals, usdAmount } = parsed.data;
  const symbol = tokenSymbol.toUpperCase();

  // Get portfolio
  const portfolio = await db.paperPortfolio.findUnique({
    where: { userId: user.id },
    include: { _count: { select: { Trades: { where: { executedAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } } } } } },
  });
  if (!portfolio) return { success: false, error: "Create a paper portfolio first." };

  // Daily trade limit
  if (portfolio._count.Trades >= MAX_TRADES_PER_DAY) {
    return { success: false, error: `Max ${MAX_TRADES_PER_DAY} paper trades per day.` };
  }

  // Check cash balance
  const feeUsd = usdAmount * SIMULATED_FEE_RATE;
  const totalCost = usdAmount + feeUsd;
  if (portfolio.cashBalance < totalCost) {
    return {
      success: false,
      error: `Insufficient paper USD. Need $${totalCost.toFixed(2)}, have $${portfolio.cashBalance.toFixed(2)}.`,
    };
  }

  // Get real price
  const quote = await getTokenPrice(symbol);
  if (quote.usd <= 0) {
    return { success: false, error: `Cannot get price for ${symbol}. Try again.` };
  }

  // Calculate token amount
  const tokenAmount = usdAmount / quote.usd;
  const rawAmount = toRaw(tokenAmount, decimals);

  // Execute in transaction
  await db.$transaction(async (tx) => {
    // Deduct cash
    await tx.paperPortfolio.update({
      where: { id: portfolio.id },
      data: { cashBalance: { decrement: totalCost } },
    });

    // Upsert position
    const existing = await tx.paperPosition.findUnique({
      where: {
        portfolioId_tokenSymbol_chainId: {
          portfolioId: portfolio.id,
          tokenSymbol: symbol,
          chainId,
        },
      },
    });

    if (existing) {
      const oldAmount = fromRaw(existing.amount, decimals);
      const newAmount = oldAmount + tokenAmount;
      const newCostBasis = existing.totalCostBasis + usdAmount;
      const newAvgEntry = newCostBasis / newAmount;

      await tx.paperPosition.update({
        where: { id: existing.id },
        data: {
          amount: (BigInt(existing.amount) + BigInt(rawAmount)).toString(),
          displayAmount: newAmount.toFixed(8),
          avgEntryPrice: newAvgEntry,
          totalCostBasis: newCostBasis,
        },
      });
    } else {
      await tx.paperPosition.create({
        data: {
          portfolioId: portfolio.id,
          tokenSymbol: symbol,
          tokenAddress,
          chainId,
          decimals,
          amount: rawAmount,
          displayAmount: tokenAmount.toFixed(8),
          avgEntryPrice: quote.usd,
          totalCostBasis: usdAmount,
        },
      });
    }

    // Record trade
    await tx.paperTrade.create({
      data: {
        portfolioId: portfolio.id,
        type: "BUY",
        sellToken: "USD",
        sellDisplayAmt: usdAmount.toFixed(2),
        sellPriceUsd: 1.0,
        buyToken: symbol,
        buyAmount: rawAmount,
        buyDisplayAmt: tokenAmount.toFixed(8),
        buyPriceUsd: quote.usd,
        chainId,
        feeUsd,
        priceSource: quote.source === "coingecko" ? "coingecko" : "coingecko",
      },
    });
  });

  // Create unified TradeRecord (fire-and-forget, non-blocking)
  createTradeRecord({
    userId: user.id,
    mode: "PAPER",
    sellToken: "USD",
    sellTokenAddress: "0x0000000000000000000000000000000000000000",
    sellAmount: Math.round(usdAmount * 100).toString(),
    sellDisplayAmt: usdAmount.toFixed(2),
    sellDecimals: 2,
    sellChainId: chainId,
    buyToken: symbol,
    buyTokenAddress: tokenAddress,
    buyAmount: rawAmount,
    buyDisplayAmt: tokenAmount.toFixed(8),
    buyDecimals: decimals,
    buyChainId: chainId,
    priceUsd: usdAmount,
    feeUsd,
    exchangeRate: quote.usd,
    priceSource: "coingecko",
    environment: "PAPER",
    metadata: { paperAction: "buy", portfolioId: portfolio.id },
  }).catch((err) => console.error("[PAPER_BUY] TradeRecord write failed:", err));

  return {
    success: true,
    data: {
      tokenAmount: tokenAmount.toFixed(8),
      priceUsd: quote.usd,
      feeUsd,
    },
  };
}

// ── Paper Sell ──────────────────────────────────────────────────────────────

/**
 * Paper-sell a token for virtual USD at real market price.
 */
export async function paperSell(
  input: z.infer<typeof paperSellSchema>,
): Promise<ActionResult<{ usdReceived: number; priceUsd: number; feeUsd: number }>> {
  const user = await MyLibUserAuth();
  if (!user?.id) return unauthorized();

  const parsed = paperSellSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.message };

  const { tokenSymbol, chainId, tokenAmount } = parsed.data;
  const symbol = tokenSymbol.toUpperCase();

  // Get portfolio
  const portfolio = await db.paperPortfolio.findUnique({
    where: { userId: user.id },
  });
  if (!portfolio) return { success: false, error: "Create a paper portfolio first." };

  // Get position
  const position = await db.paperPosition.findUnique({
    where: {
      portfolioId_tokenSymbol_chainId: {
        portfolioId: portfolio.id,
        tokenSymbol: symbol,
        chainId,
      },
    },
  });
  if (!position) return { success: false, error: `No ${symbol} position found.` };

  const currentDisplayAmt = parseFloat(position.displayAmount);
  if (tokenAmount > currentDisplayAmt) {
    return {
      success: false,
      error: `Insufficient ${symbol}. Have ${currentDisplayAmt}, want to sell ${tokenAmount}.`,
    };
  }

  // Get real price
  const quote = await getTokenPrice(symbol);
  if (quote.usd <= 0) {
    return { success: false, error: `Cannot get price for ${symbol}. Try again.` };
  }

  const grossUsd = tokenAmount * quote.usd;
  const feeUsd = grossUsd * SIMULATED_FEE_RATE;
  const netUsd = grossUsd - feeUsd;

  // Calculate proportional cost basis to remove
  const sellRatio = tokenAmount / currentDisplayAmt;
  const costBasisRemoved = position.totalCostBasis * sellRatio;

  const rawToRemove = toRaw(tokenAmount, position.decimals);

  await db.$transaction(async (tx) => {
    // Add cash
    await tx.paperPortfolio.update({
      where: { id: portfolio.id },
      data: { cashBalance: { increment: netUsd } },
    });

    // Update position
    const newRaw = (BigInt(position.amount) - BigInt(rawToRemove)).toString();
    const newDisplay = currentDisplayAmt - tokenAmount;

    if (newDisplay <= 0.00000001) {
      // Position fully sold — delete it
      await tx.paperPosition.delete({ where: { id: position.id } });
    } else {
      await tx.paperPosition.update({
        where: { id: position.id },
        data: {
          amount: newRaw,
          displayAmount: newDisplay.toFixed(8),
          totalCostBasis: position.totalCostBasis - costBasisRemoved,
          // avg entry price stays the same on sells
        },
      });
    }

    // Record trade
    await tx.paperTrade.create({
      data: {
        portfolioId: portfolio.id,
        type: "SELL",
        sellToken: symbol,
        sellAmount: rawToRemove,
        sellDisplayAmt: tokenAmount.toFixed(8),
        sellPriceUsd: quote.usd,
        buyToken: "USD",
        buyDisplayAmt: netUsd.toFixed(2),
        buyPriceUsd: 1.0,
        chainId,
        feeUsd,
        priceSource: quote.source === "coingecko" ? "coingecko" : "coingecko",
      },
    });
  });

  // Create unified TradeRecord (fire-and-forget, non-blocking)
  createTradeRecord({
    userId: user.id,
    mode: "PAPER",
    sellToken: symbol,
    sellTokenAddress: position.tokenAddress,
    sellAmount: rawToRemove,
    sellDisplayAmt: tokenAmount.toFixed(8),
    sellDecimals: position.decimals,
    sellChainId: chainId,
    buyToken: "USD",
    buyTokenAddress: "0x0000000000000000000000000000000000000000",
    buyAmount: Math.round(netUsd * 100).toString(),
    buyDisplayAmt: netUsd.toFixed(2),
    buyDecimals: 2,
    buyChainId: chainId,
    priceUsd: grossUsd,
    feeUsd,
    exchangeRate: quote.usd,
    priceSource: "coingecko",
    costBasisUsd: costBasisRemoved,
    gainLossUsd: netUsd - costBasisRemoved,
    environment: "PAPER",
    metadata: { paperAction: "sell", portfolioId: portfolio.id },
  }).catch((err) => console.error("[PAPER_SELL] TradeRecord write failed:", err));

  return {
    success: true,
    data: {
      usdReceived: netUsd,
      priceUsd: quote.usd,
      feeUsd,
    },
  };
}

// ── Paper Swap ──────────────────────────────────────────────────────────────

/**
 * Paper-swap one token for another at real market prices.
 * Uses CoinGecko cross-rates (sellPrice / buyPrice).
 */
export async function paperSwap(
  input: z.infer<typeof paperSwapSchema>,
): Promise<
  ActionResult<{
    sellAmount: string;
    buyAmount: string;
    rate: number;
    feeUsd: number;
  }>
> {
  const user = await MyLibUserAuth();
  if (!user?.id) return unauthorized();

  const parsed = paperSwapSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: parsed.error.message };

  const {
    sellSymbol: rawSellSymbol,
    sellChainId,
    sellAmount,
    buySymbol: rawBuySymbol,
    buyTokenAddress,
    buyChainId,
    buyDecimals,
  } = parsed.data;

  const sellSymbol = rawSellSymbol.toUpperCase();
  const buySymbol = rawBuySymbol.toUpperCase();

  if (sellSymbol === buySymbol && sellChainId === buyChainId) {
    return { success: false, error: "Cannot swap a token for itself." };
  }

  const portfolio = await db.paperPortfolio.findUnique({
    where: { userId: user.id },
  });
  if (!portfolio) return { success: false, error: "Create a paper portfolio first." };

  // Check sell position
  const sellPos = await db.paperPosition.findUnique({
    where: {
      portfolioId_tokenSymbol_chainId: {
        portfolioId: portfolio.id,
        tokenSymbol: sellSymbol,
        chainId: sellChainId,
      },
    },
  });
  if (!sellPos) return { success: false, error: `No ${sellSymbol} position to swap.` };

  const sellDisplayAmt = parseFloat(sellPos.displayAmount);
  if (sellAmount > sellDisplayAmt) {
    return {
      success: false,
      error: `Insufficient ${sellSymbol}. Have ${sellDisplayAmt}, want to swap ${sellAmount}.`,
    };
  }

  // Get both prices
  const prices = await getTokenPrices([sellSymbol, buySymbol]);
  const sellQuote = prices.get(sellSymbol);
  const buyQuote = prices.get(buySymbol);

  if (!sellQuote?.usd || sellQuote.usd <= 0) {
    return { success: false, error: `Cannot get price for ${sellSymbol}.` };
  }
  if (!buyQuote?.usd || buyQuote.usd <= 0) {
    return { success: false, error: `Cannot get price for ${buySymbol}.` };
  }

  // Calculate swap
  const sellValueUsd = sellAmount * sellQuote.usd;
  const feeUsd = sellValueUsd * SIMULATED_FEE_RATE;
  const netValueUsd = sellValueUsd - feeUsd;
  const buyAmount = netValueUsd / buyQuote.usd;
  const rate = sellQuote.usd / buyQuote.usd; // how many buy tokens per sell token

  const sellRaw = toRaw(sellAmount, sellPos.decimals);
  const buyRaw = toRaw(buyAmount, buyDecimals);

  // Proportional cost basis
  const sellRatio = sellAmount / sellDisplayAmt;
  const costBasisMoved = sellPos.totalCostBasis * sellRatio;

  await db.$transaction(async (tx) => {
    // Reduce sell position
    const newSellDisplay = sellDisplayAmt - sellAmount;
    if (newSellDisplay <= 0.00000001) {
      await tx.paperPosition.delete({ where: { id: sellPos.id } });
    } else {
      await tx.paperPosition.update({
        where: { id: sellPos.id },
        data: {
          amount: (BigInt(sellPos.amount) - BigInt(sellRaw)).toString(),
          displayAmount: newSellDisplay.toFixed(8),
          totalCostBasis: sellPos.totalCostBasis - costBasisMoved,
        },
      });
    }

    // Upsert buy position
    const existing = await tx.paperPosition.findUnique({
      where: {
        portfolioId_tokenSymbol_chainId: {
          portfolioId: portfolio.id,
          tokenSymbol: buySymbol,
          chainId: buyChainId,
        },
      },
    });

    if (existing) {
      const oldAmount = fromRaw(existing.amount, buyDecimals);
      const newAmount = oldAmount + buyAmount;
      const newCostBasis = existing.totalCostBasis + netValueUsd;
      const newAvgEntry = newCostBasis / newAmount;

      await tx.paperPosition.update({
        where: { id: existing.id },
        data: {
          amount: (BigInt(existing.amount) + BigInt(buyRaw)).toString(),
          displayAmount: newAmount.toFixed(8),
          avgEntryPrice: newAvgEntry,
          totalCostBasis: newCostBasis,
        },
      });
    } else {
      await tx.paperPosition.create({
        data: {
          portfolioId: portfolio.id,
          tokenSymbol: buySymbol,
          tokenAddress: buyTokenAddress,
          chainId: buyChainId,
          decimals: buyDecimals,
          amount: buyRaw,
          displayAmount: buyAmount.toFixed(8),
          avgEntryPrice: buyQuote.usd,
          totalCostBasis: netValueUsd,
        },
      });
    }

    // Record trade
    await tx.paperTrade.create({
      data: {
        portfolioId: portfolio.id,
        type: "SWAP",
        sellToken: sellSymbol,
        sellAmount: sellRaw,
        sellDisplayAmt: sellAmount.toFixed(8),
        sellPriceUsd: sellQuote.usd,
        buyToken: buySymbol,
        buyAmount: buyRaw,
        buyDisplayAmt: buyAmount.toFixed(8),
        buyPriceUsd: buyQuote.usd,
        chainId: buyChainId,
        feeUsd,
        priceSource: "coingecko",
      },
    });
  });

  // Create unified TradeRecord (fire-and-forget, non-blocking)
  createTradeRecord({
    userId: user.id,
    mode: "PAPER",
    sellToken: sellSymbol,
    sellTokenAddress: sellPos.tokenAddress,
    sellAmount: sellRaw,
    sellDisplayAmt: sellAmount.toFixed(8),
    sellDecimals: sellPos.decimals,
    sellChainId,
    buyToken: buySymbol,
    buyTokenAddress: buyTokenAddress,
    buyAmount: buyRaw,
    buyDisplayAmt: buyAmount.toFixed(8),
    buyDecimals,
    buyChainId,
    priceUsd: sellValueUsd,
    feeUsd,
    exchangeRate: rate,
    priceSource: "coingecko",
    costBasisUsd: costBasisMoved,
    gainLossUsd: netValueUsd - costBasisMoved,
    environment: "PAPER",
    metadata: { paperAction: "swap", portfolioId: portfolio.id },
  }).catch((err) => console.error("[PAPER_SWAP] TradeRecord write failed:", err));

  return {
    success: true,
    data: {
      sellAmount: sellAmount.toFixed(8),
      buyAmount: buyAmount.toFixed(8),
      rate,
      feeUsd,
    },
  };
}

// ── Trade History ───────────────────────────────────────────────────────────

/**
 * Get paper trade history for the current user.
 */
export async function getPaperTradeHistory(opts?: {
  limit?: number;
  type?: PaperTradeType;
}): Promise<
  ActionResult<
    Array<{
      id: string;
      type: PaperTradeType;
      sellToken: string | null;
      sellDisplayAmt: string | null;
      sellPriceUsd: number | null;
      buyToken: string | null;
      buyDisplayAmt: string | null;
      buyPriceUsd: number | null;
      feeUsd: number | null;
      executedAt: Date;
    }>
  >
> {
  const user = await MyLibUserAuth();
  if (!user?.id) return unauthorized();

  const portfolio = await db.paperPortfolio.findUnique({
    where: { userId: user.id },
    select: { id: true },
  });
  if (!portfolio) return { success: false, error: "No paper portfolio found." };

  const limit = Math.min(opts?.limit ?? 50, 200);

  const trades = await db.paperTrade.findMany({
    where: {
      portfolioId: portfolio.id,
      ...(opts?.type ? { type: opts.type } : {}),
    },
    orderBy: { executedAt: "desc" },
    take: limit,
    select: {
      id: true,
      type: true,
      sellToken: true,
      sellDisplayAmt: true,
      sellPriceUsd: true,
      buyToken: true,
      buyDisplayAmt: true,
      buyPriceUsd: true,
      feeUsd: true,
      executedAt: true,
    },
  });

  return { success: true, data: trades };
}
