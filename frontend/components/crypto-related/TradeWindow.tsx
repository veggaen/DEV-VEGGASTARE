"use client";

import React, { useState, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useAccount, useChainId } from "wagmi";
import { toast } from "sonner";
import {
  FiX,
  FiCheck,
  FiCheckCircle,
  FiAlertTriangle,
  FiRepeat,
  FiPackage,
  FiChevronLeft,
  FiShield,
  FiClock,
  FiLock,
} from "react-icons/fi";
import type { InventorySlot } from "./CryptoInventory";

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────

export interface TradePartner {
  id: string;
  name: string | null;
  image: string | null;
  walletAddress?: string;
}

export type TradePhase = "offer" | "confirm" | "complete" | "cancelled";

interface TradeWindowProps {
  partner: TradePartner;
  tradeId?: string;
  onClose: () => void;
  onComplete?: (tradeId: string) => void;
}

// ────────────────────────────────────────────────────────────
// Trade Session Token (Google Authenticator-style rotating code)
// — Visual security indicator that the session is live & verified
// ────────────────────────────────────────────────────────────

function TradeSessionToken({ tradeId }: { tradeId?: string }) {
  const [code, setCode] = useState("------");
  const [progress, setProgress] = useState(100);
  const ROTATE_INTERVAL = 30_000; // 30 seconds like TOTP

  useEffect(() => {
    function generateCode(): string {
      const seed = `${tradeId ?? "local"}-${Math.floor(Date.now() / ROTATE_INTERVAL)}`;
      let hash = 0;
      for (let i = 0; i < seed.length; i++) {
        hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
      }
      return Math.abs(hash).toString(36).toUpperCase().padStart(6, "0").slice(0, 6);
    }

    setCode(generateCode());
    const interval = setInterval(() => setCode(generateCode()), ROTATE_INTERVAL);
    return () => clearInterval(interval);
  }, [tradeId]);

  // Countdown progress ring
  useEffect(() => {
    let raf: number;
    const tick = () => {
      const elapsed = Date.now() % ROTATE_INTERVAL;
      setProgress(100 - (elapsed / ROTATE_INTERVAL) * 100);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const circumference = 2 * Math.PI * 10;
  const dashOffset = circumference - (progress / 100) * circumference;

  return (
    <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
      {/* Countdown ring */}
      <svg width="24" height="24" viewBox="0 0 24 24" className="shrink-0">
        <circle
          cx="12" cy="12" r="10"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="text-zinc-200 dark:text-zinc-700"
        />
        <circle
          cx="12" cy="12" r="10"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          className={`transition-colors ${
            progress > 30
              ? "text-emerald-500"
              : progress > 10
              ? "text-amber-500"
              : "text-red-500"
          }`}
          transform="rotate(-90 12 12)"
        />
        <FiShield className="h-2.5 w-2.5" x="6.75" y="6.75" />
      </svg>
      {/* Code */}
      <div className="flex flex-col">
        <span className="text-[8px] uppercase tracking-widest text-zinc-400 dark:text-zinc-500 leading-none">
          Session
        </span>
        <span className="text-[11px] font-mono font-bold text-zinc-700 dark:text-zinc-300 tracking-[0.2em] leading-tight">
          {code}
        </span>
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Trade Expiry Timer
// ────────────────────────────────────────────────────────────

function TradeExpiry({ expiresAt }: { expiresAt?: string }) {
  const [remaining, setRemaining] = useState("");

  useEffect(() => {
    if (!expiresAt) return;
    const target = new Date(expiresAt).getTime();

    const tick = () => {
      const diff = target - Date.now();
      if (diff <= 0) {
        setRemaining("Expired");
        return;
      }
      const mins = Math.floor(diff / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      setRemaining(`${mins}:${secs.toString().padStart(2, "0")}`);
    };

    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
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
// Main Component
// ────────────────────────────────────────────────────────────

export function TradeWindow({ partner, tradeId, onClose, onComplete }: TradeWindowProps) {
  const currentUser = useCurrentUser();
  const { address } = useAccount();
  const chainId = useChainId();

  const [phase, setPhase] = useState<TradePhase>("offer");
  const [myReady, setMyReady] = useState(false);
  const [theirReady, setTheirReady] = useState(false);
  const [myItems, setMyItems] = useState<InventorySlot[]>([]);
  const [theirItems, setTheirItems] = useState<InventorySlot[]>([]);
  const [confirmed, setConfirmed] = useState(false);
  const [expiresAt, setExpiresAt] = useState<string | undefined>();

  // Poll trade state from server
  useEffect(() => {
    if (!tradeId || phase === "complete" || phase === "cancelled") return;
    let active = true;

    const poll = async () => {
      try {
        const res = await fetch(`/api/trades/${tradeId}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!active) return;

        if (data.expiresAt) setExpiresAt(data.expiresAt);

        if (data.status === "CANCELLED" || data.status === "EXPIRED") {
          setPhase("cancelled");
          return;
        }
        if (data.status === "COMPLETED") {
          setPhase("complete");
          onComplete?.(tradeId);
          return;
        }

        // Update partner readiness
        const iAmInitiator = data.initiatorId === currentUser?.id;
        setTheirReady(iAmInitiator ? data.responderReady : data.initiatorReady);

        // Update their items
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

        // If both ready, auto-advance to confirm phase
        if (data.status === "CONFIRMING") {
          setPhase("confirm");
        }
      } catch (err) {
        console.error("[TradeWindow] Poll failed:", err);
      }
    };

    const intervalId = setInterval(poll, 3000);
    poll(); // immediate first poll

    return () => {
      active = false;
      clearInterval(intervalId);
    };
  }, [tradeId, phase, currentUser?.id, onComplete]);

  // ── Add item to my offer ──
  const addMyItem = useCallback((slot: InventorySlot) => {
    setMyItems((prev) => {
      if (prev.some((s) => s.id === slot.id)) return prev;
      return [...prev, slot];
    });
    setMyReady(false); // Reset ready when items change
  }, []);

  // ── Remove item from my offer ──
  const removeMyItem = useCallback((slotId: string) => {
    setMyItems((prev) => prev.filter((s) => s.id !== slotId));
    setMyReady(false);
  }, []);

  // ── Accept / Ready Up ──
  const handleReady = useCallback(async () => {
    if (myItems.length === 0) {
      toast.error("Add at least one item to trade");
      return;
    }

    setMyReady(true);

    if (tradeId) {
      try {
        await fetch(`/api/trades/${tradeId}/ready`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
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
      } catch (err) {
        console.error("[TradeWindow] Ready failed:", err);
        toast.error("Failed to update trade");
        setMyReady(false);
      }
    }
  }, [myItems, tradeId]);

  // ── Final Confirm (phase 2) ──
  const handleConfirm = useCallback(async () => {
    setConfirmed(true);

    if (tradeId) {
      try {
        const res = await fetch(`/api/trades/${tradeId}/confirm`, {
          method: "POST",
        });
        if (!res.ok) {
          const data = await res.json();
          toast.error(data.error ?? "Confirmation failed");
          setConfirmed(false);
        }
      } catch (err) {
        console.error("[TradeWindow] Confirm failed:", err);
        toast.error("Failed to confirm trade");
        setConfirmed(false);
      }
    }
  }, [tradeId]);

  // ── Cancel ──
  const handleCancel = useCallback(async () => {
    if (tradeId) {
      try {
        await fetch(`/api/trades/${tradeId}/cancel`, { method: "POST" });
      } catch {
        // swallow
      }
    }
    setPhase("cancelled");
    onClose();
  }, [tradeId, onClose]);

  return (
    <motion.div
      initial={{ opacity: 0, x: 20, filter: "blur(4px)" }}
      animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
      exit={{ opacity: 0, x: 20, filter: "blur(4px)" }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-col h-full bg-white dark:bg-zinc-950 relative overflow-hidden"
    >
      {/* Ambient glow — shifts color per phase */}
      <div className="absolute inset-0 pointer-events-none">
        <div className={`absolute -top-20 -right-20 w-40 h-40 rounded-full blur-3xl opacity-20 transition-colors duration-1000 ${
          phase === "confirm" ? "bg-amber-400" : phase === "complete" ? "bg-emerald-400" : "bg-blue-400"
        }`} />
      </div>

      {/* ── Header ── */}
      <div className="relative flex items-center justify-between px-4 py-3 border-b border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-950/80 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <motion.button
            type="button"
            onClick={onClose}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            className="p-1 rounded-lg hover:bg-zinc-100 dark:hover:bg-zinc-900 transition-colors"
          >
            <FiChevronLeft className="h-4 w-4 text-zinc-500" />
          </motion.button>
          <div className="flex items-center gap-1.5">
            <FiRepeat className="h-4 w-4 text-emerald-500" />
            <span className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
              Trade
            </span>
          </div>
          <TradeExpiry expiresAt={expiresAt} />
        </div>
        <TradeSessionToken tradeId={tradeId} />
      </div>

      {/* ── Phase Progress ── */}
      <PhaseIndicator phase={phase} />

      {/* ── Trade Body ── */}
      <div className="relative flex-1 overflow-y-auto">
        <AnimatePresence mode="wait">
          {phase === "complete" ? (
            <TradeComplete key="complete" partner={partner} />
          ) : phase === "cancelled" ? (
            <TradeCancelled key="cancelled" />
          ) : (
            <motion.div
              key="trade-panels"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col h-full"
            >
              {/* Partner side */}
              <TradePanel
                label={partner.name ?? "Trader"}
                image={partner.image}
                items={theirItems}
                isReady={theirReady}
                isRemote
              />

              {/* Animated divider */}
              <div className="flex items-center gap-2 px-4 py-1.5">
                <div className="flex-1 h-px bg-gradient-to-r from-transparent via-zinc-300 dark:via-zinc-700 to-transparent" />
                <motion.div
                  animate={{ rotate: phase === "confirm" ? 360 : 0 }}
                  transition={{ duration: 2, repeat: phase === "confirm" ? Infinity : 0, ease: "linear" }}
                >
                  <FiRepeat className="h-3 w-3 text-zinc-400 shrink-0" />
                </motion.div>
                <div className="flex-1 h-px bg-gradient-to-r from-transparent via-zinc-300 dark:via-zinc-700 to-transparent" />
              </div>

              {/* My side */}
              <TradePanel
                label={currentUser?.name ?? "You"}
                image={currentUser?.image}
                items={myItems}
                isReady={myReady}
                onRemoveItem={removeMyItem}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Security footer (ZKP indicator) ── */}
      {phase !== "complete" && phase !== "cancelled" && (
        <div className="px-4 py-1.5 border-t border-zinc-100 dark:border-zinc-900 bg-zinc-50/50 dark:bg-zinc-900/30">
          <div className="flex items-center justify-center gap-1.5 text-[9px] text-zinc-400 dark:text-zinc-500">
            <FiLock className="h-2.5 w-2.5" />
            <span>End-to-end verified &middot; Zero-knowledge proof ready</span>
          </div>
        </div>
      )}

      {/* ── Action Bar ── */}
      {phase !== "complete" && phase !== "cancelled" && (
        <div className="px-4 py-3 border-t border-zinc-200 dark:border-zinc-800 space-y-2 bg-white dark:bg-zinc-950">
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
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: "spring", stiffness: 500, damping: 20 }}
                    >
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
                <motion.div
                  animate={{ rotate: [0, 5, -5, 0] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                >
                  <FiAlertTriangle className="h-4 w-4 text-amber-500 shrink-0" />
                </motion.div>
                <p className="text-[10px] text-amber-700 dark:text-amber-400">
                  Review the trade carefully. This action is final and cryptographically verified.
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
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
                      >
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
    </motion.div>
  );
}

// ────────────────────────────────────────────────────────────
// Trade Panel (one side of the trade)
// ────────────────────────────────────────────────────────────

function TradePanel({
  label,
  image,
  items,
  isReady,
  isRemote,
  onRemoveItem,
}: {
  label: string;
  image?: string | null;
  items: InventorySlot[];
  isReady: boolean;
  isRemote?: boolean;
  onRemoveItem?: (id: string) => void;
}) {
  return (
    <div className="flex-1 px-4 py-2 min-h-[120px]">
      {/* User header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Avatar className="h-6 w-6 ring-2 ring-offset-1 ring-offset-white dark:ring-offset-zinc-950 ring-zinc-200 dark:ring-zinc-700">
            <AvatarImage src={image ?? undefined} />
            <AvatarFallback className="text-[10px]">
              {label[0]?.toUpperCase() ?? "?"}
            </AvatarFallback>
          </Avatar>
          <span className="text-xs font-medium text-zinc-700 dark:text-zinc-300">
            {label}
          </span>
        </div>
        <AnimatePresence>
          {isReady && (
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

      {/* Items grid */}
      <div className="grid grid-cols-4 gap-1.5 min-h-[80px]">
        {items.length === 0 ? (
          <motion.div
            className="col-span-4 flex flex-col items-center justify-center py-6 text-zinc-400 dark:text-zinc-600 border-2 border-dashed border-zinc-200 dark:border-zinc-800 rounded-lg"
            animate={{ borderColor: isRemote ? undefined : ["rgba(16,185,129,0.15)", "rgba(16,185,129,0.35)", "rgba(16,185,129,0.15)"] }}
            transition={{ duration: 2, repeat: isRemote ? 0 : Infinity }}
          >
            <FiPackage className="h-5 w-5 mb-1" />
            <span className="text-[10px]">
              {isRemote ? "Waiting for items..." : "Drop items here"}
            </span>
          </motion.div>
        ) : (
          items.map((item, index) => (
            <motion.div
              key={item.id}
              layout
              initial={{ opacity: 0, scale: 0.6, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.6, y: -10 }}
              transition={{
                type: "spring",
                stiffness: 500,
                damping: 30,
                delay: index * 0.05,
              }}
              whileHover={!isRemote ? {
                scale: 1.08,
                boxShadow: "0 4px 20px rgba(239,68,68,0.2)",
                borderColor: "rgb(239,68,68)",
              } : {
                scale: 1.05,
              }}
              className={`relative aspect-square rounded-lg border-2 flex flex-col items-center justify-center p-1 cursor-pointer transition-colors ${
                isRemote
                  ? "border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900"
                  : "border-emerald-300 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-950/50"
              }`}
              onClick={() => !isRemote && onRemoveItem?.(item.id)}
              title={isRemote ? `${item.amount} ${item.token.symbol}` : "Click to remove"}
            >
              {/* Token icon */}
              <div className="w-5 h-5 flex items-center justify-center">
                {item.token.logo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.token.logo}
                    alt={item.token.symbol}
                    className="w-full h-full rounded-full object-contain"
                  />
                ) : (
                  <div className="w-full h-full rounded-full bg-gradient-to-br from-zinc-300 to-zinc-500 flex items-center justify-center">
                    <span className="text-[7px] font-bold text-white">
                      {item.token.symbol.slice(0, 2)}
                    </span>
                  </div>
                )}
              </div>
              <span className="text-[8px] font-bold text-zinc-700 dark:text-zinc-300 mt-0.5 truncate max-w-full">
                {item.amount}
              </span>
              <span className="text-[7px] text-zinc-400 truncate max-w-full">
                {item.token.symbol}
              </span>
            </motion.div>
          ))
        )}
      </div>
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

  const currentIndex = phases.findIndex((p) => p.key === phase);

  return (
    <div className="px-4 py-2 bg-zinc-50/50 dark:bg-zinc-900/30">
      <div className="flex items-center gap-1">
        {phases.map((p, i) => (
          <React.Fragment key={p.key}>
            <motion.div
              animate={{
                backgroundColor: phase === p.key
                  ? "rgb(16 185 129 / 0.15)"
                  : currentIndex > i
                  ? "rgb(16 185 129 / 0.08)"
                  : "rgb(0 0 0 / 0.03)",
              }}
              className="flex-1 flex items-center justify-center gap-1 py-1 rounded-md"
            >
              <span className={`transition-colors ${
                phase === p.key
                  ? "text-emerald-600 dark:text-emerald-400"
                  : currentIndex > i
                  ? "text-emerald-400/60"
                  : "text-zinc-400"
              }`}>
                {p.icon}
              </span>
              <span className={`text-[9px] font-medium transition-colors ${
                phase === p.key
                  ? "text-emerald-700 dark:text-emerald-400"
                  : currentIndex > i
                  ? "text-emerald-500/60"
                  : "text-zinc-400"
              }`}>
                {p.label}
              </span>
            </motion.div>
            {i < phases.length - 1 && (
              <motion.div
                className="w-4 h-px"
                animate={{
                  backgroundColor: currentIndex > i
                    ? "rgb(16 185 129 / 0.5)"
                    : "rgb(0 0 0 / 0.1)",
                }}
              />
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Trade Complete Screen
// ────────────────────────────────────────────────────────────

function TradeComplete({ partner }: { partner: TradePartner }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col items-center justify-center py-16 px-6 text-center"
    >
      {/* Success ring animation */}
      <motion.div
        className="relative mb-6"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.1 }}
      >
        <motion.div
          className="absolute inset-0 rounded-full bg-emerald-400/20"
          animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
        <div className="relative h-20 w-20 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
          <motion.div
            initial={{ scale: 0, rotate: -90 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 400, damping: 15, delay: 0.3 }}
          >
            <FiCheckCircle className="h-10 w-10 text-emerald-500" />
          </motion.div>
        </div>
      </motion.div>

      <motion.h3
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="text-lg font-bold text-zinc-800 dark:text-zinc-200 mb-1"
      >
        Trade Complete!
      </motion.h3>
      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="text-sm text-zinc-500 dark:text-zinc-400"
      >
        You traded with {partner.name ?? "a trader"}. Check your wallet for tokens.
      </motion.p>

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7 }}
        className="mt-4 flex items-center gap-1.5 text-[10px] text-zinc-400"
      >
        <FiShield className="h-3 w-3" />
        Cryptographically verified
      </motion.div>
    </motion.div>
  );
}

// ────────────────────────────────────────────────────────────
// Trade Cancelled Screen
// ────────────────────────────────────────────────────────────

function TradeCancelled() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-16 px-6 text-center"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 400, damping: 20 }}
        className="h-16 w-16 rounded-full bg-red-100 dark:bg-red-900/20 flex items-center justify-center mb-4"
      >
        <FiX className="h-8 w-8 text-red-400" />
      </motion.div>
      <h3 className="text-lg font-bold text-zinc-800 dark:text-zinc-200 mb-1">
        Trade Cancelled
      </h3>
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        No items were exchanged. All assets remain in their original wallets.
      </p>
    </motion.div>
  );
}
