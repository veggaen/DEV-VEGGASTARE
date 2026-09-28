"use server";

/**
 * @fileOverview  The paper account's equity curve: cash plus positions valued
 *                at each day's close, rebuilt from the trade log since the
 *                last reset. Daily candles come from the market feed; a
 *                symbol without candles is valued at its last trade price.
 *                The final point is anchored to the stored portfolio so the
 *                curve always ends at what the terminal shows.
 * @stability     experimental
 */

import { dbPrisma as db } from "@/lib/db";
import { MyLibUserAuth } from "@/lib/user-auth";
import { getCandles } from "@/lib/market/feed";
import { marketBySymbol } from "@/lib/market/symbols";
import { readPaperPortfolio } from "@/lib/paper/read";

type ActionResult<T> = { success: true; data: T } | { success: false; error: string; code?: "UNAUTHORIZED" | "NOT_FOUND" | "UNAVAILABLE" };

export type EquityPoint = { t: number; usd: number; cash: number };
export type EquityCurve = {
  points: EquityPoint[];
  allocation: Array<{ symbol: string; usd: number; share: number }>;
  cash: number;
  startingBalance: number;
  since: number;
};

const DAY_MS = 86_400_000;
const num = (v: string | null | undefined) => { const n = Number(v ?? 0); return Number.isFinite(n) ? n : 0; };

export async function getPaperEquityCurve(input: { days?: number } = {}): Promise<ActionResult<EquityCurve>> {
  const user = await MyLibUserAuth();
  if (!user?.id) return { success: false, error: "Sign in to see your paper account.", code: "UNAUTHORIZED" };
  const days = Math.max(2, Math.min(365, Math.floor(input.days ?? 90)));
  try {
    const portfolio = await db.paperPortfolio.findUnique({ where: { userId: user.id }, include: { Trades: { orderBy: { executedAt: "asc" } }, Positions: true } });
    if (!portfolio) return { success: false, error: "No paper account yet.", code: "NOT_FOUND" };
    const since = (portfolio.lastResetAt ?? portfolio.createdAt).getTime();
    const trades = portfolio.Trades.filter((t) => t.executedAt.getTime() >= since);

    // Replay the log: cash and units per symbol, with the last known price per symbol.
    const units = new Map<string, number>();
    const lastPrice = new Map<string, number>();
    let cash = portfolio.startingBalance;
    const timeline: Array<{ t: number; cash: number; units: Map<string, number> }> = [];
    for (const t of trades) {
      const sell = t.sellToken?.toUpperCase(), buy = t.buyToken?.toUpperCase();
      if (t.type === "BUY" && buy) { cash -= num(t.sellDisplayAmt) + num(String(t.feeUsd ?? 0)); units.set(buy, (units.get(buy) ?? 0) + num(t.buyDisplayAmt)); if (t.buyPriceUsd) lastPrice.set(buy, t.buyPriceUsd); }
      else if (t.type === "SELL" && sell) { cash += num(t.buyDisplayAmt) - num(String(t.feeUsd ?? 0)); units.set(sell, Math.max(0, (units.get(sell) ?? 0) - num(t.sellDisplayAmt))); if (t.sellPriceUsd) lastPrice.set(sell, t.sellPriceUsd); }
      else if (t.type === "SWAP" && sell && buy) { units.set(sell, Math.max(0, (units.get(sell) ?? 0) - num(t.sellDisplayAmt))); units.set(buy, (units.get(buy) ?? 0) + num(t.buyDisplayAmt)); if (t.sellPriceUsd) lastPrice.set(sell, t.sellPriceUsd); if (t.buyPriceUsd) lastPrice.set(buy, t.buyPriceUsd); }
      else continue;
      timeline.push({ t: t.executedAt.getTime(), cash, units: new Map(units) });
    }

    // Daily closes for every symbol that ever held units.
    const symbols = Array.from(new Set(timeline.flatMap((s) => Array.from(s.units.keys()))));
    const closes = new Map<string, Array<{ t: number; p: number }>>();
    await Promise.all(symbols.map(async (symbol) => {
      if (!marketBySymbol(symbol) || marketBySymbol(symbol)?.stable) return;
      try { const c = await getCandles(symbol, "1d", days + 2); closes.set(symbol, c.candles.map((k) => ({ t: k.t, p: k.c }))); } catch { /* valued at the last trade price */ }
    }));
    const priceAt = (symbol: string, t: number): number | undefined => {
      const s = closes.get(symbol);
      if (s?.length) { let p = s[0].p; for (const k of s) { if (k.t <= t) p = k.p; else break; } return p; }
      if (marketBySymbol(symbol)?.stable) return 1;
      return lastPrice.get(symbol);
    };
    const stateAt = (t: number) => { let st = { cash: portfolio.startingBalance, units: new Map<string, number>() }; for (const s of timeline) { if (s.t <= t) st = s; else break; } return st; };

    const now = Date.now();
    const from = Math.max(since, now - days * DAY_MS);
    const points: EquityPoint[] = [];
    for (let t = Math.floor(from / DAY_MS) * DAY_MS; t <= now; t += DAY_MS) {
      const at = Math.min(t + DAY_MS - 1, now);
      const st = stateAt(at);
      let usd = st.cash;
      for (const [symbol, u] of st.units) { if (u <= 0) continue; const p = priceAt(symbol, at); if (p) usd += u * p; }
      points.push({ t, usd, cash: st.cash });
    }
    // Anchor the end to the stored portfolio (live prices, exact cash).
    const current = await readPaperPortfolio();
    if (current.success && current.data.totalValueUsd != null && points.length) {
      points[points.length - 1] = { t: points[points.length - 1].t, usd: current.data.totalValueUsd, cash: current.data.portfolio.cashBalance };
    }
    const total = points[points.length - 1]?.usd ?? 0;
    const allocation = [
      ...(current.success ? current.data.positions.filter((p) => (p.valueUsd ?? 0) > 0).map((p) => ({ symbol: p.tokenSymbol, usd: p.valueUsd ?? 0, share: total > 0 ? (p.valueUsd ?? 0) / total : 0 })) : []),
      { symbol: "Cash", usd: portfolio.cashBalance, share: total > 0 ? portfolio.cashBalance / total : 0 },
    ].sort((a, b) => b.usd - a.usd);
    return { success: true, data: { points, allocation, cash: portfolio.cashBalance, startingBalance: portfolio.startingBalance, since } };
  } catch {
    return { success: false, error: "The paper account's history is temporarily unavailable.", code: "UNAVAILABLE" };
  }
}
