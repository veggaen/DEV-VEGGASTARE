"use client";

/**
 * @fileOverview  PaperSwapPanel — buy, sell, or swap tokens using virtual USD
 *               at real market prices via CoinGecko. Looks like a DEX swap UI.
 * @stability     experimental
 */

import React, { useState, useCallback, useEffect, useTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  FiArrowDown,
  FiRefreshCw,
  FiDollarSign,
  FiTrendingUp,
  FiTrendingDown,
} from "react-icons/fi";
import { paperBuy, paperSell, paperSwap } from "@/actions/paper-trade";

// ── Supported tokens for paper trading ──────────────────────
const PAPER_TOKENS = [
  { symbol: "ETH", name: "Ethereum", decimals: 18, chainId: 1, address: "0x0", color: "#627EEA" },
  { symbol: "BTC", name: "Bitcoin", decimals: 8, chainId: 1, address: "0x0", color: "#F7931A" },
  { symbol: "SOL", name: "Solana", decimals: 9, chainId: 1, address: "0x0", color: "#9945FF" },
  { symbol: "USDC", name: "USD Coin", decimals: 6, chainId: 1, address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", color: "#2775CA" },
  { symbol: "USDT", name: "Tether", decimals: 6, chainId: 1, address: "0xdAC17F958D2ee523a2206206994597C13D831ec7", color: "#50AF95" },
  { symbol: "LINK", name: "Chainlink", decimals: 18, chainId: 1, address: "0x514910771AF9Ca656af840dff83E8264EcF986CA", color: "#2A5ADA" },
  { symbol: "UNI", name: "Uniswap", decimals: 18, chainId: 1, address: "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984", color: "#FF007A" },
  { symbol: "AAVE", name: "Aave", decimals: 18, chainId: 1, address: "0x0", color: "#B6509E" },
  { symbol: "ARB", name: "Arbitrum", decimals: 18, chainId: 42161, address: "0x0", color: "#28A0F0" },
  { symbol: "OP", name: "Optimism", decimals: 18, chainId: 10, address: "0x0", color: "#FF0420" },
  { symbol: "MATIC", name: "Polygon", decimals: 18, chainId: 137, address: "0x0", color: "#8247E5" },
  { symbol: "DOGE", name: "Dogecoin", decimals: 8, chainId: 1, address: "0x0", color: "#C2A633" },
  { symbol: "AVAX", name: "Avalanche", decimals: 18, chainId: 1, address: "0x0", color: "#E84142" },
  { symbol: "DOT", name: "Polkadot", decimals: 10, chainId: 1, address: "0x0", color: "#E6007A" },
  { symbol: "HEX", name: "HEX", decimals: 8, chainId: 1, address: "0x2b591e99afE9f32eAA6214f7B7629768c40Eeb39", color: "#FF00FF" },
  { symbol: "PLS", name: "PulseChain", decimals: 18, chainId: 369, address: "0x0", color: "#00FF00" },
  { symbol: "XRP", name: "Ripple", decimals: 6, chainId: 1, address: "0x0", color: "#23292F" },
  { symbol: "ADA", name: "Cardano", decimals: 6, chainId: 1, address: "0x0", color: "#0033AD" },
  { symbol: "ATOM", name: "Cosmos", decimals: 6, chainId: 1, address: "0x0", color: "#2E3148" },
  { symbol: "NEAR", name: "NEAR Protocol", decimals: 24, chainId: 1, address: "0x0", color: "#00C1DE" },
  { symbol: "FTM", name: "Fantom", decimals: 18, chainId: 250, address: "0x0", color: "#1969FF" },
  { symbol: "PEPE", name: "Pepe", decimals: 18, chainId: 1, address: "0x0", color: "#3D7B30" },
  { symbol: "SHIB", name: "Shiba Inu", decimals: 18, chainId: 1, address: "0x0", color: "#FFA409" },
  { symbol: "WLD", name: "Worldcoin", decimals: 18, chainId: 1, address: "0x0", color: "#000000" },
  { symbol: "SUI", name: "Sui", decimals: 9, chainId: 1, address: "0x0", color: "#4DA2FF" },
  { symbol: "APT", name: "Aptos", decimals: 8, chainId: 1, address: "0x0", color: "#06C8A4" },
  { symbol: "INJ", name: "Injective", decimals: 18, chainId: 1, address: "0x0", color: "#00F2FE" },
  { symbol: "TIA", name: "Celestia", decimals: 6, chainId: 1, address: "0x0", color: "#7B2FBE" },
  { symbol: "SEI", name: "Sei", decimals: 6, chainId: 1, address: "0x0", color: "#9B1B30" },
  { symbol: "RENDER", name: "Render", decimals: 18, chainId: 1, address: "0x0", color: "#000000" },
] as const;

/** Searchable token dropdown with icons */
function TokenDropdown({
  tokens,
  selected,
  onSelect,
  onClose,
}: {
  tokens: readonly PaperToken[];
  selected: string;
  onSelect: (t: PaperToken) => void;
  onClose: () => void;
}) {
  const [search, setSearch] = useState("");
  const filtered = tokens.filter(
    (t) =>
      t.symbol.toLowerCase().includes(search.toLowerCase()) ||
      t.name.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <motion.div
      initial={{ opacity: 0, y: -4, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -4, scale: 0.98 }}
      transition={{ duration: 0.12 }}
      className="absolute right-0 top-full mt-1 z-100 w-56 rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl"
    >
      {/* Search input */}
      <div className="sticky top-0 border-b border-zinc-800 bg-zinc-900 p-2">
        <input
          type="text"
          placeholder="Search tokens…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoFocus
          className="w-full rounded-lg bg-zinc-800 px-2.5 py-1.5 text-xs text-zinc-100 placeholder:text-zinc-500 outline-none focus:ring-1 focus:ring-emerald-500/50"
        />
      </div>
      {/* Token list */}
      <div className="max-h-60 overflow-y-auto overscroll-contain">
        {filtered.length === 0 && (
          <div className="py-4 text-center text-xs text-zinc-500">No tokens found</div>
        )}
        {filtered.map((t) => (
          <button
            key={t.symbol}
            type="button"
            onClick={() => {
              onSelect(t);
              onClose();
            }}
            className={`w-full flex items-center gap-2.5 px-3 py-2 text-xs hover:bg-zinc-800 transition-colors ${
              t.symbol === selected
                ? "text-emerald-400 bg-zinc-800/50"
                : "text-zinc-300"
            }`}
          >
            <span
              className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white"
              style={{ backgroundColor: t.color }}
            >
              {t.symbol.charAt(0)}
            </span>
            <span className="font-semibold">{t.symbol}</span>
            <span className="text-zinc-500 truncate">{t.name}</span>
          </button>
        ))}
      </div>
    </motion.div>
  );
}

type PaperToken = (typeof PAPER_TOKENS)[number];

type SwapMode = "buy" | "sell" | "swap";

interface PaperSwapPanelProps {
  cashBalance: number;
  positions: Array<{
    tokenSymbol: string;
    displayAmount: string;
    currentPriceUsd: number;
  }>;
  onTradeComplete: () => void;
}

export function PaperSwapPanel({
  cashBalance,
  positions,
  onTradeComplete,
}: PaperSwapPanelProps) {
  const [mode, setMode] = useState<SwapMode>("buy");
  const [sellToken, setSellToken] = useState<PaperToken>(PAPER_TOKENS[0]); // ETH
  const [buyToken, setBuyToken] = useState<PaperToken>(PAPER_TOKENS[3]); // USDC
  const [amount, setAmount] = useState("");
  const [isPending, startTransition] = useTransition();
  const [sellPrice, setSellPrice] = useState<number | null>(null);
  const [buyPrice, setBuyPrice] = useState<number | null>(null);
  const [showSellDropdown, setShowSellDropdown] = useState(false);
  const [showBuyDropdown, setShowBuyDropdown] = useState(false);

  // Fetch prices when tokens change
  useEffect(() => {
    let cancelled = false;
    async function fetchPrices() {
      try {
        // Only fetch on client
        if (typeof window === "undefined") return;
        const sellRes = await fetch(
          `/api/paper/price?symbol=${sellToken.symbol}`,
        );
        const buyRes = await fetch(
          `/api/paper/price?symbol=${buyToken.symbol}`,
        );
        if (cancelled) return;
        if (sellRes.ok) {
          const d = (await sellRes.json()) as { usd: number };
          setSellPrice(d.usd);
        }
        if (buyRes.ok) {
          const d = (await buyRes.json()) as { usd: number };
          setBuyPrice(d.usd);
        }
      } catch {
        // ok
      }
    }
    fetchPrices();
    const interval = setInterval(fetchPrices, 30_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [sellToken.symbol, buyToken.symbol]);

  const numAmount = parseFloat(amount) || 0;

  // Calculate estimated output
  const estimatedOutput = (() => {
    if (mode === "buy") {
      // Buying token with USD
      if (!sellPrice || sellPrice <= 0) return null;
      // amount = USD to spend, sellToken = what we're buying
      return numAmount / sellPrice;
    }
    if (mode === "sell") {
      // Selling token for USD
      if (!sellPrice || sellPrice <= 0) return null;
      return numAmount * sellPrice;
    }
    // swap
    if (!sellPrice || !buyPrice || sellPrice <= 0 || buyPrice <= 0) return null;
    const usdValue = numAmount * sellPrice;
    const fee = usdValue * 0.003;
    return (usdValue - fee) / buyPrice;
  })();

  const feeEstimate = (() => {
    if (mode === "buy") return numAmount * 0.003;
    if (mode === "sell" && sellPrice) return numAmount * sellPrice * 0.003;
    if (mode === "swap" && sellPrice) return numAmount * sellPrice * 0.003;
    return 0;
  })();

  // Get held position for sell mode
  const heldPosition = positions.find(
    (p) => p.tokenSymbol === sellToken.symbol,
  );

  const handleExecute = useCallback(() => {
    if (numAmount <= 0) {
      toast.error("Enter an amount");
      return;
    }

    startTransition(async () => {
      try {
        if (mode === "buy") {
          const result = await paperBuy({
            tokenSymbol: sellToken.symbol,
            tokenAddress: sellToken.address,
            chainId: sellToken.chainId,
            decimals: sellToken.decimals,
            usdAmount: numAmount,
          });
          if (!result.success) {
            toast.error(result.error);
            return;
          }
          toast.success(
            `Bought ${result.data.tokenAmount} ${sellToken.symbol} @ $${result.data.priceUsd.toFixed(2)}`,
          );
        } else if (mode === "sell") {
          const result = await paperSell({
            tokenSymbol: sellToken.symbol,
            chainId: sellToken.chainId,
            tokenAmount: numAmount,
          });
          if (!result.success) {
            toast.error(result.error);
            return;
          }
          toast.success(
            `Sold for $${result.data.usdReceived.toFixed(2)} @ $${result.data.priceUsd.toFixed(2)}`,
          );
        } else {
          const result = await paperSwap({
            sellSymbol: sellToken.symbol,
            sellChainId: sellToken.chainId,
            sellAmount: numAmount,
            buySymbol: buyToken.symbol,
            buyTokenAddress: buyToken.address,
            buyChainId: buyToken.chainId,
            buyDecimals: buyToken.decimals,
          });
          if (!result.success) {
            toast.error(result.error);
            return;
          }
          toast.success(
            `Swapped → ${result.data.buyAmount} ${buyToken.symbol} (rate: ${result.data.rate.toFixed(4)})`,
          );
        }
        setAmount("");
        onTradeComplete();
      } catch {
        toast.error("Trade failed. Try again.");
      }
    });
  }, [mode, sellToken, buyToken, numAmount, onTradeComplete]);

  const swapTokens = useCallback(() => {
    if (mode === "swap") {
      const tmp = sellToken;
      setSellToken(buyToken);
      setBuyToken(tmp);
      setAmount("");
    }
  }, [mode, sellToken, buyToken]);

  return (
    <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-lg">
      {/* Tab bar */}
      <div className="flex border-b border-zinc-200 dark:border-zinc-800">
        {(["buy", "sell", "swap"] as const).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => {
              setMode(m);
              setAmount("");
            }}
            className={`flex-1 py-2.5 text-xs font-semibold uppercase tracking-wider transition-colors ${
              mode === m
                ? m === "buy"
                  ? "text-emerald-500 border-b-2 border-emerald-500 bg-emerald-500/5"
                  : m === "sell"
                    ? "text-rose-500 border-b-2 border-rose-500 bg-rose-500/5"
                    : "text-sky-500 border-b-2 border-sky-500 bg-sky-500/5"
                : "text-zinc-400 hover:text-zinc-300"
            }`}
          >
            {m === "buy" && <FiTrendingUp className="inline mr-1 h-3 w-3" />}
            {m === "sell" && <FiTrendingDown className="inline mr-1 h-3 w-3" />}
            {m === "swap" && <FiRefreshCw className="inline mr-1 h-3 w-3" />}
            {m}
          </button>
        ))}
      </div>

      <div className="p-4 space-y-3">
        {/* Paper mode badge */}
        <div className="flex items-center gap-1.5 text-[10px] text-amber-500 dark:text-amber-400">
          <span>📝</span>
          <span className="font-medium">Paper Trade</span>
          <span className="text-zinc-500">·</span>
          <span className="text-zinc-400 dark:text-zinc-500">
            Cash: ${cashBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
        </div>

        {/* Input section */}
        <div className="relative">
          <label className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
            {mode === "buy" ? "Spend (USD)" : mode === "sell" ? `Sell (${sellToken.symbol})` : `You Pay (${sellToken.symbol})`}
          </label>
          <div className="mt-1 flex items-center gap-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 px-3 py-2.5">
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              min="0"
              step="any"
              className="flex-1 bg-transparent text-lg font-semibold text-zinc-900 dark:text-zinc-100 placeholder:text-zinc-400 outline-none [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            {mode !== "buy" && (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowSellDropdown(!showSellDropdown)}
                  className="flex items-center gap-1.5 rounded-lg bg-zinc-200 dark:bg-zinc-800 px-2.5 py-1.5 text-xs font-semibold text-zinc-900 dark:text-zinc-100 hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-colors"
                >
                  {sellToken.symbol}
                  <span className="text-[8px] text-zinc-400">▼</span>
                </button>
                <AnimatePresence>
                  {showSellDropdown && (
                    <TokenDropdown
                      tokens={PAPER_TOKENS}
                      selected={sellToken.symbol}
                      onSelect={(t) => setSellToken(t)}
                      onClose={() => setShowSellDropdown(false)}
                    />
                  )}
                </AnimatePresence>
              </div>
            )}
            {mode === "buy" && (
              <div className="flex items-center gap-1 text-zinc-400">
                <FiDollarSign className="h-4 w-4" />
                <span className="text-xs font-medium">USD</span>
              </div>
            )}
          </div>
          {mode === "sell" && heldPosition && (
            <button
              type="button"
              onClick={() => setAmount(heldPosition.displayAmount)}
              className="mt-1 text-[10px] text-zinc-500 hover:text-emerald-400 transition-colors"
            >
              Max: {parseFloat(heldPosition.displayAmount).toFixed(6)} {sellToken.symbol}
            </button>
          )}
        </div>

        {/* Swap direction indicator */}
        {mode === "swap" && (
          <div className="flex justify-center -my-1">
            <button
              type="button"
              onClick={swapTokens}
              className="rounded-full p-1.5 border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
            >
              <FiArrowDown className="h-4 w-4 text-zinc-400" />
            </button>
          </div>
        )}

        {/* Token selector (for buy mode: what to buy / for swap: receive) */}
        {(mode === "buy" || mode === "swap") && (
          <div>
            <label className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
              {mode === "buy" ? "Buy" : "You Receive"}
            </label>
            <div className="mt-1 flex items-center gap-2 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 px-3 py-2.5">
              <div className="flex-1 text-lg font-semibold text-zinc-500 dark:text-zinc-400">
                {estimatedOutput != null
                  ? mode === "buy"
                    ? `≈ ${estimatedOutput.toFixed(6)}`
                    : `≈ ${estimatedOutput.toFixed(6)}`
                  : "—"}
              </div>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => {
                    if (mode === "buy") setShowSellDropdown(!showSellDropdown);
                    else setShowBuyDropdown(!showBuyDropdown);
                  }}
                  className="flex items-center gap-1.5 rounded-lg bg-zinc-200 dark:bg-zinc-800 px-2.5 py-1.5 text-xs font-semibold text-zinc-900 dark:text-zinc-100 hover:bg-zinc-300 dark:hover:bg-zinc-700 transition-colors"
                >
                  {mode === "buy" ? sellToken.symbol : buyToken.symbol}
                  <span className="text-[8px] text-zinc-400">▼</span>
                </button>
                <AnimatePresence>
                  {(mode === "buy" ? showSellDropdown : showBuyDropdown) && (
                    <TokenDropdown
                      tokens={PAPER_TOKENS}
                      selected={mode === "buy" ? sellToken.symbol : buyToken.symbol}
                      onSelect={(t) => {
                        if (mode === "buy") setSellToken(t);
                        else setBuyToken(t);
                      }}
                      onClose={() => {
                        if (mode === "buy") setShowSellDropdown(false);
                        else setShowBuyDropdown(false);
                      }}
                    />
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        )}

        {/* Sell output — USD received */}
        {mode === "sell" && (
          <div>
            <label className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400 uppercase tracking-wider">
              You Receive (USD)
            </label>
            <div className="mt-1 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 px-3 py-2.5">
              <span className="text-lg font-semibold text-zinc-500 dark:text-zinc-400">
                {estimatedOutput != null
                  ? `≈ $${estimatedOutput.toFixed(2)}`
                  : "—"}
              </span>
            </div>
          </div>
        )}

        {/* Trade info */}
        <div className="rounded-lg bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 px-3 py-2 space-y-1">
          <div className="flex justify-between text-[10px]">
            <span className="text-zinc-500">Price</span>
            <span className="text-zinc-300 font-mono">
              {sellPrice != null ? (
                mode === "buy" || mode === "sell"
                  ? `1 ${sellToken.symbol} = $${sellPrice.toLocaleString(undefined, { maximumFractionDigits: 2 })}`
                  : `1 ${sellToken.symbol} = ${sellPrice && buyPrice ? (sellPrice / buyPrice).toFixed(6) : "—"} ${buyToken.symbol}`
              ) : (
                "Loading..."
              )}
            </span>
          </div>
          <div className="flex justify-between text-[10px]">
            <span className="text-zinc-500">Fee (0.3%)</span>
            <span className="text-zinc-400 font-mono">
              ≈ ${feeEstimate.toFixed(2)}
            </span>
          </div>
          <div className="flex justify-between text-[10px]">
            <span className="text-zinc-500">Source</span>
            <span className="text-zinc-400">CoinGecko (live)</span>
          </div>
        </div>

        {/* Execute button */}
        <button
          type="button"
          onClick={handleExecute}
          disabled={isPending || numAmount <= 0}
          className={`w-full rounded-xl py-3 text-sm font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
            mode === "buy"
              ? "bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-500/20"
              : mode === "sell"
                ? "bg-rose-600 hover:bg-rose-500 text-white shadow-lg shadow-rose-500/20"
                : "bg-sky-600 hover:bg-sky-500 text-white shadow-lg shadow-sky-500/20"
          }`}
        >
          {isPending ? (
            <span className="flex items-center justify-center gap-2">
              <FiRefreshCw className="h-4 w-4 animate-spin" />
              Executing...
            </span>
          ) : (
            <>
              {mode === "buy" && `Buy ${sellToken.symbol}`}
              {mode === "sell" && `Sell ${sellToken.symbol}`}
              {mode === "swap" && `Swap ${sellToken.symbol} → ${buyToken.symbol}`}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
