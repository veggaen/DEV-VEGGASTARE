"use client";

import { use } from "react";
import { TradeModal } from "@/components/crypto-related/TradeModal";

interface TradeInterceptedPageProps {
  params: Promise<{ tradeId: string }>;
}

export default function TradeInterceptedPage({ params }: TradeInterceptedPageProps) {
  const { tradeId } = use(params);
  return <TradeModal tradeId={tradeId} />;
}
