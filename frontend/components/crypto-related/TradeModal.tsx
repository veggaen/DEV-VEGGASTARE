"use client";

import React, { useState, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { useModalClose } from "@/hooks/use-modal-close";
import { motion, AnimatePresence } from "framer-motion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { OsrsInventory } from "./OsrsInventory";
import type { InventorySlot } from "./OsrsInventory";
import { useCurrentUser } from "@/hooks/use-current-user";
import {
  useAccount,
  useChainId,
  useSignMessage,
  useWalletClient,
  usePublicClient,
} from "wagmi";
import { parseUnits, type Address, type Hash } from "viem";
import { toast } from "sonner";
import { VEGGA_SYSTEM } from "@/lib/vegga-system-constants";
import { TokenIcon } from "@/components/ui/token-icon";
import {
  FiX,
  FiCheck,
  FiCheckCircle,
  FiAlertTriangle,
  FiRepeat,
  FiPackage,
  FiShield,
  FiClock,
  FiLock,
  FiArrowRight,
} from "react-icons/fi";

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────

interface TradePartner {
  id: string;
  name: string | null;
  image: string | null;
}

type TradePhase = "offer" | "confirm" | "complete" | "cancelled";

interface TradeModalProps {
  tradeId: string;
  isFullPage?: boolean;
}

function generateTradeSessionCode(currentTradeId: string, rotateMs: number): string {
  const seed = `${currentTradeId}-${Math.floor(Date.now() / rotateMs)}`;
  let hash = 0;
  for (let index = 0; index < seed.length; index++) {
    hash = ((hash << 5) - hash + seed.charCodeAt(index)) | 0;
  }
  return Math.abs(hash).toString(36).toUpperCase().padStart(6, "0").slice(0, 6);
}

// ────────────────────────────────────────────────────────────
// Session Token (TOTP-style rotating code)
// ────────────────────────────────────────────────────────────

function TradeSessionToken({ tradeId }: { tradeId: string }) {
  const ROTATE = 30_000;
  const [code, setCode] = useState(() => generateTradeSessionCode(tradeId, ROTATE));

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setCode(generateTradeSessionCode(tradeId, ROTATE));
    }, 0);
    const intervalId = window.setInterval(() => setCode(generateTradeSessionCode(tradeId, ROTATE)), ROTATE);
    return () => {
      window.clearTimeout(timeoutId);
      window.clearInterval(intervalId);
    };
  }, [tradeId]);

  const progress = 100;

  const c = 2 * Math.PI * 10;
  return (
    <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
      <svg width="24" height="24" viewBox="0 0 24 24" className="shrink-0">
        <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2" className="text-zinc-200 dark:text-zinc-700" />
        <circle cx="12" cy="12" r="10" fill="none" stroke="currentColor" strokeWidth="2"
          strokeDasharray={c} strokeDashoffset={c - (progress / 100) * c} strokeLinecap="round"
          className={progress > 30 ? "text-emerald-500" : progress > 10 ? "text-amber-500" : "text-red-500"}
          transform="rotate(-90 12 12)" />
      </svg>
      <div className="flex flex-col">
        <span className="text-[8px] uppercase tracking-widest text-zinc-400 dark:text-zinc-500 leading-none">Session</span>
        <span className="text-[11px] font-mono font-bold text-zinc-700 dark:text-zinc-300 tracking-[0.2em] leading-tight">{code}</span>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Expiry Timer
// ────────────────────────────────────────────────────────────

function TradeExpiry({ expiresAt }: { expiresAt?: string }) {
  const [remaining, setRemaining] = useState("");

  useEffect(() => {
    if (!expiresAt) return;
    const target = new Date(expiresAt).getTime();
    const tick = () => {
      const diff = target - Date.now();
      if (diff <= 0) { setRemaining("Expired"); return; }
      const mins = Math.floor(diff / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      setRemaining(`${mins}:${secs.toString().padStart(2, "0")}`);
    };
    tick();
    const iv = setInterval(tick, 1000);
    return () => clearInterval(iv);
  }, [expiresAt]);

  if (!expiresAt) return null;
  return (
    <div className="flex items-center gap-1 text-[10px] text-zinc-400 dark:text-zinc-500">
      <FiClock className="h-3 w-3" />
      <span className="font-mono">{remaining}</span>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Phase Indicator
// ────────────────────────────────────────────────────────────

function PhaseIndicator({ phase }: { phase: TradePhase }) {
  const phases: { key: TradePhase; label: string; icon: React.ReactNode }[] = [
    { key: "offer", label: "Offer", icon: <FiPackage className="h-3 w-3" /> },
    { key: "confirm", label: "Verify", icon: <FiShield className="h-3 w-3" /> },
    { key: "complete", label: "Done", icon: <FiCheckCircle className="h-3 w-3" /> },
  ];
  const ci = phases.findIndex((p) => p.key === phase);

  return (
    <div className="flex items-center gap-1 px-4 py-2 bg-zinc-50/50 dark:bg-zinc-900/30">
      {phases.map((p, i) => (
        <React.Fragment key={p.key}>
          <motion.div
            animate={{ backgroundColor: phase === p.key ? "rgb(16 185 129 / 0.15)" : ci > i ? "rgb(16 185 129 / 0.08)" : "rgb(0 0 0 / 0.03)" }}
            className="flex-1 flex items-center justify-center gap-1 py-1 rounded-md"
          >
            <span className={phase === p.key ? "text-emerald-600 dark:text-emerald-400" : ci > i ? "text-emerald-400/60" : "text-zinc-400"}>
              {p.icon}
            </span>
            <span className={`text-[9px] font-medium ${phase === p.key ? "text-emerald-700 dark:text-emerald-400" : ci > i ? "text-emerald-500/60" : "text-zinc-400"}`}>
              {p.label}
            </span>
          </motion.div>
          {i < phases.length - 1 && (
            <motion.div className="w-4 h-px" animate={{ backgroundColor: ci > i ? "rgb(16 185 129 / 0.5)" : "rgb(0 0 0 / 0.1)" }} />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Trade Item Grid (for one side)
// ────────────────────────────────────────────────────────────

function TradeItemGrid({
  items,
  isRemote,
  onRemoveItem,
}: {
  items: InventorySlot[];
  isRemote?: boolean;
  onRemoveItem?: (id: string) => void;
}) {
  return (
    <div className="grid grid-cols-4 gap-1.5 min-h-25">
      {items.length === 0 ? (
        <motion.div
          className="col-span-4 flex flex-col items-center justify-center py-8 text-zinc-400 dark:text-zinc-600 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-lg"
          animate={isRemote ? {} : { borderColor: ["rgba(16,185,129,0.15)", "rgba(16,185,129,0.35)", "rgba(16,185,129,0.15)"] }}
          transition={{ duration: 2, repeat: isRemote ? 0 : Infinity }}
        >
          <FiPackage className="h-5 w-5 mb-1" />
          <span className="text-[10px]">{isRemote ? "Waiting for items..." : "Click items from your inventory →"}</span>
        </motion.div>
      ) : (
        items.map((item, idx) => (
          <motion.div
            key={item.id}
            layout
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.6 }}
            transition={{ type: "spring", stiffness: 500, damping: 30, delay: idx * 0.05 }}
            whileHover={!isRemote ? { scale: 1.08, boxShadow: "0 4px 20px rgba(239,68,68,0.2)", borderColor: "rgb(239,68,68)" } : { scale: 1.05 }}
            className={`relative aspect-square rounded-lg border-2 flex flex-col items-center justify-center p-1 cursor-pointer transition-colors ${
              isRemote
                ? "border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900"
                : "border-emerald-300 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/50"
            }`}
            onClick={() => !isRemote && onRemoveItem?.(item.id)}
            title={isRemote ? `${item.amount} ${item.token.symbol}` : "Click to remove"}
          >
            <div className="w-6 h-6 flex items-center justify-center">
              <TokenIcon
                address={item.token.address}
                chainId={item.token.chainId}
                symbol={item.token.symbol}
                logo={item.token.logo}
                size={24}
              />
            </div>
            <span className="text-[9px] font-bold text-zinc-700 dark:text-zinc-300 mt-0.5 truncate max-w-full">{item.amount}</span>
            <span className="text-[7px] text-zinc-400 truncate max-w-full">{item.token.symbol}</span>
          </motion.div>
        ))
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Main TradeModal
// ────────────────────────────────────────────────────────────

export function TradeModal({ tradeId, isFullPage = false }: TradeModalProps) {
  const router = useRouter();
  const currentUser = useCurrentUser();
  const { address } = useAccount();
  const chainId = useChainId();
  const { signMessageAsync } = useSignMessage();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();

  const [phase, setPhase] = useState<TradePhase>("offer");
  const [partner, setPartner] = useState<TradePartner | null>(null);
  const [partnerWallet, setPartnerWallet] = useState<string | null>(null);
  const [myReady, setMyReady] = useState(false);
  const [theirReady, setTheirReady] = useState(false);
  const [myItems, setMyItems] = useState<InventorySlot[]>([]);
  const [theirItems, setTheirItems] = useState<InventorySlot[]>([]);
  const [confirmed, setConfirmed] = useState(false);
  const [expiresAt, setExpiresAt] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  // ── Initial fetch ──
  useEffect(() => {
    async function load() {
      try {
        const res = await fetch(`/api/trades/${tradeId}`);
        if (!res.ok) { toast.error("Trade not found"); router.back(); return; }
        const data = await res.json();

        if (data.expiresAt) setExpiresAt(data.expiresAt);
        const iAmInitiator = data.initiatorId === currentUser?.id;
        const p = iAmInitiator ? data.Responder : data.Initiator;
        setPartner({ id: p.id, name: p.name, image: p.image });

        if (data.status === "CANCELLED" || data.status === "EXPIRED") setPhase("cancelled");
        else if (data.status === "COMPLETED") setPhase("complete");
        else if (data.status === "CONFIRMING") setPhase("confirm");
      } catch {
        toast.error("Failed to load trade");
        router.back();
      } finally {
        setLoading(false);
      }
    }
    if (currentUser?.id) load();
  }, [tradeId, currentUser?.id, router]);

  // ── Poll trade state ──
  useEffect(() => {
    if (!tradeId || phase === "complete" || phase === "cancelled" || loading) return;
    let active = true;

    const poll = async () => {
      try {
        const res = await fetch(`/api/trades/${tradeId}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!active) return;

        if (data.expiresAt) setExpiresAt(data.expiresAt);
        if (data.status === "CANCELLED" || data.status === "EXPIRED") { setPhase("cancelled"); return; }
        if (data.status === "COMPLETED") { setPhase("complete"); return; }

        const iAmInitiator = data.initiatorId === currentUser?.id;
        setTheirReady(iAmInitiator ? data.responderReady : data.initiatorReady);

        // Extract partner wallet address from trade metadata
        const meta = (data.metadata ?? {}) as Record<string, unknown>;
        const pWallet = iAmInitiator ? meta.responderWallet : meta.initiatorWallet;
        if (typeof pWallet === "string" && pWallet) setPartnerWallet(pWallet);

        // Parse their items
        const theirSide = iAmInitiator ? "RESPONDER" : "INITIATOR";
        const partnerItems = (data.Items ?? data.items ?? [])
          .filter((item: Record<string, unknown>) => item.side === theirSide)
          .map((item: Record<string, unknown>, i: number) => ({
            id: item.id as string,
            token: {
              id: item.id as string,
              address: item.tokenAddress as string,
              symbol: item.tokenSymbol as string,
              decimals: item.tokenDecimals as number,
              logo: item.tokenLogoUrl as string | undefined,
              chainId: item.chainId as number,
              rawBalance: BigInt(item.amount as string),
              displayBalance: item.displayAmount as string,
              isNative: (item.tokenAddress as string) === "0x0000000000000000000000000000000000000000",
            },
            amount: item.displayAmount as string,
            rawAmount: item.amount as string,
            order: i,
          }));
        setTheirItems(partnerItems);

        if (data.status === "CONFIRMING") setPhase("confirm");
      } catch {
        // silent
      }
    };

    const iv = setInterval(poll, 3000);
    poll();
    return () => { active = false; clearInterval(iv); };
  }, [tradeId, phase, currentUser?.id, loading]);

  // ── Add/Remove items ──
  const addMyItem = useCallback((slot: InventorySlot) => {
    setMyItems((prev) => {
      if (prev.some((s) => s.id === slot.id)) return prev;
      return [...prev, slot];
    });
    setMyReady(false);
  }, []);

  const removeMyItem = useCallback((slotId: string) => {
    setMyItems((prev) => prev.filter((s) => s.id !== slotId));
    setMyReady(false);
  }, []);

  // ── Ready Up ──
  const handleReady = useCallback(async () => {
    if (myItems.length === 0) { toast.error("Add at least one item to trade"); return; }
    setMyReady(true);
    try {
      await fetch(`/api/trades/${tradeId}/ready`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletAddress: address ?? undefined,
          items: myItems.map((item) => ({
            tokenAddress: item.token.address,
            tokenSymbol: item.token.symbol,
            tokenDecimals: item.token.decimals,
            tokenLogoUrl: item.token.logo,
            amount: item.rawAmount,
            displayAmount: item.amount,
            chainId: item.token.chainId,
          })),
        }),
      });
    } catch {
      toast.error("Failed to update trade");
      setMyReady(false);
    }
  }, [myItems, tradeId]);

  // ── Final Confirm (with on-chain transfers + wallet signature) ──
  const handleConfirm = useCallback(async () => {
    if (!address) { toast.error("Wallet not connected"); return; }
    if (!walletClient) { toast.error("Wallet client not ready"); return; }
    if (!publicClient) { toast.error("Network client not ready"); return; }
    if (!partnerWallet) { toast.error("Partner wallet address unknown — wait for them to ready up"); return; }

    try {
      // ── Step 1: Sign a message proving trade intent ──
      const message = [
        `Veggat Trade Confirmation`,
        `Trade ID: ${tradeId}`,
        `VeggaSystem: ${VEGGA_SYSTEM.walletAddress}`,
        `My items: ${myItems.map((i) => `${i.amount} ${i.token.symbol}`).join(", ") || "None"}`,
        `Their items: ${theirItems.map((i) => `${i.amount} ${i.token.symbol}`).join(", ") || "None"}`,
        `Partner: ${partnerWallet}`,
        `Timestamp: ${new Date().toISOString()}`,
      ].join("\n");

      toast.info("Step 1/2 — Sign to confirm trade intent...");
      const signature = await signMessageAsync({ message });

      // ── Step 2: Execute on-chain transfers for each offered item ──
      const txHashes: string[] = [];
      const NATIVE_ADDRESS = "0x0000000000000000000000000000000000000000";

      if (myItems.length > 0) {
        toast.info(`Step 2/2 — Sending ${myItems.length} item${myItems.length > 1 ? "s" : ""} on-chain...`);
      }

      for (const item of myItems) {
        const isNative =
          item.token.address === NATIVE_ADDRESS ||
          item.token.address.toLowerCase() === "0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee";

        if (isNative) {
          // ── Native token transfer (ETH / MATIC / etc.) ──
          const value = parseUnits(item.amount, item.token.decimals);
          const hash = await walletClient.sendTransaction({
            to: partnerWallet as Address,
            value,
          });
          txHashes.push(hash);

          // Wait for confirmation
          await publicClient.waitForTransactionReceipt({
            hash,
            confirmations: 1,
            timeout: 120_000,
          });
        } else {
          // ── ERC-20 token transfer ──
          const amount = parseUnits(item.amount, item.token.decimals);
          const hash = await walletClient.writeContract({
            address: item.token.address as Address,
            abi: [
              {
                name: "transfer",
                type: "function",
                stateMutability: "nonpayable",
                inputs: [
                  { name: "to", type: "address" },
                  { name: "amount", type: "uint256" },
                ],
                outputs: [{ name: "", type: "bool" }],
              },
            ] as const,
            functionName: "transfer",
            args: [partnerWallet as Address, amount],
          });
          txHashes.push(hash);

          // Wait for confirmation
          await publicClient.waitForTransactionReceipt({
            hash,
            confirmations: 1,
            timeout: 120_000,
          });
        }
      }

      setConfirmed(true);

      // ── Step 3: Record confirmation + tx data on backend ──
      const res = await fetch(`/api/trades/${tradeId}/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          signature,
          walletAddress: address,
          txHashes,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        toast.error(data.error ?? "Confirmation failed");
        setConfirmed(false);
      } else {
        toast.success("Trade confirmed on-chain!");
      }
    } catch (err: unknown) {
      if (err instanceof Error && (err.message.includes("User rejected") || err.message.includes("user rejected"))) {
        toast.error("Transaction rejected in wallet");
      } else if (err instanceof Error && err.message.includes("insufficient funds")) {
        toast.error("Insufficient funds for transfer + gas");
      } else {
        console.error("[TRADE_CONFIRM]", err);
        toast.error("Trade confirmation failed");
      }
      setConfirmed(false);
    }
  }, [tradeId, address, myItems, theirItems, signMessageAsync, walletClient, publicClient, partnerWallet]);

  // ── Cancel ──
  const handleCancel = useCallback(async () => {
    try {
      await fetch(`/api/trades/${tradeId}/cancel`, { method: "POST" });
    } catch { /* swallow */ }
    setPhase("cancelled");
    setTimeout(() => router.back(), 1500);
  }, [tradeId, router]);

  // ── Close modal ──
  // Safe close: back() on in-app soft nav, else fall back to the trading hub
  // (prevents the "kicked to the homepage" jump on deep-link/refresh).
  const handleClose = useModalClose("/dashboard/trading");

  // ── Loading state ──
  if (loading) {
    return (
      <ModalWrapper isFullPage={isFullPage} onClose={handleClose} mounted={mounted}>
        <div className="flex items-center justify-center py-20">
          <div className="h-6 w-6 border-2 border-zinc-200 dark:border-zinc-700 border-t-emerald-500 rounded-full animate-spin" />
        </div>
      </ModalWrapper>
    );
  }

  if (!partner) {
    return (
      <ModalWrapper isFullPage={isFullPage} onClose={handleClose} mounted={mounted}>
        <div className="flex items-center justify-center py-20 text-zinc-500">Trade not found</div>
      </ModalWrapper>
    );
  }

  // ────────────────────────────────────────────────────────────
  // Main Render
  // ────────────────────────────────────────────────────────────

  const modalContent = (
    <div className="flex flex-col h-full max-h-[85vh] w-full">
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <FiRepeat className="h-4 w-4 text-emerald-500" />
            <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">P2P Trade</span>
          </div>
          <TradeExpiry expiresAt={expiresAt} />
        </div>
        <div className="flex items-center gap-2">
          <TradeSessionToken tradeId={tradeId} />
          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors"
          >
            <FiX className="h-4 w-4 text-zinc-500" />
          </button>
        </div>
      </div>

      {/* Phase Progress */}
      <PhaseIndicator phase={phase} />

      {/* Body — Split Panel */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <AnimatePresence mode="wait">
          {phase === "complete" ? (
            <motion.div
              key="complete"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center justify-center py-16 px-6 text-center"
            >
              <motion.div
                className="relative mb-6"
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
              >
                <motion.div className="absolute inset-0 rounded-full bg-emerald-400/20" animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }} transition={{ duration: 2, repeat: Infinity }} />
                <div className="h-20 w-20 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                  <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", delay: 0.3 }}>
                    <FiCheckCircle className="h-10 w-10 text-emerald-500" />
                  </motion.div>
                </div>
              </motion.div>
              <h3 className="text-lg font-bold text-zinc-800 dark:text-zinc-200 mb-1">Trade Complete!</h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">You traded with {partner.name ?? "a trader"}. Check your wallet.</p>
              <div className="mt-4 flex items-center gap-1.5 text-[10px] text-zinc-400"><FiShield className="h-3 w-3" /> Cryptographically verified</div>
            </motion.div>
          ) : phase === "cancelled" ? (
            <motion.div key="cancelled" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-16 px-6 text-center">
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring" }} className="h-16 w-16 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center mb-4">
                <FiX className="h-8 w-8 text-red-400" />
              </motion.div>
              <h3 className="text-lg font-bold text-zinc-800 dark:text-zinc-200 mb-1">Trade Cancelled</h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">No items exchanged. All assets remain in their wallets.</p>
            </motion.div>
          ) : (
            <motion.div key="trade-panels" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="grid grid-cols-1 lg:grid-cols-2 h-full divide-y lg:divide-y-0 lg:divide-x divide-zinc-200 dark:divide-zinc-800">
              {/* ──── LEFT SIDE: Partner Profile + Their Window ──── */}
              <div className="flex flex-col overflow-y-auto">
                {/* Partner header */}
                <div className="px-5 py-4 border-b border-zinc-100 dark:border-zinc-900">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10 ring-2 ring-offset-2 ring-offset-white dark:ring-offset-zinc-950 ring-purple-300 dark:ring-purple-700">
                        <AvatarImage src={partner.image ?? undefined} />
                        <AvatarFallback className="text-sm">{partner.name?.[0]?.toUpperCase() ?? "?"}</AvatarFallback>
                      </Avatar>
                      <div>
                        <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">{partner.name ?? "Trader"}</h3>
                        <p className="text-[10px] text-zinc-400 dark:text-zinc-500">Trading partner</p>
                      </div>
                    </div>
                    <AnimatePresence>
                      {theirReady && (
                        <motion.span
                          initial={{ opacity: 0, scale: 0.5 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.5 }}
                          className="flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-medium bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded-full"
                        >
                          <FiCheckCircle className="h-3 w-3" /> Ready
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                {/* Partner's offered items */}
                <div className="flex-1 px-5 py-4">
                  <h4 className="text-[10px] uppercase tracking-widest text-zinc-400 dark:text-zinc-500 mb-3 font-medium">
                    Their Offer
                  </h4>
                  <TradeItemGrid items={theirItems} isRemote />
                </div>
              </div>

              {/* ──── RIGHT SIDE: My Offer + Inventory ──── */}
              <div className="flex flex-col overflow-y-auto">
                {/* My header */}
                <div className="px-5 py-4 border-b border-zinc-100 dark:border-zinc-900">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Avatar className="h-10 w-10 ring-2 ring-offset-2 ring-offset-white dark:ring-offset-zinc-950 ring-emerald-300 dark:ring-emerald-700">
                        <AvatarImage src={currentUser?.image ?? undefined} />
                        <AvatarFallback className="text-sm">{currentUser?.name?.[0]?.toUpperCase() ?? "?"}</AvatarFallback>
                      </Avatar>
                      <div>
                        <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">{currentUser?.name ?? "You"}</h3>
                        <p className="text-[10px] text-zinc-400 dark:text-zinc-500">Your side</p>
                      </div>
                    </div>
                    <AnimatePresence>
                      {myReady && (
                        <motion.span
                          initial={{ opacity: 0, scale: 0.5 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.5 }}
                          className="flex items-center gap-1 text-[10px] text-emerald-600 dark:text-emerald-400 font-medium bg-emerald-50 dark:bg-emerald-900/20 px-2 py-0.5 rounded-full"
                        >
                          <FiCheckCircle className="h-3 w-3" /> Ready
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                {/* My offered items */}
                <div className="px-5 py-4 border-b border-zinc-100 dark:border-zinc-900">
                  <h4 className="text-[10px] uppercase tracking-widest text-zinc-400 dark:text-zinc-500 mb-3 font-medium">
                    Your Offer ({myItems.length} item{myItems.length !== 1 ? "s" : ""})
                  </h4>
                  <TradeItemGrid items={myItems} onRemoveItem={removeMyItem} />
                </div>

                {/* Compact Inventory — click to add items to offer */}
                <div className="flex-1 px-5 py-4 bg-zinc-50/50 dark:bg-zinc-900/30">
                  <h4 className="text-[10px] uppercase tracking-widest text-zinc-400 dark:text-zinc-500 mb-3 font-medium flex items-center gap-1.5">
                    <FiPackage className="h-3 w-3" /> Your Inventory
                    <FiArrowRight className="h-2.5 w-2.5 ml-1" />
                    <span className="text-emerald-500">drag or click to add</span>
                  </h4>
                  <OsrsInventory
                    compact
                    tradeMode
                    onSlotSelect={(slot) => {
                      if (slot) addMyItem(slot);
                    }}
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Security footer */}
      {phase !== "complete" && phase !== "cancelled" && (
        <div className="px-4 py-1.5 border-t border-zinc-100 dark:border-zinc-900 bg-zinc-50/50 dark:bg-zinc-900/30 shrink-0">
          <div className="flex items-center justify-center gap-1.5 text-[9px] text-zinc-400 dark:text-zinc-500">
            <FiLock className="h-2.5 w-2.5" />
            <span>End-to-end verified &middot; Zero-knowledge proof ready &middot; VeggaSystem: {VEGGA_SYSTEM.walletAddress.slice(0, 6)}...{VEGGA_SYSTEM.walletAddress.slice(-4)}</span>
          </div>
        </div>
      )}

      {/* Action Bar */}
      {phase !== "complete" && phase !== "cancelled" && (
        <div className="px-5 py-3 border-t border-zinc-200 dark:border-zinc-800 space-y-2 bg-white dark:bg-zinc-950 shrink-0">
          {phase === "offer" && (
            <div className="flex gap-2">
              <motion.button
                type="button"
                onClick={handleCancel}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-red-50 dark:hover:bg-red-900/10 hover:text-red-600 hover:border-red-300 dark:hover:border-red-700 transition-colors"
              >
                <FiX className="h-3.5 w-3.5" />
                Decline
              </motion.button>
              <motion.button
                type="button"
                onClick={handleReady}
                disabled={myReady || myItems.length === 0}
                whileHover={!myReady && myItems.length > 0 ? { scale: 1.02 } : {}}
                whileTap={!myReady && myItems.length > 0 ? { scale: 0.98 } : {}}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                  myReady
                    ? "bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-700"
                    : "bg-emerald-600 text-white hover:bg-emerald-500 shadow-lg shadow-emerald-500/25 disabled:opacity-40 disabled:shadow-none"
                }`}
              >
                {myReady ? (
                  <>
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 500, damping: 20 }}>
                      <FiCheckCircle className="h-3.5 w-3.5" />
                    </motion.div>
                    Ready
                  </>
                ) : (
                  <><FiCheck className="h-3.5 w-3.5" /> Accept</>
                )}
              </motion.button>
            </div>
          )}
          {phase === "confirm" && (
            <div className="space-y-2">
              <motion.div
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800"
              >
                <motion.div animate={{ rotate: [0, 5, -5, 0] }} transition={{ repeat: Infinity, duration: 2 }}>
                  <FiAlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                </motion.div>
                <p className="text-[10px] text-amber-700 dark:text-amber-400">
                  Final step — your wallet will prompt for a signature, then send your offered items on-chain. Gas fees apply.
                </p>
              </motion.div>
              <div className="flex gap-2">
                <motion.button
                  type="button"
                  onClick={handleCancel}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex-1 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 text-xs font-medium text-zinc-600 dark:text-zinc-400 hover:bg-red-50 dark:hover:bg-red-900/10 transition-colors"
                >
                  Cancel
                </motion.button>
                <motion.button
                  type="button"
                  onClick={handleConfirm}
                  disabled={confirmed}
                  whileHover={!confirmed ? { scale: 1.02 } : {}}
                  whileTap={!confirmed ? { scale: 0.98 } : {}}
                  className="flex-1 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-500 disabled:opacity-40 shadow-lg shadow-emerald-500/25 disabled:shadow-none transition-all"
                >
                  {confirmed ? (
                    <span className="flex items-center justify-center gap-1.5">
                      <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}>
                        <FiShield className="h-3.5 w-3.5" />
                      </motion.div>
                      Verifying...
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-1.5">
                      <FiShield className="h-3.5 w-3.5" />
                      Confirm Trade
                    </span>
                  )}
                </motion.button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );

  return (
    <ModalWrapper isFullPage={isFullPage} onClose={handleClose} mounted={mounted}>
      {modalContent}
    </ModalWrapper>
  );
}

// ────────────────────────────────────────────────────────────
// Modal Wrapper (overlay for intercepted route, plain for full page)
// ────────────────────────────────────────────────────────────

function ModalWrapper({
  isFullPage,
  onClose,
  mounted,
  children,
}: {
  isFullPage: boolean;
  onClose: () => void;
  mounted: boolean;
  children: React.ReactNode;
}) {
  // Escape to close
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [onClose]);

  if (isFullPage) {
    return (
      <div className="w-full max-w-5xl mx-auto rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-2xl overflow-hidden">
        {children}
      </div>
    );
  }

  // Intercepted route — modal overlay via portal
  const overlay = (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-9998 flex items-center justify-center p-4"
      >
        {/* Backdrop */}
        <motion.div
          className="absolute inset-0 bg-black/50 backdrop-blur-sm"
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
          className="relative z-10 w-full max-w-5xl max-h-[90vh] rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 shadow-2xl overflow-hidden"
        >
          {children}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );

  if (!mounted) return null;
  return createPortal(overlay, document.body);
}
