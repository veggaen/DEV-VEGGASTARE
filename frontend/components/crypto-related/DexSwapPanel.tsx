"use client";

/**
 * @fileOverview  DexSwapPanel — Full DEX swap interface powered by KyberSwap Aggregator.
 *
 *   Features:
 *     - Bidirectional input: type sell OR buy amount
 *     - Dynamic token search: 6 000+ tokens from KyberSwap, search by name,
 *       symbol, or paste an address
 *     - Route visualization showing which DEXes the swap routes through
 *     - Price impact gauge with visual severity indicator
 *     - Toggleable rate direction display
 *     - 15-second auto-refresh quotes
 *
 *   Layout:
 *     ┌─ Header ──────────────────────────────────────────┐
 *     │  DEX Swap          KyberSwap  │  ⚙ Settings       │
 *     ├───────────────────────────────────────────────────┤
 *     │  ┌─ Sell ─────────────────────────────────────┐   │
 *     │  │ [Token ▼]          [Amount      ]  [MAX]   │   │
 *     │  │ Balance: 1.234 ETH                         │   │
 *     │  └────────────────────────────────────────────┘   │
 *     │                  ↕ swap arrow                     │
 *     │  ┌─ Buy ──────────────────────────────────────┐   │
 *     │  │ [Token ▼]          [Amount      ]          │   │
 *     │  │ (editable — type desired buy amount)       │   │
 *     │  └────────────────────────────────────────────┘   │
 *     │                                                   │
 *     │  ┌─ Quote Details ────────────────────────────┐   │
 *     │  │ Rate • Impact gauge • Gas • Route chips    │   │
 *     │  └────────────────────────────────────────────┘   │
 *     │                                                   │
 *     │  [          Swap Now          ]                   │
 *     └───────────────────────────────────────────────────┘
 *
 * @stability experimental
 */

import React, { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAccount, useChainId } from "wagmi";
import { parseUnits, formatUnits } from "viem";
import { useTokenBalances, type InventoryToken } from "@/hooks/use-token-balances";
import {
  useDexSwap,
  type DexSwapStep,
} from "@/hooks/use-dex-swap";
import {
  FiChevronDown,
  FiArrowDown,
  FiSettings,
  FiCheckCircle,
  FiAlertTriangle,
  FiLoader,
  FiX,
  FiExternalLink,
  FiRefreshCw,
  FiZap,
  FiShield,
  FiSearch,
} from "react-icons/fi";
import { Repeat } from "lucide-react";
import { TokenIcon } from "@/components/ui/token-icon";
import { getExplorerTxUrl } from "@/lib/token-icons";

// ── Types ───────────────────────────────────────────────────────────────────

/** Token metadata returned by /api/dex/tokens */
interface ApiToken {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  logoURI?: string;
}

// ── Constants ───────────────────────────────────────────────────────────────

const NATIVE_TOKEN_ADDRESS = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";

/** Well-known buyable tokens per chain (quick-access popular tokens) */
const BUYABLE_TOKENS: Record<number, Array<{ address: string; symbol: string; decimals: number }>> = {
  1: [
    { address: NATIVE_TOKEN_ADDRESS, symbol: "ETH", decimals: 18 },
    { address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", symbol: "USDC", decimals: 6 },
    { address: "0xdAC17F958D2ee523a2206206994597C13D831ec7", symbol: "USDT", decimals: 6 },
    { address: "0x6B175474E89094C44Da98b954EedeAC495271d0F", symbol: "DAI", decimals: 18 },
    { address: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", symbol: "WBTC", decimals: 8 },
    { address: "0x514910771AF9Ca656af840dff83E8264EcF986CA", symbol: "LINK", decimals: 18 },
    { address: "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984", symbol: "UNI", decimals: 18 },
  ],
  137: [
    { address: NATIVE_TOKEN_ADDRESS, symbol: "MATIC", decimals: 18 },
    { address: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174", symbol: "USDC", decimals: 6 },
    { address: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F", symbol: "USDT", decimals: 6 },
    { address: "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063", symbol: "DAI", decimals: 18 },
  ],
  42161: [
    { address: NATIVE_TOKEN_ADDRESS, symbol: "ETH", decimals: 18 },
    { address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", symbol: "USDC", decimals: 6 },
    { address: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9", symbol: "USDT", decimals: 6 },
    { address: "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1", symbol: "DAI", decimals: 18 },
  ],
  10: [
    { address: NATIVE_TOKEN_ADDRESS, symbol: "ETH", decimals: 18 },
    { address: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85", symbol: "USDC", decimals: 6 },
    { address: "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58", symbol: "USDT", decimals: 6 },
    { address: "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1", symbol: "DAI", decimals: 18 },
  ],
  8453: [
    { address: NATIVE_TOKEN_ADDRESS, symbol: "ETH", decimals: 18 },
    { address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", symbol: "USDC", decimals: 6 },
    { address: "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb", symbol: "DAI", decimals: 18 },
  ],
  56: [
    { address: NATIVE_TOKEN_ADDRESS, symbol: "BNB", decimals: 18 },
    { address: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d", symbol: "USDC", decimals: 18 },
    { address: "0x55d398326f99059fF775485246999027B3197955", symbol: "USDT", decimals: 18 },
  ],
  43114: [
    { address: NATIVE_TOKEN_ADDRESS, symbol: "AVAX", decimals: 18 },
    { address: "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E", symbol: "USDC", decimals: 6 },
    { address: "0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7", symbol: "USDT", decimals: 6 },
  ],
  250: [
    { address: NATIVE_TOKEN_ADDRESS, symbol: "FTM", decimals: 18 },
    { address: "0x04068DA6C83AFCFA0e13ba15A6696662335D5B75", symbol: "USDC", decimals: 6 },
    { address: "0x049d68029688eAbF473097a2fC38ef61633A3C7A", symbol: "USDT", decimals: 6 },
  ],
  59144: [
    { address: NATIVE_TOKEN_ADDRESS, symbol: "ETH", decimals: 18 },
    { address: "0x176211869cA2b568f2A7D4EE941E073a821EE1ff", symbol: "USDC", decimals: 6 },
  ],
  534352: [
    { address: NATIVE_TOKEN_ADDRESS, symbol: "ETH", decimals: 18 },
    { address: "0x06eFdBFf2a14a7c8E15944D1F4A48F9F95F663A4", symbol: "USDC", decimals: 6 },
  ],
  324: [
    { address: NATIVE_TOKEN_ADDRESS, symbol: "ETH", decimals: 18 },
    { address: "0x1d17CBcF0D6D143135aE902365D2E5e2A16538D4", symbol: "USDC", decimals: 6 },
  ],
};

/** Supported chains for KyberSwap aggregator */
const SUPPORTED_CHAIN_IDS = new Set([1, 137, 42161, 10, 8453, 56, 43114, 250, 59144, 534352, 324]);

const SLIPPAGE_OPTIONS = [
  { label: "0.1%", bps: 10 },
  { label: "0.5%", bps: 50 },
  { label: "1.0%", bps: 100 },
  { label: "3.0%", bps: 300 },
];

/** Step labels for the swap flow */
const STEP_LABELS: Record<DexSwapStep, string> = {
  idle: "",
  quoting: "Getting best price…",
  quoted: "Quote ready",
  approving: "Approve in wallet…",
  sending: "Confirm swap in wallet…",
  confirming: "Confirming on-chain…",
  success: "Swap complete!",
  error: "Swap failed",
};

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Check if a string looks like an Ethereum address */
function isEthAddress(s: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(s);
}

/** Search filter: match by symbol, name, or address */
function matchesSearch(
  token: { symbol: string; address: string; name?: string },
  query: string,
): boolean {
  if (!query) return true;
  const q = query.toLowerCase().trim();
  if (token.symbol.toLowerCase().includes(q)) return true;
  if (token.name?.toLowerCase().includes(q)) return true;
  if (isEthAddress(q) && token.address.toLowerCase() === q) return true;
  if (q.length > 4 && token.address.toLowerCase().includes(q)) return true;
  return false;
}

// ── Main Component ──────────────────────────────────────────────────────────

export function DexSwapPanel() {
  const { isConnected, address } = useAccount();
  const chainId = useChainId();
  const { tokens, loading: tokensLoading } = useTokenBalances();
  const {
    step,
    error,
    quote,
    result,
    getQuote,
    executeSwap,
    reset,
    isLoading,
  } = useDexSwap();

  // ── State ─────────────────────────────────────────────────
  const [sellToken, setSellToken] = useState<InventoryToken | null>(null);
  const [buyTokenAddr, setBuyTokenAddr] = useState<string>("");
  const [sellAmount, setSellAmount] = useState("");
  const [buyAmount, setBuyAmount] = useState("");
  const [inputSide, setInputSide] = useState<"sell" | "buy">("sell");
  const [slippageBps, setSlippageBps] = useState(50);
  const [showSettings, setShowSettings] = useState(false);
  const [showSellPicker, setShowSellPicker] = useState(false);
  const [showBuyPicker, setShowBuyPicker] = useState(false);
  const [sellSearch, setSellSearch] = useState("");
  const [buySearch, setBuySearch] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [showInverseRate, setShowInverseRate] = useState(false);

  // Dynamic token list from API
  const [dynamicTokens, setDynamicTokens] = useState<ApiToken[]>([]);
  const [loadingTokens, setLoadingTokens] = useState(false);

  // Ref to prevent quote loops when syncing amounts
  const skipNextQuote = useRef(false);

  const isSupported = SUPPORTED_CHAIN_IDS.has(chainId);

  // ── Derived data ──────────────────────────────────────────

  /** Hardcoded popular tokens for current chain */
  const buyableTokens = useMemo(
    () => BUYABLE_TOKENS[chainId] ?? [],
    [chainId],
  );

  /** Selected buy token metadata (resolved from hardcoded + dynamic list) */
  const selectedBuyToken = useMemo(() => {
    if (!buyTokenAddr) return undefined;
    const addr = buyTokenAddr.toLowerCase();
    const hardcoded = buyableTokens.find((t) => t.address.toLowerCase() === addr);
    if (hardcoded) return hardcoded;
    const dynamic = dynamicTokens.find((t) => t.address.toLowerCase() === addr);
    if (dynamic) return { address: dynamic.address, symbol: dynamic.symbol, decimals: dynamic.decimals };
    return undefined;
  }, [buyableTokens, dynamicTokens, buyTokenAddr]);

  /** Merged token list for buy picker: popular first, then dynamic (deduplicated) */
  const mergedBuyTokens = useMemo(() => {
    const seen = new Set(buyableTokens.map((t) => t.address.toLowerCase()));
    const merged = buyableTokens.map((t) => ({
      address: t.address,
      symbol: t.symbol,
      name: t.symbol,
      decimals: t.decimals,
      logoURI: undefined as string | undefined,
      isPopular: true,
    }));
    for (const dt of dynamicTokens) {
      if (!seen.has(dt.address.toLowerCase())) {
        seen.add(dt.address.toLowerCase());
        merged.push({
          address: dt.address,
          symbol: dt.symbol,
          name: dt.name,
          decimals: dt.decimals,
          logoURI: dt.logoURI,
          isPopular: false,
        });
      }
    }
    return merged;
  }, [buyableTokens, dynamicTokens]);

  // ── Effects ───────────────────────────────────────────────

  // Reset selections when chain changes
  useEffect(() => {
    setSellToken(null);
    setBuyTokenAddr("");
    setSellAmount("");
    setBuyAmount("");
    setInputSide("sell");
    reset();
  }, [chainId, reset]);

  // Auto-select first sell token from inventory if none selected
  useEffect(() => {
    if (!sellToken && tokens.length > 0) {
      setSellToken(tokens[0]);
    }
  }, [sellToken, tokens]);

  // Auto-select first buy token if none selected (pick a different token than sell)
  useEffect(() => {
    if (!buyTokenAddr && buyableTokens.length > 0 && sellToken) {
      const diff = buyableTokens.find(
        (t) => t.address.toLowerCase() !== (sellToken.isNative ? NATIVE_TOKEN_ADDRESS : sellToken.address).toLowerCase(),
      );
      if (diff) setBuyTokenAddr(diff.address);
      else if (buyableTokens[0]) setBuyTokenAddr(buyableTokens[0].address);
    }
  }, [buyTokenAddr, buyableTokens, sellToken]);

  // Fetch dynamic token list from API when chain changes
  useEffect(() => {
    if (!isSupported) return;
    let cancelled = false;
    setLoadingTokens(true);
    fetch(`/api/dex/tokens?chainId=${chainId}`)
      .then((res) => res.json())
      .then((data: { tokens?: ApiToken[] }) => {
        if (!cancelled && data.tokens) setDynamicTokens(data.tokens);
      })
      .catch((err) => console.warn("[DexSwapPanel] Token list fetch failed:", err))
      .finally(() => { if (!cancelled) setLoadingTokens(false); });
    return () => { cancelled = true; };
  }, [chainId, isSupported]);

  // ── Auto-quote with debounce (bidirectional) ──────────────
  useEffect(() => {
    if (skipNextQuote.current) {
      skipNextQuote.current = false;
      return;
    }

    const amount = inputSide === "sell" ? sellAmount : buyAmount;
    if (!sellToken || !buyTokenAddr || !amount || parseFloat(amount) <= 0 || !isSupported) return;

    // For buy-side input: swap tokens in query to get the reverse rate
    const fromToken = inputSide === "sell"
      ? (sellToken.isNative ? NATIVE_TOKEN_ADDRESS : sellToken.address)
      : buyTokenAddr;
    const toToken = inputSide === "sell"
      ? buyTokenAddr
      : (sellToken.isNative ? NATIVE_TOKEN_ADDRESS : sellToken.address);
    const fromDecimals = inputSide === "sell"
      ? sellToken.decimals
      : (selectedBuyToken?.decimals ?? 18);

    const timeout = window.setTimeout(() => {
      try {
        const parsed = parseUnits(amount, fromDecimals);
        if (!(parsed > BigInt(0))) return;

        getQuote({
          chainId,
          sellToken: fromToken,
          buyToken: toToken,
          sellAmount: parsed.toString(),
          taker: address,
          slippageBps,
        });
      } catch {
        // invalid amount — ignore
      }
    }, 600);

    return () => window.clearTimeout(timeout);
  }, [inputSide, sellToken, buyTokenAddr, sellAmount, buyAmount, slippageBps, chainId, address, isSupported, getQuote, refreshKey, selectedBuyToken]);

  // ── Sync the non-active amount from quote result ──────────
  useEffect(() => {
    if (!quote || step !== "quoted") return;
    skipNextQuote.current = true;

    if (inputSide === "sell" && selectedBuyToken) {
      try {
        setBuyAmount(formatUnits(BigInt(quote.buyAmount), selectedBuyToken.decimals));
      } catch { /* ignore parse errors */ }
    } else if (inputSide === "buy" && sellToken) {
      try {
        // Reversed query: buyAmount is how much sellToken we need
        setSellAmount(formatUnits(BigInt(quote.buyAmount), sellToken.decimals));
      } catch { /* ignore parse errors */ }
    }
  }, [quote, step, inputSide, selectedBuyToken, sellToken]);

  // ── Auto-refresh price every 15s when quoted ──────────────
  useEffect(() => {
    if (step !== "quoted" || !sellToken || !buyTokenAddr) return;
    const amount = inputSide === "sell" ? sellAmount : buyAmount;
    if (!amount) return;
    const timer = setTimeout(() => setRefreshKey((k) => k + 1), 15_000);
    return () => clearTimeout(timer);
  }, [step, refreshKey, sellToken, buyTokenAddr, sellAmount, buyAmount, inputSide]);

  // ── Log successful swaps to TradeRecord (fire-and-forget) ────
  const recordedTxRef = useRef<string | null>(null);
  useEffect(() => {
    if (step !== "success" || !result || !sellToken || !selectedBuyToken || !address) return;
    // Deduplicate — don't re-record the same tx if component re-renders
    if (recordedTxRef.current === result.txHash) return;
    recordedTxRef.current = result.txHash;

    const payload = {
      mode: "DEX" as const,
      sellToken: sellToken.symbol,
      sellTokenAddress: sellToken.isNative ? NATIVE_TOKEN_ADDRESS : sellToken.address,
      sellAmount: result.sellAmount,
      sellDisplayAmt: sellAmount || formatUnits(BigInt(result.sellAmount), sellToken.decimals),
      sellDecimals: sellToken.decimals,
      sellChainId: chainId,
      buyToken: selectedBuyToken.symbol,
      buyTokenAddress: selectedBuyToken.address,
      buyAmount: result.buyAmount,
      buyDisplayAmt: buyAmount || formatUnits(BigInt(result.buyAmount), selectedBuyToken.decimals),
      buyDecimals: selectedBuyToken.decimals,
      buyChainId: chainId,
      txHash: result.txHash,
      walletAddress: address,
      priceSource: "kyberswap",
      environment: "MAINNET" as const,
      metadata: {
        quote: quote ? {
          price: quote.price,
          estimatedGas: quote.estimatedGas,
          sources: quote.sources,
          estimatedPriceImpact: quote.estimatedPriceImpact,
        } : undefined,
        slippageBps,
      },
    };

    fetch("/api/trades/record", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }).catch(() => { /* silent — trade already executed, record is best-effort */ });
  }, [step, result, sellToken, selectedBuyToken, address, chainId, sellAmount, buyAmount, quote, slippageBps]);

  // ── Handlers ──────────────────────────────────────────────
  const handleMaxAmount = useCallback(() => {
    if (!sellToken) return;
    setInputSide("sell");
    if (sellToken.isNative) {
      const raw = sellToken.rawBalance;
      const reserve = parseUnits("0.005", 18); // keep ~0.005 for gas
      const usable = raw > reserve ? raw - reserve : BigInt("0");
      setSellAmount(formatUnits(usable, sellToken.decimals));
    } else {
      setSellAmount(formatUnits(sellToken.rawBalance, sellToken.decimals));
    }
  }, [sellToken]);

  const handleFlipTokens = useCallback(() => {
    if (!sellToken || !selectedBuyToken) return;

    // Find the buy token in inventory
    const buyInInventory = tokens.find(
      (t) =>
        selectedBuyToken.address.toLowerCase() === NATIVE_TOKEN_ADDRESS.toLowerCase()
          ? t.isNative && t.chainId === chainId
          : t.address.toLowerCase() === selectedBuyToken.address.toLowerCase(),
    );

    const newSellAddr = sellToken.isNative
      ? NATIVE_TOKEN_ADDRESS
      : sellToken.address;

    if (buyInInventory) {
      setSellToken(buyInInventory);
    }
    setBuyTokenAddr(newSellAddr);
    setSellAmount("");
    setBuyAmount("");
    setInputSide("sell");
    reset();
  }, [sellToken, selectedBuyToken, tokens, chainId, reset]);

  const handleSwap = useCallback(() => {
    if (!sellToken || !buyTokenAddr || !address || !sellAmount) return;

    const rawSell = sellToken.isNative
      ? NATIVE_TOKEN_ADDRESS
      : sellToken.address;

    try {
      const parsed = parseUnits(sellAmount, sellToken.decimals);
      if (!(parsed > BigInt(0))) return;

      executeSwap({
        chainId,
        sellToken: rawSell,
        buyToken: buyTokenAddr,
        sellAmount: parsed.toString(),
        taker: address,
        slippageBps,
      });
    } catch {
      // invalid amount
    }
  }, [sellToken, buyTokenAddr, address, sellAmount, chainId, slippageBps, executeSwap]);

  const handleNewSwap = useCallback(() => {
    setSellAmount("");
    setBuyAmount("");
    setInputSide("sell");
    reset();
  }, [reset]);

  // ── Computed values ───────────────────────────────────────

  /** Rate: 1 sellToken = ? buyToken */
  const rate = useMemo(() => {
    if (!quote || !sellToken || !selectedBuyToken) return null;
    try {
      let sellVal: number;
      let buyVal: number;
      if (inputSide === "sell") {
        sellVal = Number(formatUnits(BigInt(quote.sellAmount), sellToken.decimals));
        buyVal = Number(formatUnits(BigInt(quote.buyAmount), selectedBuyToken.decimals));
      } else {
        // Reversed query: quote.sellAmount = buyToken amount, quote.buyAmount = sellToken amount
        buyVal = Number(formatUnits(BigInt(quote.sellAmount), selectedBuyToken.decimals));
        sellVal = Number(formatUnits(BigInt(quote.buyAmount), sellToken.decimals));
      }
      if (sellVal <= 0) return null;
      return (buyVal / sellVal).toFixed(6);
    } catch {
      return null;
    }
  }, [quote, sellToken, selectedBuyToken, inputSide]);

  /** Inverse rate: 1 buyToken = ? sellToken */
  const inverseRate = useMemo(() => {
    if (!rate) return null;
    const r = parseFloat(rate);
    if (r <= 0) return null;
    return (1 / r).toFixed(6);
  }, [rate]);

  const canSwap =
    !!sellToken &&
    !!buyTokenAddr &&
    !!sellAmount &&
    parseFloat(sellAmount) > 0 &&
    step === "quoted" &&
    !!address;

  // ── Not connected state ───────────────────────────────────
  if (!isConnected) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-8 text-center">
        <Repeat className="h-10 w-10 text-sky-500/40 mx-auto mb-3" />
        <h3 className="text-sm font-semibold text-zinc-200 mb-1">DEX Swap</h3>
        <p className="text-xs text-zinc-500">
          Connect a wallet to swap tokens via DEX aggregator.
        </p>
      </div>
    );
  }

  // ── Unsupported chain state ───────────────────────────────
  if (!isSupported) {
    return (
      <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-8 text-center">
        <FiAlertTriangle className="h-10 w-10 text-amber-500/40 mx-auto mb-3" />
        <h3 className="text-sm font-semibold text-zinc-200 mb-1">
          Unsupported Chain
        </h3>
        <p className="text-xs text-zinc-500">
          DEX swaps are available on Ethereum, Polygon, Arbitrum, Optimism, Base,
          BSC, Avalanche, Fantom, Linea, Scroll, and zkSync. Switch to a supported chain.
        </p>
      </div>
    );
  }

  // ── Swap success state ────────────────────────────────────
  if (step === "success" && result) {
    return (
      <div className="rounded-2xl border border-sky-500/20 bg-zinc-950 overflow-hidden">
        <div className="px-4 py-3 border-b border-zinc-800 flex items-center gap-2">
          <Repeat className="h-4 w-4 text-sky-400" />
          <h3 className="text-sm font-semibold text-zinc-200">DEX Swap</h3>
        </div>
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-6 flex flex-col items-center text-center"
        >
          <motion.div
            className="relative mb-4"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
          >
            <motion.div
              className="absolute inset-0 rounded-full bg-emerald-400/20"
              animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
            <div className="relative h-16 w-16 rounded-full bg-emerald-900/30 flex items-center justify-center">
              <FiCheckCircle className="h-8 w-8 text-emerald-500" />
            </div>
          </motion.div>

          <h3 className="text-base font-bold text-zinc-200 mb-1">
            Swap Complete!
          </h3>
          <p className="text-xs text-zinc-400 mb-3">
            {sellToken?.symbol ?? "Token"} → {selectedBuyToken?.symbol ?? "Token"}
          </p>

          <div className="w-full max-w-xs rounded-lg border border-zinc-800 bg-zinc-900/60 p-3 space-y-1.5 text-[11px]">
            <div className="flex justify-between">
              <span className="text-red-400">Sold</span>
              <span className="text-zinc-200 font-mono">
                {sellAmount} {sellToken?.symbol}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-emerald-400">Received</span>
              <span className="text-zinc-200 font-mono">
                ≈{buyAmount ? Number(buyAmount).toFixed(6) : "—"}{" "}
                {selectedBuyToken?.symbol}
              </span>
            </div>
            <div className="flex justify-between pt-1 border-t border-zinc-800">
              <span className="text-zinc-500">Tx</span>
              <a
                href={getExplorerTxUrl(chainId, result.txHash)}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sky-400 hover:text-sky-300 font-mono flex items-center gap-1"
              >
                {result.txHash.slice(0, 8)}…{result.txHash.slice(-6)}
                <FiExternalLink className="h-2.5 w-2.5" />
              </a>
            </div>
          </div>

          <button
            type="button"
            onClick={handleNewSwap}
            className="mt-4 flex items-center gap-2 px-4 py-2 rounded-xl bg-sky-500/10 border border-sky-500/30 text-sm font-semibold text-sky-400 hover:bg-sky-500/20 transition-colors"
          >
            <FiRefreshCw className="h-3.5 w-3.5" />
            New Swap
          </button>
        </motion.div>
      </div>
    );
  }

  // ── Main swap UI ──────────────────────────────────────────
  return (
    <div className="rounded-2xl border border-sky-500/20 bg-zinc-950">
      {/* ── Header ──────────────────────────────────── */}
      <div className="px-4 py-3 border-b border-zinc-800 flex items-center justify-between rounded-t-2xl">
        <div className="flex items-center gap-2">
          <Repeat className="h-4 w-4 text-sky-400" />
          <h3 className="text-sm font-semibold text-zinc-200">DEX Swap</h3>
          <span className="inline-flex items-center rounded-full border border-sky-500/30 bg-sky-500/10 px-1.5 py-0.5 text-[9px] font-semibold text-sky-400 uppercase tracking-wider">
            KyberSwap
          </span>
        </div>
        <button
          type="button"
          onClick={() => setShowSettings(!showSettings)}
          className={`p-1.5 rounded-lg transition-colors ${
            showSettings
              ? "bg-sky-500/10 text-sky-400"
              : "text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800"
          }`}
        >
          <FiSettings className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* ── Settings (slippage) ─────────────────────── */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-b border-zinc-800"
          >
            <div className="px-4 py-3 bg-zinc-900/30 space-y-2">
              <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold">
                Slippage Tolerance
              </span>
              <div className="flex items-center gap-1.5">
                {SLIPPAGE_OPTIONS.map((opt) => (
                  <button
                    key={opt.bps}
                    type="button"
                    onClick={() => setSlippageBps(opt.bps)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold border transition-all ${
                      slippageBps === opt.bps
                        ? "border-sky-500/60 bg-sky-500/10 text-sky-300"
                        : "border-zinc-700 text-zinc-500 hover:text-zinc-300 hover:border-zinc-600"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Swap Body ───────────────────────────────── */}
      <div className="p-4 space-y-2">
        {/* ─── SELL panel ──────────────────────────── */}
        <div className={`rounded-xl border ${inputSide === "sell" ? "border-sky-500/30" : "border-zinc-800"} bg-zinc-900/40 p-3 space-y-2 transition-colors`}>
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold">
              Sell
            </span>
            {sellToken && (
              <span className="text-[10px] text-zinc-500">
                Balance:{" "}
                <span className="text-zinc-400 font-mono">
                  {sellToken.displayBalance}
                </span>
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {/* Token selector */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setShowSellPicker(!showSellPicker);
                  setShowBuyPicker(false);
                  setSellSearch("");
                }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-800 border border-zinc-700 text-sm font-semibold text-zinc-200 hover:border-zinc-600 transition-all min-w-25"
              >
                {sellToken && (
                  <TokenIcon
                    address={sellToken.address}
                    chainId={sellToken.chainId}
                    symbol={sellToken.symbol}
                    logo={sellToken.logo}
                    size={20}
                  />
                )}
                <span>{sellToken?.symbol ?? "Select"}</span>
                <FiChevronDown className="h-3 w-3 text-zinc-400 ml-auto" />
              </button>

              {/* Sell token picker dropdown */}
              <AnimatePresence>
                {showSellPicker && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="absolute top-[calc(100%+4px)] left-0 z-100 w-72 rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl max-h-80 flex flex-col"
                  >
                    <div className="px-3 py-1.5 text-[9px] uppercase tracking-widest text-zinc-600 bg-zinc-950/50 rounded-t-xl">
                      Your Tokens
                    </div>
                    {/* Search input */}
                    <div className="px-2 py-1.5 border-b border-zinc-800">
                      <div className="flex items-center gap-1.5 rounded-lg bg-zinc-800/60 px-2 py-1">
                        <FiSearch className="h-3 w-3 text-zinc-500 shrink-0" />
                        <input
                          type="text"
                          value={sellSearch}
                          onChange={(e) => setSellSearch(e.target.value)}
                          placeholder="Search by name or symbol…"
                          className="flex-1 bg-transparent text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none"
                          autoFocus
                        />
                      </div>
                    </div>
                    <div className="overflow-y-auto flex-1">
                      {tokens.filter((t) => matchesSearch(t, sellSearch)).length === 0 && (
                        <p className="px-3 py-4 text-[11px] text-zinc-500 italic text-center">
                          No tokens found in your wallet
                        </p>
                      )}
                      {tokens
                        .filter((t) => matchesSearch(t, sellSearch))
                        .map((token) => (
                        <button
                          key={token.id}
                          type="button"
                          onClick={() => {
                            setSellToken(token);
                            setShowSellPicker(false);
                            setSellSearch("");
                            setSellAmount("");
                            setBuyAmount("");
                            setInputSide("sell");
                            reset();
                          }}
                          className={`w-full px-3 py-2 flex items-center gap-2 text-left hover:bg-zinc-800/80 transition-colors ${
                            sellToken?.id === token.id ? "bg-sky-500/5" : ""
                          }`}
                        >
                          <TokenIcon
                            address={token.address}
                            chainId={token.chainId}
                            symbol={token.symbol}
                            logo={token.logo}
                            size={20}
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-semibold text-zinc-200">
                              {token.symbol}
                            </p>
                            <p className="text-[10px] text-zinc-500 font-mono truncate">
                              {token.displayBalance}
                            </p>
                          </div>
                          {sellToken?.id === token.id && (
                            <FiCheckCircle className="h-3 w-3 text-sky-400 shrink-0" />
                          )}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Amount input */}
            <div className="flex-1 relative">
              <input
                type="text"
                inputMode="decimal"
                value={sellAmount}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === "" || /^\d*\.?\d*$/.test(v)) {
                    setSellAmount(v);
                    setInputSide("sell");
                    if (step !== "idle" && step !== "quoting" && step !== "quoted") {
                      reset();
                    }
                  }
                }}
                onFocus={() => setInputSide("sell")}
                placeholder="0.0"
                className="w-full bg-transparent text-right text-lg font-mono font-semibold text-zinc-100 placeholder:text-zinc-600 focus:outline-none"
              />
              {inputSide === "buy" && sellAmount && (
                <span className="absolute left-0 top-1/2 -translate-y-1/2 text-[10px] text-zinc-500">≈</span>
              )}
            </div>

            {/* MAX button */}
            {sellToken && (
              <button
                type="button"
                onClick={handleMaxAmount}
                className="px-2 py-1 rounded-md text-[10px] font-bold text-sky-400 bg-sky-500/10 hover:bg-sky-500/20 transition-colors uppercase tracking-wider"
              >
                Max
              </button>
            )}
          </div>
        </div>

        {/* ─── Flip arrow ──────────────────────────── */}
        <div className="flex items-center justify-center -my-3 relative z-10">
          <button
            type="button"
            onClick={handleFlipTokens}
            disabled={!sellToken || !selectedBuyToken || isLoading}
            className="p-2 rounded-xl bg-zinc-900 border border-zinc-700 text-zinc-400 hover:text-sky-400 hover:border-sky-500/40 hover:bg-sky-500/5 disabled:opacity-40 disabled:hover:text-zinc-400 transition-all shadow-md shadow-black/20"
          >
            <FiArrowDown className="h-4 w-4" />
          </button>
        </div>

        {/* ─── BUY panel ───────────────────────────── */}
        <div className={`rounded-xl border ${inputSide === "buy" ? "border-sky-500/30" : "border-zinc-800"} bg-zinc-900/40 p-3 space-y-2 transition-colors`}>
          <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold">
            Buy
          </span>
          <div className="flex items-center gap-2">
            {/* Token selector */}
            <div className="relative">
              <button
                type="button"
                onClick={() => {
                  setShowBuyPicker(!showBuyPicker);
                  setShowSellPicker(false);
                  setBuySearch("");
                }}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-zinc-800 border border-zinc-700 text-sm font-semibold text-zinc-200 hover:border-zinc-600 transition-all min-w-25"
              >
                {selectedBuyToken && (
                  <TokenIcon
                    address={selectedBuyToken.address}
                    chainId={chainId}
                    symbol={selectedBuyToken.symbol}
                    size={20}
                  />
                )}
                <span>{selectedBuyToken?.symbol ?? "Select"}</span>
                <FiChevronDown className="h-3 w-3 text-zinc-400 ml-auto" />
              </button>

              {/* Buy token picker dropdown — dynamic list with search */}
              <AnimatePresence>
                {showBuyPicker && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="absolute top-[calc(100%+4px)] left-0 z-100 w-72 rounded-xl border border-zinc-700 bg-zinc-900 shadow-2xl max-h-80 flex flex-col"
                  >
                    <div className="px-3 py-1.5 text-[9px] uppercase tracking-widest text-zinc-600 bg-zinc-950/50 rounded-t-xl">
                      {loadingTokens ? "Loading tokens…" : `${mergedBuyTokens.length} tokens available`}
                    </div>
                    {/* Search input */}
                    <div className="px-2 py-1.5 border-b border-zinc-800">
                      <div className="flex items-center gap-1.5 rounded-lg bg-zinc-800/60 px-2 py-1">
                        <FiSearch className="h-3 w-3 text-zinc-500 shrink-0" />
                        <input
                          type="text"
                          value={buySearch}
                          onChange={(e) => setBuySearch(e.target.value)}
                          placeholder="Search name, symbol or paste address…"
                          className="flex-1 bg-transparent text-xs text-zinc-200 placeholder:text-zinc-600 focus:outline-none"
                          autoFocus
                        />
                      </div>
                    </div>
                    <div className="overflow-y-auto flex-1">
                      {mergedBuyTokens.filter((t) => matchesSearch(t, buySearch)).length === 0 && (
                        <p className="px-3 py-4 text-[11px] text-zinc-500 italic text-center">
                          {buySearch ? "No tokens match your search" : "No tokens available"}
                        </p>
                      )}
                      {mergedBuyTokens
                        .filter((t) => matchesSearch(t, buySearch))
                        .map((token) => (
                        <button
                          key={token.address}
                          type="button"
                          onClick={() => {
                            setBuyTokenAddr(token.address);
                            setShowBuyPicker(false);
                            setBuySearch("");
                            setBuyAmount("");
                            setInputSide("sell");
                            reset();
                          }}
                          className={`w-full px-3 py-2 flex items-center gap-2 text-left hover:bg-zinc-800/80 transition-colors ${
                            buyTokenAddr.toLowerCase() === token.address.toLowerCase() ? "bg-sky-500/5" : ""
                          }`}
                        >
                          <TokenIcon
                            address={token.address}
                            chainId={chainId}
                            symbol={token.symbol}
                            logo={token.logoURI}
                            size={20}
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1">
                              <p className="text-xs font-semibold text-zinc-200">
                                {token.symbol}
                              </p>
                              {token.isPopular && (
                                <span className="text-[8px] px-1 py-0.5 rounded bg-sky-500/10 text-sky-400 font-semibold">
                                  TOP
                                </span>
                              )}
                            </div>
                            <p className="text-[10px] text-zinc-500 truncate">
                              {token.name !== token.symbol ? token.name : (
                                token.address === NATIVE_TOKEN_ADDRESS ? "Native" : `${token.address.slice(0, 8)}…${token.address.slice(-6)}`
                              )}
                            </p>
                          </div>
                          {buyTokenAddr.toLowerCase() === token.address.toLowerCase() && (
                            <FiCheckCircle className="h-3 w-3 text-sky-400 shrink-0" />
                          )}
                        </button>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Buy amount — editable input for reverse quote */}
            <div className="flex-1 relative">
              {step === "quoting" && inputSide === "sell" ? (
                <div className="flex items-center justify-end gap-1.5">
                  <FiLoader className="h-3.5 w-3.5 text-sky-400 animate-spin" />
                  <span className="text-sm text-zinc-500 font-mono">…</span>
                </div>
              ) : (
                <>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={buyAmount}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === "" || /^\d*\.?\d*$/.test(v)) {
                        setBuyAmount(v);
                        setInputSide("buy");
                        if (step !== "idle" && step !== "quoting" && step !== "quoted") {
                          reset();
                        }
                      }
                    }}
                    onFocus={() => setInputSide("buy")}
                    placeholder="0.0"
                    className="w-full bg-transparent text-right text-lg font-mono font-semibold text-zinc-100 placeholder:text-zinc-600 focus:outline-none"
                  />
                  {inputSide === "sell" && buyAmount && (
                    <span className="absolute left-0 top-1/2 -translate-y-1/2 text-[10px] text-zinc-500">≈</span>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* ─── Quote Details ───────────────────────── */}
        <AnimatePresence>
          {quote && step !== "idle" && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="rounded-xl border border-zinc-800 bg-zinc-900/30 p-3 space-y-1.5 text-[11px]">
                {/* Rate + Refresh + Toggle direction */}
                {rate && sellToken && selectedBuyToken && (
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-500 flex items-center gap-1">
                      Rate
                      <button
                        type="button"
                        onClick={() => setRefreshKey((k) => k + 1)}
                        disabled={isLoading}
                        className="p-0.5 rounded text-zinc-500 hover:text-sky-400 transition-colors disabled:opacity-40"
                        title="Refresh quote"
                      >
                        <FiRefreshCw className={`h-2.5 w-2.5 ${step === "quoting" ? "animate-spin" : ""}`} />
                      </button>
                    </span>
                    <button
                      type="button"
                      onClick={() => setShowInverseRate((v) => !v)}
                      className="text-zinc-300 font-mono hover:text-sky-400 transition-colors cursor-pointer"
                      title="Toggle rate direction"
                    >
                      {showInverseRate
                        ? `1 ${selectedBuyToken.symbol} = ${Number(inverseRate).toLocaleString(undefined, { maximumFractionDigits: 6 })} ${sellToken.symbol}`
                        : `1 ${sellToken.symbol} = ${Number(rate).toLocaleString(undefined, { maximumFractionDigits: 6 })} ${selectedBuyToken.symbol}`
                      }
                    </button>
                  </div>
                )}

                {/* Price impact with visual gauge */}
                {quote.estimatedPriceImpact && (
                  <div className="flex justify-between items-center">
                    <span className="text-zinc-500">Price Impact</span>
                    <div className="flex items-center gap-1.5">
                      <div className="w-12 h-1 rounded-full bg-zinc-800 overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            parseFloat(quote.estimatedPriceImpact) > 3
                              ? "bg-red-400"
                              : parseFloat(quote.estimatedPriceImpact) > 1
                                ? "bg-amber-400"
                                : "bg-emerald-400"
                          }`}
                          style={{ width: `${Math.min(parseFloat(quote.estimatedPriceImpact) * 10, 100)}%` }}
                        />
                      </div>
                      <span
                        className={`font-mono ${
                          parseFloat(quote.estimatedPriceImpact) > 3
                            ? "text-red-400"
                            : parseFloat(quote.estimatedPriceImpact) > 1
                              ? "text-amber-400"
                              : "text-emerald-400"
                        }`}
                      >
                        {quote.estimatedPriceImpact}%
                      </span>
                    </div>
                  </div>
                )}

                {/* Gas estimate */}
                <div className="flex justify-between">
                  <span className="text-zinc-500">Est. Gas</span>
                  <span className="text-zinc-400 font-mono">
                    {Number(quote.estimatedGas).toLocaleString()} units
                  </span>
                </div>

                {/* Slippage */}
                <div className="flex justify-between">
                  <span className="text-zinc-500">Max Slippage</span>
                  <span className="text-zinc-400">
                    {(slippageBps / 100).toFixed(1)}%
                  </span>
                </div>

                {/* Route/Sources visualization (chip-style) */}
                {quote.sources && quote.sources.filter((s) => parseFloat(s.proportion) > 0).length > 0 && (
                  <div className="pt-1.5 border-t border-zinc-800/50">
                    <span className="text-zinc-500 text-[10px]">Route</span>
                    <div className="mt-1 flex items-center gap-1 flex-wrap">
                      {quote.sources
                        .filter((s) => parseFloat(s.proportion) > 0)
                        .sort((a, b) => parseFloat(b.proportion) - parseFloat(a.proportion))
                        .slice(0, 5)
                        .map((s) => (
                        <span
                          key={s.name}
                          className="inline-flex items-center gap-0.5 rounded-md bg-zinc-800 px-1.5 py-0.5 text-[10px] font-medium text-zinc-300"
                        >
                          <FiZap className="h-2 w-2 text-sky-400" />
                          {s.name}
                          <span className="text-zinc-500 ml-0.5">
                            {(parseFloat(s.proportion) * 100).toFixed(0)}%
                          </span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ─── Error message ───────────────────────── */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="rounded-xl border border-red-800/40 bg-red-900/10 p-3 flex items-start gap-2">
                <FiAlertTriangle className="h-3.5 w-3.5 text-red-400 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] text-red-400 wrap-break-word">
                    {error}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={reset}
                  className="shrink-0 p-1 text-zinc-500 hover:text-zinc-300"
                >
                  <FiX className="h-3 w-3" />
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ─── Step indicator ──────────────────────── */}
        <AnimatePresence>
          {isLoading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex items-center justify-center gap-2 py-1"
            >
              <FiLoader className="h-3.5 w-3.5 text-sky-400 animate-spin" />
              <span className="text-[11px] text-sky-400 font-medium">
                {STEP_LABELS[step]}
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ─── Swap button ─────────────────────────── */}
        <button
          type="button"
          onClick={canSwap ? handleSwap : undefined}
          disabled={!canSwap || isLoading}
          className={`w-full py-3 rounded-xl text-sm font-bold transition-all ${
            canSwap && !isLoading
              ? "bg-sky-500 hover:bg-sky-400 text-white shadow-lg shadow-sky-500/20"
              : "bg-zinc-800 text-zinc-500 cursor-not-allowed"
          }`}
        >
          {!sellToken || !buyTokenAddr
            ? "Select tokens"
            : (!sellAmount || parseFloat(sellAmount) <= 0) && (!buyAmount || parseFloat(buyAmount) <= 0)
              ? "Enter amount"
              : step === "quoting"
                ? "Getting quote…"
                : isLoading
                  ? STEP_LABELS[step]
                  : step === "quoted"
                    ? "Swap Now"
                    : step === "error"
                      ? "Try Again"
                      : "Swap"}
        </button>

        {/* ─── Footer ──────────────────────────────── */}
        <div className="flex items-center justify-center gap-1.5 pt-1">
          <FiShield className="h-2.5 w-2.5 text-zinc-600" />
          <span className="text-[9px] text-zinc-600">
            Best prices from 100+ DEX sources via KyberSwap &middot; No extra fees
          </span>
        </div>
      </div>

      {/* Close pickers on outside click */}
      {(showSellPicker || showBuyPicker) && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => {
            setShowSellPicker(false);
            setShowBuyPicker(false);
          }}
        />
      )}
    </div>
  );
}

export default DexSwapPanel;
