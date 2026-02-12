"use client";

import { use } from "react";
import { TradeModal } from "@/components/crypto-related/TradeModal";

interface TradeFullPageProps {
  params: Promise<{ tradeId: string }>;
}

export default function TradeFullPage({ params }: TradeFullPageProps) {
  const { tradeId } = use(params);
  return (
    <div className="flex items-center justify-center min-h-screen bg-zinc-50 dark:bg-zinc-950 p-4">
      <TradeModal tradeId={tradeId} isFullPage />
    </div>
  );
}
