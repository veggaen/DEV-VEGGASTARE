"use client";

/**
 * @fileOverview  /dashboard/paper-trading — the paper terminal on its own page.
 *                Same workspace as the trading hub's Paper tab: chart, market
 *                list, order ticket and portfolio panels. Guests see the live
 *                chart and a sign-in card; the read-only demo sees the chart
 *                with a disabled ticket.
 * @stability     experimental
 */

import { useEffect } from "react";
import Link from "next/link";
import { useTradeMode } from "@/contexts/trade-mode-context";
import { MarketTerminal } from "@/components/trading/terminal/MarketTerminal";
import { PageHeader, PageShell } from "@/components/uicustom/chrome/page-header";

export default function PaperTradingPage() {
  const { mode, setMode } = useTradeMode();
  // Keep the hub in step so the mode switcher shows Paper when you come back.
  useEffect(() => { if (mode !== "paper") setMode("paper"); }, [mode, setMode]);

  return (
    <PageShell width="wide" as="section" className="py-6 sm:py-8">
      <PageHeader
        eyebrow="Trading"
        title="Trading terminal"
        description="Live trades go through your connected wallet; switch to Paper to practise with virtual money at the same live prices. Charts, drawing tools, market, limit and stop orders."
        actions={
          <Link href="/dashboard/trading" className="inline-flex min-h-11 items-center rounded-full border border-border/60 bg-surface-1/75 px-5 text-sm font-medium text-foreground backdrop-blur-xl transition-[border-color,background-color,transform] duration-200 hover:border-border hover:bg-foreground/[0.06] motion-safe:hover:-translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background">
            All trading modes
          </Link>
        }
      />
      <div className="mt-6">
        <MarketTerminal />
      </div>
    </PageShell>
  );
}
