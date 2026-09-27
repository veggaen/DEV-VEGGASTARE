"use server";

/**
 * @fileOverview  Resting paper orders (limit / stop) for the market terminal.
 *                Orders are stored on the user's paper portfolio and settled by
 *                `settlePaperOrders`, which the terminal calls on load and on a
 *                slow poll: when the live price crosses an order's trigger the
 *                order fills at the market price through the same buy/sell
 *                logic as an immediate paper trade (fees, limits, history).
 * @stability     experimental
 */

import { z } from "zod";
import { dbPrisma as db } from "@/lib/db";
import { MyLibUserAuth } from "@/lib/user-auth";
import { isDemoUserId } from "@/lib/demo-policy";
import { getTokenPrices } from "@/lib/paper/price-feed";
import { paperBuy, paperSell } from "@/actions/paper-trade";
import type { PaperOrderSide, PaperOrderStatus, PaperOrderType } from "@/generated/prisma/client";

const MAX_OPEN_ORDERS = 50;

const placeSchema = z.object({
  side: z.enum(["BUY", "SELL"]),
  type: z.enum(["LIMIT", "STOP"]),
  tokenSymbol: z.string().min(1).max(20),
  tokenAddress: z.string().max(80).default("0x0"),
  chainId: z.coerce.number().int().positive().default(1),
  decimals: z.coerce.number().int().min(0).max(18).default(18),
  /** BUY: USD to spend. SELL: token units to sell. */
  amount: z.coerce.number().positive().max(10_000_000),
  triggerPrice: z.coerce.number().positive(),
  leverage: z.coerce.number().int().min(1).max(20).default(1),
}).strict();

export type PaperOrderRow = {
  id: string; side: PaperOrderSide; type: PaperOrderType; status: PaperOrderStatus;
  tokenSymbol: string; amount: number; triggerPrice: number; leverage: number;
  filledPriceUsd: number | null; filledAt: Date | null; failReason: string | null; createdAt: Date;
};

type ActionResult<T = unknown> = { success: true; data: T } | { success: false; error: string };

const select = { id: true, side: true, type: true, status: true, tokenSymbol: true, amount: true, triggerPrice: true, leverage: true, filledPriceUsd: true, filledAt: true, failReason: true, createdAt: true } as const;

type PortfolioCtx = { ok: true; portfolioId: string } | { ok: false; error: string };
async function currentPortfolio(): Promise<PortfolioCtx> {
  const user = await MyLibUserAuth();
  if (!user?.id) return { ok: false, error: "Sign in to place paper orders." };
  if (isDemoUserId(user.id)) return { ok: false, error: "Paper orders are disabled in the demo." };
  const portfolio = await db.paperPortfolio.findUnique({ where: { userId: user.id }, select: { id: true } });
  if (!portfolio) return { ok: false, error: "Create a paper portfolio first." };
  return { ok: true, portfolioId: portfolio.id };
}

export async function placePaperOrder(input: z.input<typeof placeSchema>): Promise<ActionResult<PaperOrderRow>> {
  const parsed = placeSchema.safeParse(input);
  if (!parsed.success) return { success: false, error: "Check the order fields and try again." };
  const ctx = await currentPortfolio();
  if (!ctx.ok) return { success: false, error: ctx.error };
  const open = await db.paperOrder.count({ where: { portfolioId: ctx.portfolioId, status: "OPEN" } });
  if (open >= MAX_OPEN_ORDERS) return { success: false, error: `You can keep up to ${MAX_OPEN_ORDERS} open orders.` };
  const d = parsed.data;
  if (d.side === "SELL") {
    const pos = await db.paperPosition.findFirst({ where: { portfolioId: ctx.portfolioId, tokenSymbol: d.tokenSymbol.toUpperCase() }, select: { displayAmount: true } });
    if (!pos || Number(pos.displayAmount) < d.amount) return { success: false, error: `You do not hold ${d.amount} ${d.tokenSymbol.toUpperCase()} to sell.` };
  }
  const row = await db.paperOrder.create({
    data: { portfolioId: ctx.portfolioId, side: d.side, type: d.type, tokenSymbol: d.tokenSymbol.toUpperCase(), tokenAddress: d.tokenAddress, chainId: d.chainId, decimals: d.decimals, amount: d.amount, triggerPrice: d.triggerPrice, leverage: d.leverage },
    select,
  });
  return { success: true, data: row };
}

export async function cancelPaperOrder(id: string): Promise<ActionResult<{ id: string }>> {
  if (!/^[a-zA-Z0-9_-]{1,128}$/.test(id)) return { success: false, error: "Unknown order." };
  const ctx = await currentPortfolio();
  if (!ctx.ok) return { success: false, error: ctx.error };
  const result = await db.paperOrder.updateMany({ where: { id, portfolioId: ctx.portfolioId, status: "OPEN" }, data: { status: "CANCELLED" } });
  if (!result.count) return { success: false, error: "That order is no longer open." };
  return { success: true, data: { id } };
}

export async function listPaperOrders(): Promise<ActionResult<PaperOrderRow[]>> {
  const ctx = await currentPortfolio();
  if (!ctx.ok) return { success: false, error: ctx.error };
  const rows = await db.paperOrder.findMany({ where: { portfolioId: ctx.portfolioId }, orderBy: [{ status: "asc" }, { createdAt: "desc" }], take: 100, select });
  return { success: true, data: rows };
}

function triggered(side: PaperOrderSide, type: PaperOrderType, trigger: number, price: number): boolean {
  if (type === "LIMIT") return side === "BUY" ? price <= trigger : price >= trigger;
  return side === "BUY" ? price >= trigger : price <= trigger; // STOP
}

/** Fill every open order whose trigger the live price has crossed. */
export async function settlePaperOrders(): Promise<ActionResult<{ filled: number; failed: number }>> {
  const ctx = await currentPortfolio();
  if (!ctx.ok) return { success: false, error: ctx.error };
  const open = await db.paperOrder.findMany({ where: { portfolioId: ctx.portfolioId, status: "OPEN" }, orderBy: { createdAt: "asc" } });
  if (!open.length) return { success: true, data: { filled: 0, failed: 0 } };
  const prices = await getTokenPrices(Array.from(new Set(open.map((o) => o.tokenSymbol)))).catch(() => new Map());
  let filled = 0, failed = 0;
  for (const o of open) {
    const quote = prices.get(o.tokenSymbol);
    const price = quote && quote.usd > 0 && (quote.staleMs ?? 0) <= 60_000 ? quote.usd : null;
    if (price === null || !triggered(o.side, o.type, o.triggerPrice, price)) continue;
    const result = o.side === "BUY"
      ? await paperBuy({ tokenSymbol: o.tokenSymbol, tokenAddress: o.tokenAddress, chainId: o.chainId, decimals: o.decimals, usdAmount: o.amount })
      : await paperSell({ tokenSymbol: o.tokenSymbol, chainId: o.chainId, tokenAmount: o.amount });
    if (result.success) {
      filled++;
      await db.paperOrder.update({ where: { id: o.id }, data: { status: "FILLED", filledAt: new Date(), filledPriceUsd: result.data.priceUsd } });
    } else {
      failed++;
      await db.paperOrder.update({ where: { id: o.id }, data: { status: "FAILED", failReason: result.error.slice(0, 200) } });
    }
  }
  return { success: true, data: { filled, failed } };
}
