"use client";

import React, { useState, useCallback } from "react";
import { AnimatePresence } from "framer-motion";
import { CryptoInventory } from "@/components/crypto-related/CryptoInventory";
import { TradeWindow, type TradePartner } from "@/components/crypto-related/TradeWindow";
import { useAccount } from "wagmi";
import { FiPackage, FiAlertCircle } from "react-icons/fi";

export default function InventoryPage() {
  const { isConnected } = useAccount();
  const [tradePartner, setTradePartner] = useState<TradePartner | null>(null);
  const [activeTradeId, setActiveTradeId] = useState<string | null>(null);

  const handleTradeRequest = useCallback(
    (userId: string) => {
      // When triggered from inventory context, we only have userId
      // Fetch partner details or set minimal info
      setTradePartner({ id: userId, name: null, image: null });
    },
    []
  );

  const handleCloseTradeWindow = useCallback(() => {
    setTradePartner(null);
    setActiveTradeId(null);
  }, []);

  if (!isConnected) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-4">
        <FiAlertCircle className="h-12 w-12 text-zinc-400 mb-4" />
        <h2 className="text-lg font-semibold text-zinc-800 dark:text-zinc-200 mb-1">
          Wallet Not Connected
        </h2>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 text-center max-w-sm">
          Connect your wallet from the sidebar to view your token inventory.
        </p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-5xl mx-auto p-4 sm:p-6 lg:p-8">
      <div className="flex items-center gap-3 mb-6">
        <FiPackage className="h-6 w-6 text-emerald-500" />
        <div>
          <h1 className="text-xl font-bold text-zinc-800 dark:text-zinc-200">
            Token Inventory
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Your BROWSERGAME-style crypto bag — switch chains, split stacks, and trade with others
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        {/* Main inventory */}
        <CryptoInventory
          tradeMode={!!tradePartner}
          onTradeRequest={handleTradeRequest}
        />

        {/* Trade Window (slides in) */}
        <AnimatePresence mode="wait">
          {tradePartner && (
            <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden min-h-[400px]">
              <TradeWindow
                partner={tradePartner}
                tradeId={activeTradeId ?? undefined}
                onClose={handleCloseTradeWindow}
                onComplete={(id) => {
                  setActiveTradeId(null);
                  setTradePartner(null);
                }}
              />
            </div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
