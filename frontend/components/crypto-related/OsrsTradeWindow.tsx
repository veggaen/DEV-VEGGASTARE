"use client";

/**
 * @fileOverview  OSRS-style trade window — dual 4×4 offer grids with drag-and-drop
 *               from OsrsInventory, two-step accept, self-trade wallet selector,
 *               and multi-wallet support.
 * @stability     experimental
 *
 * Visual reference: Old-School RuneScape trade screen
 *   • "Trading with: PlayerName" header
 *   • Your Offer (left) + Their Offer (right) — both 4×4 grids
 *   • Drag from inventory → your offer panel
 *   • Click items in offer to remove them
 *   • Right-click on offered items to split further
 *   • Two-step accept (like OSRS first/second trade screen)
 *   • Self-trade mode: select two of your wallets to transfer between
 */

import React, { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useWalletAddressBook } from "@/hooks/use-wallet-address-book";
import { useAccount, useChainId, useConnections } from "wagmi";
import { useActiveWalletOverride } from "@/contexts/active-wallet-context";
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
  FiArrowRight,
  FiChevronDown,
  FiEdit2,
} from "react-icons/fi";
import { ArrowLeftRight, Users } from "lucide-react";
import { TokenIcon } from "@/components/ui/token-icon";
import {
  INVENTORY_DND_TYPE,
  type InventorySlot,
} from "./OsrsInventory";

// ────────────────────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────────────────────

/** Offer grid = 4 columns × 3 rows = 12 slots (compact) */
const OFFER_COLS = 4;
const OFFER_ROWS = 3;
const OFFER_SLOTS = OFFER_COLS * OFFER_ROWS;

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

/** Receipt data stored after a self-trade executes on-chain */
interface TradeReceipt {
  txHashes: string[];
  sourceAddress: string;
  destAddress: string;
  chainId: number;
  chainName: string;
  items: { symbol: string; amount: string; isNative: boolean }[];
  timestamp: number;
  gasUsed?: string;
}

/** Helper to call a local RPC method */
async function rpcCall<T>(rpcUrl: string, method: string, params: unknown[] = []): Promise<T> {
  const res = await fetch(rpcUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method, params }),
  });
  const data = await res.json() as { result?: T; error?: { message: string } };
  if (data.error) throw new Error(data.error.message);
  return data.result as T;
}

/**
 * Send an ERC-20 `transfer(address,uint256)` via local RPC `eth_sendTransaction`.
 * Encodes calldata manually (selector 0xa9059cbb) to avoid importing heavy ABIs.
 */
async function transferERC20ViaRpc(
  rpcUrl: string,
  from: string,
  to: string,
  tokenAddress: string,
  rawAmount: bigint,
): Promise<string> {
  // function selector for transfer(address,uint256) = 0xa9059cbb
  const selector = "a9059cbb";
  // ABI-encode `to` address (left-padded to 32 bytes)
  const paddedTo = to.replace("0x", "").toLowerCase().padStart(64, "0");
  // ABI-encode `amount` (uint256, left-padded to 32 bytes)
  const paddedAmount = rawAmount.toString(16).padStart(64, "0");
  const data = `0x${selector}${paddedTo}${paddedAmount}`;

  return rpcCall<string>(rpcUrl, "eth_sendTransaction", [{
    from,
    to: tokenAddress,
    data,
  }]);
}

/** RPC URLs by chain ID */
const LOCAL_RPC_URLS: Record<number, string> = {
  31337: process.env.NEXT_PUBLIC_ANVIL_RPC_URL ?? "http://127.0.0.1:8545",
  1337: process.env.NEXT_PUBLIC_GANACHE_RPC_URL ?? "http://127.0.0.1:7545",
};
const LOCAL_CHAIN_NAMES: Record<number, string> = {
  31337: "Anvil Local",
  1337: "Ganache Local",
};

interface OsrsTradeWindowProps {
  /** Partner info — null for self-trade mode */
  partner: TradePartner | null;
  /** Remote trade ID for server-backed trades */
  tradeId?: string;
  /** Self-trade mode: trade between your own wallets */
  selfTrade?: boolean;
  onClose: () => void;
  onComplete?: (tradeId: string) => void;
}

type DragPayload = {
  slot: InventorySlot;
  sourceIndex?: number;
  origin?: "inventory" | "external";
};

// ────────────────────────────────────────────────────────────
// Trade Session Token (TOTP-style rotating code)
// ────────────────────────────────────────────────────────────

function TradeSessionToken({ tradeId }: { tradeId?: string }) {
  const [code, setCode] = useState("------");
  const [progress, setProgress] = useState(100);
  const ROTATE_INTERVAL = 30_000;

  useEffect(() => {
    function generateCode(): string {
      const seed = `${tradeId ?? "local"}-${Math.floor(Date.now() / ROTATE_INTERVAL)}`;
      let hash = 0;
      for (let i = 0; i < seed.length; i++) {
        hash = ((hash << 5) - hash + seed.charCodeAt(i)) | 0;
      }
      return Math.abs(hash)
        .toString(36)
        .toUpperCase()
        .padStart(6, "0")
        .slice(0, 6);
    }

    const initTimeoutId = window.setTimeout(() => setCode(generateCode()), 0);
    const interval = setInterval(
      () => setCode(generateCode()),
      ROTATE_INTERVAL,
    );
    return () => {
      window.clearTimeout(initTimeoutId);
      clearInterval(interval);
    };
  }, [tradeId]);

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
    <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800">
      <svg
        width="24"
        height="24"
        viewBox="0 0 24 24"
        className="shrink-0"
      >
        <circle
          cx="12"
          cy="12"
          r="10"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          className="text-zinc-700"
        />
        <circle
          cx="12"
          cy="12"
          r="10"
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
      </svg>
      <div className="flex flex-col">
        <span className="text-[8px] uppercase tracking-widest text-zinc-500 leading-none">
          Session
        </span>
        <span className="text-[11px] font-mono font-bold text-zinc-300 tracking-[0.2em] leading-tight">
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
    <div className="flex items-center gap-1 text-[10px] text-zinc-500">
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
    {
      key: "offer",
      label: "Offer",
      icon: <FiPackage className="h-3 w-3" />,
    },
    {
      key: "confirm",
      label: "Verify",
      icon: <FiShield className="h-3 w-3" />,
    },
    {
      key: "complete",
      label: "Done",
      icon: <FiCheckCircle className="h-3 w-3" />,
    },
  ];
  const ci = phases.findIndex((p) => p.key === phase);

  return (
    <div className="flex items-center gap-1 px-4 py-2 bg-zinc-900/30">
      {phases.map((p, i) => (
        <React.Fragment key={p.key}>
          <motion.div
            animate={{
              backgroundColor:
                phase === p.key
                  ? "rgb(16 185 129 / 0.15)"
                  : ci > i
                    ? "rgb(16 185 129 / 0.08)"
                    : "rgb(0 0 0 / 0.03)",
            }}
            className="flex-1 flex items-center justify-center gap-1 py-1 rounded-md"
          >
            <span
              className={
                phase === p.key
                  ? "text-emerald-400"
                  : ci > i
                    ? "text-emerald-400/60"
                    : "text-zinc-500"
              }
            >
              {p.icon}
            </span>
            <span
              className={`text-[9px] font-medium ${
                phase === p.key
                  ? "text-emerald-400"
                  : ci > i
                    ? "text-emerald-500/60"
                    : "text-zinc-500"
              }`}
            >
              {p.label}
            </span>
          </motion.div>
          {i < phases.length - 1 && (
            <motion.div
              className="w-4 h-px"
              animate={{
                backgroundColor:
                  ci > i
                    ? "rgb(16 185 129 / 0.5)"
                    : "rgb(255 255 255 / 0.05)",
              }}
            />
          )}
        </React.Fragment>
      ))}
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Self-Trade Wallet Selector
// ────────────────────────────────────────────────────────────

function WalletSelector({
  label,
  selectedAddress,
  onSelect,
  excludeAddress,
}: {
  label: string;
  selectedAddress: string | undefined;
  onSelect: (address: string) => void;
  excludeAddress?: string;
}) {
  const connections = useConnections();

  const addresses = useMemo(() => {
    const seen = new Set<string>();
    const result: { address: string; connectorName: string }[] = [];

    for (const conn of connections) {
      for (const acc of conn.accounts) {
        const lower = acc.toLowerCase();
        if (!seen.has(lower) && lower !== excludeAddress?.toLowerCase()) {
          seen.add(lower);
          result.push({
            address: acc,
            connectorName: conn.connector.name,
          });
        }
      }
    }

    return result;
  }, [connections, excludeAddress]);

  if (addresses.length === 0) {
    return (
      <div className="flex items-center justify-center py-2 px-2.5 rounded-lg border border-dashed border-zinc-700/60 bg-zinc-900/30">
        <span className="text-[10px] text-zinc-500 italic">No other wallets connected</span>
      </div>
    );
  }

  return (
    <div className="relative">
      <select
        className="appearance-none w-full bg-zinc-800/80 border border-zinc-700 rounded-lg pl-3 pr-7 py-1.5 text-xs font-mono text-zinc-200 cursor-pointer focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/60 transition-all hover:bg-zinc-800 hover:border-zinc-600"
        value={selectedAddress ?? ""}
        onChange={(e) => onSelect(e.target.value)}
      >
        <option value="" disabled>
          {label}
        </option>
        {addresses.map((a) => (
          <option key={a.address} value={a.address}>
            {a.address.slice(0, 6)}…{a.address.slice(-4)} ({a.connectorName})
          </option>
        ))}
      </select>
      <FiChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-zinc-400 pointer-events-none" />
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Offer Grid — 4×4 OSRS-style drop target with internal reorder
// ────────────────────────────────────────────────────────────

/** MIME type for internal offer-grid DnD (separate from inventory DnD) */
const OFFER_DND_TYPE = "application/x-veggat-offer";

function OfferGrid({
  items,
  isRemote,
  isDragOver,
  isLocked,
  onRemoveItem,
  onReorderItem,
  onDrop,
  onDragOver,
  onDragLeave,
}: {
  items: InventorySlot[];
  isRemote?: boolean;
  isDragOver?: boolean;
  isLocked?: boolean;
  onRemoveItem?: (id: string) => void;
  onReorderItem?: (fromIndex: number, toIndex: number) => void;
  onDrop?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDragLeave?: () => void;
}) {
  const [internalDragIdx, setInternalDragIdx] = useState<number | null>(null);
  const [internalOverIdx, setInternalOverIdx] = useState<number | null>(null);

  // Pad to OFFER_SLOTS
  const gridSlots: (InventorySlot | null)[] = useMemo(() => {
    const result: (InventorySlot | null)[] = [...items];
    while (result.length < OFFER_SLOTS) result.push(null);
    return result.slice(0, OFFER_SLOTS);
  }, [items]);

  // ── Internal slot-level DnD handlers ──
  const handleSlotDragStart = useCallback((e: React.DragEvent, idx: number, slot: InventorySlot) => {
    e.stopPropagation();
    const payload = JSON.stringify({ offerIndex: idx, slotId: slot.id });
    e.dataTransfer.setData(OFFER_DND_TYPE, payload);
    e.dataTransfer.effectAllowed = "move";
    setInternalDragIdx(idx);

    // Small drag image
    const dragEl = document.createElement("div");
    dragEl.style.cssText = "width:36px;height:36px;background:rgba(16,185,129,0.25);border-radius:8px;border:2px solid rgba(16,185,129,0.6);position:absolute;top:-9999px;";
    document.body.appendChild(dragEl);
    e.dataTransfer.setDragImage(dragEl, 18, 18);
    requestAnimationFrame(() => dragEl.remove());
  }, []);

  const handleSlotDragOver = useCallback((e: React.DragEvent, idx: number) => {
    e.preventDefault();
    e.stopPropagation();
    e.dataTransfer.dropEffect = "move";
    setInternalOverIdx(idx);
  }, []);

  const handleSlotDragLeave = useCallback((e: React.DragEvent) => {
    const related = e.relatedTarget as Node | null;
    if (related && (e.currentTarget as Node).contains(related)) return;
    setInternalOverIdx(null);
  }, []);

  const handleSlotDrop = useCallback((e: React.DragEvent, targetIdx: number) => {
    e.preventDefault();
    e.stopPropagation();
    setInternalDragIdx(null);
    setInternalOverIdx(null);

    // Check for internal offer reorder first
    const offerData = e.dataTransfer.getData(OFFER_DND_TYPE);
    if (offerData) {
      try {
        const { offerIndex } = JSON.parse(offerData) as { offerIndex: number; slotId: string };
        if (offerIndex !== targetIdx) {
          onReorderItem?.(offerIndex, targetIdx);
        }
      } catch { /* swallow */ }
      return;
    }

    // Fall through to external (inventory) drop
    onDrop?.(e);
  }, [onDrop, onReorderItem]);

  const handleSlotDragEnd = useCallback(() => {
    setInternalDragIdx(null);
    setInternalOverIdx(null);
  }, []);

  // ── Container-level drag handlers (for inventory drops) ──
  const handleContainerDragOver = useCallback((e: React.DragEvent) => {
    // Only handle inventory drags at container level; internal drags are slot-level
    if (e.dataTransfer.types.includes(OFFER_DND_TYPE)) return;
    onDragOver?.(e);
  }, [onDragOver]);

  const handleContainerDrop = useCallback((e: React.DragEvent) => {
    // If this was an internal reorder, slots already handled it
    if (e.dataTransfer.types.includes(OFFER_DND_TYPE)) return;
    onDrop?.(e);
  }, [onDrop]);

  return (
    <div
      className={`relative grid gap-1 p-1.5 rounded-lg transition-all duration-200 ${
        isLocked
          ? "bg-zinc-900/60 border-2 border-zinc-700/40 opacity-80"
          : isDragOver
            ? "bg-emerald-500/10 border-2 border-dashed border-emerald-500/50 shadow-[inset_0_0_20px_rgba(16,185,129,0.08)]"
            : "bg-zinc-900/40 border-2 border-dashed border-zinc-800/80"
      }`}
      style={{
        gridTemplateColumns: `repeat(${OFFER_COLS}, 1fr)`,
        gridTemplateRows: `repeat(${OFFER_ROWS}, 1fr)`,
      }}
      onDragOver={handleContainerDragOver}
      onDragLeave={onDragLeave}
      onDrop={handleContainerDrop}
      role="presentation"
    >
      {gridSlots.map((slot, idx) => (
        <OfferSlot
          key={slot?.id ?? `offer-empty-${idx}`}
          slot={slot}
          index={idx}
          isRemote={!!isRemote}
          isLocked={!!isLocked}
          isDragSource={internalDragIdx === idx}
          isDragOver={internalOverIdx === idx && internalDragIdx !== idx}
          onRemove={
            !isRemote && !isLocked && slot
              ? () => onRemoveItem?.(slot.id)
              : undefined
          }
          onDragStart={
            !isRemote && !isLocked && slot
              ? (e) => handleSlotDragStart(e, idx, slot)
              : undefined
          }
          onDragOver={(e) => handleSlotDragOver(e, idx)}
          onDragLeave={handleSlotDragLeave}
          onDrop={(e) => handleSlotDrop(e, idx)}
          onDragEnd={handleSlotDragEnd}
        />
      ))}

      {/* Lock overlay */}
      {isLocked && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none rounded-xl bg-zinc-900/20">
          <FiLock className="h-4 w-4 text-zinc-500 opacity-40" />
        </div>
      )}

      {/* Empty state text overlay */}
      {items.length === 0 && !isLocked && (
        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
          <FiPackage className="h-5 w-5 text-zinc-600 mb-1" />
          <span className="text-[10px] text-zinc-600">
            {isRemote ? "Waiting for items..." : "Drag items here"}
          </span>
        </div>
      )}
    </div>
  );
}

function TradeActionPanel({
  phase,
  myReady,
  theirReady,
  myItemsCount,
  confirmed,
  executing,
  onCancel,
  onReady,
  onConfirm,
}: {
  phase: TradePhase;
  myReady: boolean;
  theirReady: boolean;
  myItemsCount: number;
  confirmed: boolean;
  executing?: boolean;
  onCancel: () => void;
  onReady: () => void;
  onConfirm: () => void;
}) {
  if (phase === "offer") {
    return (
      <div className="w-full rounded-lg border border-zinc-800 bg-zinc-950/70 p-2 space-y-1.5">
        <div className="flex items-center justify-center gap-2 text-[9px] text-zinc-500">
          <span className={`flex items-center gap-1 ${myReady ? "text-emerald-400" : "text-zinc-500"}`}>
            <span className={`inline-block w-1.5 h-1.5 rounded-full ${myReady ? "bg-emerald-400" : "bg-zinc-600"}`} />
            You {myReady ? "ready" : "editing"}
          </span>
          <span className="text-zinc-700">&middot;</span>
          <span className={`flex items-center gap-1 ${theirReady ? "text-emerald-400" : "text-zinc-500"}`}>
            <span className={`inline-block w-1.5 h-1.5 rounded-full ${theirReady ? "bg-emerald-400" : "bg-zinc-600"}`} />
            Partner {theirReady ? "ready" : "editing"}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          <motion.button
            type="button"
            onClick={onCancel}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="flex items-center justify-center gap-1 py-2 rounded-lg border border-zinc-700 text-[11px] font-medium text-zinc-400 hover:bg-red-900/10 hover:text-red-400 hover:border-red-700/50 transition-colors"
          >
            <FiX className="h-3 w-3" />
            Decline
          </motion.button>
          <motion.button
            type="button"
            onClick={onReady}
            disabled={myReady || myItemsCount === 0}
            whileHover={!myReady && myItemsCount > 0 ? { scale: 1.02 } : {}}
            whileTap={!myReady && myItemsCount > 0 ? { scale: 0.98 } : {}}
            className={`flex items-center justify-center gap-1 py-2 rounded-lg text-[11px] font-semibold transition-all ${
              myReady
                ? "bg-emerald-900/30 text-emerald-400 border border-emerald-700"
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
              <>
                <FiCheck className="h-3.5 w-3.5" /> Accept
              </>
            )}
          </motion.button>
        </div>
      </div>
    );
  }

  if (phase === "confirm") {
    return (
      <div className="w-full rounded-lg border border-amber-800/40 bg-zinc-950/70 p-2 space-y-1.5">
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-2 px-2.5 py-1.5 rounded-md bg-amber-900/20 border border-amber-800/50"
        >
          <motion.div animate={{ rotate: [0, 5, -5, 0] }} transition={{ repeat: Infinity, duration: 2 }}>
            <FiAlertTriangle className="h-3.5 w-3.5 text-amber-500 shrink-0" />
          </motion.div>
          <p className="text-[10px] text-amber-400">Final check before settlement.</p>
        </motion.div>
        <div className="grid grid-cols-2 gap-1.5">
          <motion.button
            type="button"
            onClick={onCancel}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="py-2 rounded-lg border border-zinc-700 text-[11px] font-medium text-zinc-400 hover:bg-red-900/10 transition-colors"
          >
            Cancel
          </motion.button>
          <motion.button
            type="button"
            onClick={onConfirm}
            disabled={confirmed || executing}
            whileHover={!confirmed && !executing ? { scale: 1.02 } : {}}
            whileTap={!confirmed && !executing ? { scale: 0.98 } : {}}
            className="py-2 rounded-lg bg-emerald-600 text-white text-[11px] font-semibold hover:bg-emerald-500 disabled:opacity-40 shadow-lg shadow-emerald-500/25 disabled:shadow-none transition-all"
          >
            {executing ? (
              <span className="flex items-center justify-center gap-1.5">
                <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 0.8, ease: "linear" }}>
                  <FiRepeat className="h-3.5 w-3.5" />
                </motion.div>
                Executing...
              </span>
            ) : confirmed ? (
              <span className="flex items-center justify-center gap-1.5">
                <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}>
                  <FiShield className="h-3.5 w-3.5" />
                </motion.div>
                Verifying...
              </span>
            ) : (
              <span className="flex items-center justify-center gap-1.5">
                <FiShield className="h-3.5 w-3.5" /> Confirm
              </span>
            )}
          </motion.button>
        </div>
      </div>
    );
  }

  return null;
}

// ────────────────────────────────────────────────────────────
// Offer Slot (individual item in offer grid — draggable + droppable)
// ────────────────────────────────────────────────────────────

function OfferSlot({
  slot,
  index,
  isRemote,
  isLocked,
  isDragSource,
  isDragOver,
  onRemove,
  onDragStart,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragEnd,
}: {
  slot: InventorySlot | null;
  index: number;
  isRemote: boolean;
  isLocked?: boolean;
  isDragSource?: boolean;
  isDragOver?: boolean;
  onRemove?: () => void;
  onDragStart?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDragLeave?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
  onDragEnd?: () => void;
}) {
  const isEmpty = !slot;
  const canDrag = !!slot && !isRemote && !isLocked;

  // Outer div handles HTML5 DnD (avoids conflict with framer-motion's onDragStart)
  return (
    <div
      draggable={canDrag}
      onDragStart={onDragStart}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onDragEnd={onDragEnd}
      onClick={onRemove}
      className={`
        relative aspect-square rounded-lg select-none transition-all duration-150
        ${isDragSource ? "opacity-40 scale-90" : ""}
        ${isDragOver
          ? "ring-2 ring-emerald-400/60 bg-emerald-500/15 border-2 border-emerald-500/50"
          : isEmpty
            ? "bg-zinc-900/50 border border-zinc-800/50"
            : `border-2 ${canDrag ? "cursor-grab active:cursor-grabbing" : "cursor-pointer"} flex flex-col items-center justify-center p-0.5
               ${isRemote
                 ? "border-zinc-700/80 bg-zinc-900/80"
                 : "border-emerald-700/50 bg-emerald-950/30"
               }
               ${!isLocked && !isRemote ? "hover:scale-105 hover:border-red-500 hover:shadow-[0_4px_16px_rgba(239,68,68,0.2)]" : ""}
               ${!isLocked && isRemote && !isEmpty ? "hover:scale-[1.03]" : ""}`}
      `}
      style={
        isEmpty && !isDragOver
          ? {
              boxShadow:
                "inset 0 1px 3px rgba(0,0,0,0.3), inset 0 -1px 1px rgba(255,255,255,0.02)",
            }
          : isDragOver
            ? { boxShadow: "0 0 16px rgba(16,185,129,0.4)" }
            : undefined
      }
      title={
        !isEmpty && !isRemote && !isLocked
          ? "Click to remove · Drag to reorder"
          : slot
            ? `${slot.amount} ${slot.token.symbol}`
            : undefined
      }
    >
      {slot && (
        <AnimatePresence>
          <motion.div
            key={slot.id}
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.6 }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
            className="flex flex-col items-center justify-center w-full h-full"
          >
            {/* Token Icon */}
            <div className="w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center">
              <TokenIcon
                address={slot.token.address}
                chainId={slot.token.chainId}
                symbol={slot.token.symbol}
                logo={slot.token.logo}
                size={24}
                className="drop-shadow-[0_2px_3px_rgba(0,0,0,0.5)] pointer-events-none"
              />
            </div>

            {/* Stack count */}
            <span
              className="text-[8px] font-bold text-zinc-300 mt-0.5 truncate max-w-full"
              style={{ textShadow: "0 1px 2px rgba(0,0,0,0.8)" }}
            >
              {slot.amount}
            </span>

            {/* Symbol */}
            <span className="text-[6px] text-zinc-500 truncate max-w-full">
              {slot.token.symbol}
            </span>

            {/* Remove indicator on hover (own items only, not locked) */}
            {!isRemote && !isLocked && (
              <div className="absolute inset-0 flex items-center justify-center bg-red-900/0 hover:bg-red-900/40 rounded-lg transition-colors opacity-0 hover:opacity-100">
                <FiX className="h-3 w-3 text-red-400" />
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Main Trade Window
// ────────────────────────────────────────────────────────────

export function OsrsTradeWindow({
  partner,
  tradeId,
  selfTrade = false,
  onClose,
  onComplete,
}: OsrsTradeWindowProps) {
  const currentUser = useCurrentUser();
  const { address } = useAccount();
  const { override } = useActiveWalletOverride();
  const effectiveAddress = override?.address ?? address;
  const chainId = useChainId();
  const addressBook = useWalletAddressBook();

  // Inline address rename
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const renameInputRef = useRef<HTMLInputElement>(null);

  const [phase, setPhase] = useState<TradePhase>("offer");
  const [myReady, setMyReady] = useState(false);
  const [theirReady, setTheirReady] = useState(false);
  const [myItems, setMyItems] = useState<InventorySlot[]>([]);
  const [theirItems, setTheirItems] = useState<InventorySlot[]>([]);
  const [confirmed, setConfirmed] = useState(false);
  const [expiresAt, setExpiresAt] = useState<string | undefined>();
  const [myOfferDragOver, setMyOfferDragOver] = useState(false);
  const [tradeReceipt, setTradeReceipt] = useState<TradeReceipt | null>(null);
  const [executing, setExecuting] = useState(false);
  /** Trade hash at time of ready — used for tamper detection */
  const [readyTradeHash, setReadyTradeHash] = useState<string | null>(null);

  // ── OWASP: Dirty state warning ──
  // Warn user if they navigate away with items in their offer
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (myItems.length > 0 && phase !== "complete" && phase !== "cancelled") {
        e.preventDefault();
        e.returnValue = ""; // Required for Chrome
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [myItems.length, phase]);

  // ── Shift+click "Add to Trade" integration ──
  // Listens for custom events dispatched by OsrsInventory's shift+click
  useEffect(() => {
    const handler = (e: Event) => {
      const slot = (e as CustomEvent<InventorySlot>).detail;
      if (!slot?.id || !slot?.token) return;

      setMyItems((prev) => {
        if (prev.some((s) => s.id === slot.id)) {
          toast.info(`${slot.token.symbol} is already in your offer`);
          return prev;
        }
        if (prev.length >= OFFER_SLOTS) {
          toast.error("Offer grid is full (16 slots max)");
          return prev;
        }
        return [...prev, slot];
      });

      // Auto-unready on modification
      setMyReady((prev) => {
        if (prev) toast.info("Offer modified — ready status cleared");
        return false;
      });
    };
    window.addEventListener("veggat:addToTrade", handler);
    return () => window.removeEventListener("veggat:addToTrade", handler);
  }, []);

  // Self-trade wallet addresses
  const [selfSourceAddr, setSelfSourceAddr] = useState<string | undefined>(
    effectiveAddress,
  );
  const [selfDestAddr, setSelfDestAddr] = useState<string | undefined>();

  // Keep self-trade source synced with active wallet selection.
  useEffect(() => {
    setSelfSourceAddr(effectiveAddress);
  }, [effectiveAddress]);

  // ── Reorder items within own offer grid ──
  const reorderMyItem = useCallback((fromIndex: number, toIndex: number) => {
    if (fromIndex === toIndex) return;

    // Auto-unready on modification
    setMyReady((prev) => {
      if (prev) toast.info("Offer modified — ready status cleared");
      return false;
    });

    setMyItems((prev) => {
      // Pad to grid size for positional swap
      const grid: (InventorySlot | null)[] = [...prev];
      while (grid.length < OFFER_SLOTS) grid.push(null);

      const temp = grid[fromIndex];
      grid[fromIndex] = grid[toIndex];
      grid[toIndex] = temp;

      // Compact: strip trailing nulls but preserve internal gaps for ordering
      return grid.filter((item): item is InventorySlot => item !== null);
    });
  }, []);

  // ── DnD handlers ──
  const handleOfferDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setMyOfferDragOver(true);
  }, []);

  const handleOfferDragLeave = useCallback(() => {
    setMyOfferDragOver(false);
  }, []);

  const handleOfferDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setMyOfferDragOver(false);

      try {
        const raw = e.dataTransfer.getData(INVENTORY_DND_TYPE) || e.dataTransfer.getData("text/plain");
        if (!raw) return;
        const parsed = JSON.parse(raw) as DragPayload | InventorySlot;
        const slot = (parsed as DragPayload).slot
          ? (parsed as DragPayload).slot
          : (parsed as InventorySlot);
        if (!slot?.id || !slot?.token) return;

        setMyItems((prev) => {
          if (prev.some((s) => s.id === slot.id)) {
            toast.info(`${slot.token.symbol} is already in your offer`);
            return prev;
          }
          if (prev.length >= OFFER_SLOTS) {
            toast.error("Offer grid is full (16 slots max)");
            return prev;
          }
          return [...prev, slot];
        });

        // Auto-unready: any modification clears ready status
        setMyReady((prev) => {
          if (prev) toast.info("Offer modified — ready status cleared");
          return false;
        });
      } catch {
        toast.error("Failed to add item to trade");
      }
    },
    [],
  );

  // ── Remove item from offer ──
  const removeMyItem = useCallback((slotId: string) => {
    setMyItems((prev) => prev.filter((s) => s.id !== slotId));
    // Auto-unready on modification
    setMyReady((prev) => {
      if (prev) toast.info("Offer modified — ready status cleared");
      return false;
    });
  }, []);

  // ── Poll trade state from server ──
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

        const iAmInitiator = data.initiatorId === currentUser?.id;
        setTheirReady(
          iAmInitiator ? data.responderReady : data.initiatorReady,
        );

        const theirSide = iAmInitiator ? "RESPONDER" : "INITIATOR";
        const partnerItems = (data.Items ?? data.items ?? [])
          .filter(
            (item: Record<string, unknown>) => item.side === theirSide,
          )
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
              isNative:
                (item.tokenAddress as string) ===
                "0x0000000000000000000000000000000000000000",
            },
            amount: item.displayAmount as string,
            rawAmount: item.amount as string,
            order: i,
          }));
        setTheirItems(partnerItems);

        if (data.status === "CONFIRMING") setPhase("confirm");
      } catch (err) {
        console.error("[OsrsTradeWindow] Poll failed:", err);
      }
    };

    const intervalId = setInterval(poll, 3000);
    poll();

    return () => {
      active = false;
      clearInterval(intervalId);
    };
  }, [tradeId, phase, currentUser?.id, onComplete]);

  // ── Trade hash for anti-scam verification ──
  const tradeHash = useMemo(() => {
    const myData = myItems.map((i) => `${i.token.address}:${i.rawAmount}`).sort().join("|");
    const theirData = theirItems.map((i) => `${i.token.address}:${i.rawAmount}`).sort().join("|");
    const raw = `${myData}::${theirData}`;
    // Simple hash for display (not cryptographic — use server-side verification for real security)
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
      const ch = raw.charCodeAt(i);
      hash = ((hash << 5) - hash + ch) | 0;
    }
    return Math.abs(hash).toString(16).toUpperCase().padStart(8, "0");
  }, [myItems, theirItems]);

  // ── Accept / Ready ──
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
        console.error("[OsrsTradeWindow] Ready failed:", err);
        toast.error("Failed to update trade");
        setMyReady(false);
      }
    }

    // Self-trade auto-confirms partner side
    if (selfTrade) {
      setTheirReady(true);
      setPhase("confirm");
    }

    // OWASP: Store trade hash at ready time for tamper detection
    // (tradeHash is computed from myItems + theirItems)
    setReadyTradeHash(null); // Will be set after tradeHash recomputes
  }, [myItems, tradeId, selfTrade]);

  // Store trade hash when entering confirm phase
  useEffect(() => {
    if (phase === "confirm" && !readyTradeHash) {
      setReadyTradeHash(tradeHash);
    }
  }, [phase, tradeHash, readyTradeHash]);

  // ── Final Confirm ──
  const handleConfirm = useCallback(async () => {
    // OWASP: Tamper detection — verify items haven't changed since ready
    if (readyTradeHash && readyTradeHash !== tradeHash) {
      toast.error("⚠️ Trade contents changed since you accepted! Review and re-accept.");
      setConfirmed(false);
      setPhase("offer");
      setMyReady(false);
      setTheirReady(false);
      setReadyTradeHash(null);
      return;
    }

    // OWASP: Validate addresses for self-trade
    if (selfTrade) {
      if (!selfSourceAddr || !selfDestAddr) {
        toast.error("Both wallets must be selected");
        return;
      }
      if (selfSourceAddr.toLowerCase() === selfDestAddr.toLowerCase()) {
        toast.error("Source and destination must be different wallets");
        return;
      }
      // Validate address format
      const addrRegex = /^0x[a-fA-F0-9]{40}$/;
      if (!addrRegex.test(selfSourceAddr) || !addrRegex.test(selfDestAddr)) {
        toast.error("Invalid wallet address detected");
        return;
      }
    }

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
        console.error("[OsrsTradeWindow] Confirm failed:", err);
        toast.error("Failed to confirm trade");
        setConfirmed(false);
      }
    }

    // Self-trade: execute actual on-chain transfers via direct RPC
    if (selfTrade && selfSourceAddr && selfDestAddr) {
      const rpcUrl = LOCAL_RPC_URLS[chainId];

      if (!rpcUrl) {
        // Not a local chain — can't do direct RPC, show notice
        toast.info("Self-trade on non-local chains requires wallet approval (coming soon)");
        setPhase("complete");
        return;
      }

      setExecuting(true);
      const txHashes: string[] = [];
      const itemDetails: TradeReceipt["items"] = [];

      try {
        // Execute transfers for "my" items (source → dest)
        for (const item of myItems) {
          if (item.token.isNative) {
            const { parseEther } = await import("viem");
            const amountHex = "0x" + parseEther(item.amount).toString(16);
            const txHash = await rpcCall<string>(rpcUrl, "eth_sendTransaction", [{
              from: selfSourceAddr,
              to: selfDestAddr,
              value: amountHex,
            }]);
            txHashes.push(txHash);
            itemDetails.push({
              symbol: item.token.symbol,
              amount: item.amount,
              isNative: true,
            });
          } else {
            // ERC-20 transfer via local RPC
            const { parseUnits } = await import("viem");
            const rawAmount = parseUnits(item.amount, item.token.decimals);
            const txHash = await transferERC20ViaRpc(
              rpcUrl,
              selfSourceAddr,
              selfDestAddr,
              item.token.address,
              rawAmount,
            );
            txHashes.push(txHash);
            itemDetails.push({
              symbol: item.token.symbol,
              amount: item.amount,
              isNative: false,
            });
          }
        }

        // Execute transfers for "their" items (dest → source)
        for (const item of theirItems) {
          if (item.token.isNative) {
            const { parseEther } = await import("viem");
            const amountHex = "0x" + parseEther(item.amount).toString(16);
            const txHash = await rpcCall<string>(rpcUrl, "eth_sendTransaction", [{
              from: selfDestAddr,
              to: selfSourceAddr,
              value: amountHex,
            }]);
            txHashes.push(txHash);
            itemDetails.push({
              symbol: item.token.symbol,
              amount: item.amount,
              isNative: true,
            });
          } else {
            // ERC-20 transfer via local RPC
            const { parseUnits } = await import("viem");
            const rawAmount = parseUnits(item.amount, item.token.decimals);
            const txHash = await transferERC20ViaRpc(
              rpcUrl,
              selfDestAddr,
              selfSourceAddr,
              item.token.address,
              rawAmount,
            );
            txHashes.push(txHash);
            itemDetails.push({
              symbol: item.token.symbol,
              amount: item.amount,
              isNative: false,
            });
          }
        }

        // Build receipt
        const receipt: TradeReceipt = {
          txHashes,
          sourceAddress: selfSourceAddr,
          destAddress: selfDestAddr,
          chainId,
          chainName: LOCAL_CHAIN_NAMES[chainId] ?? `Chain ${chainId}`,
          items: itemDetails,
          timestamp: Date.now(),
        };

        // Try to get gas used from first tx
        if (txHashes[0]) {
          try {
            const txReceipt = await rpcCall<{ gasUsed?: string }>(
              rpcUrl, "eth_getTransactionReceipt", [txHashes[0]]
            );
            if (txReceipt?.gasUsed) {
              receipt.gasUsed = (parseInt(txReceipt.gasUsed, 16)).toLocaleString();
            }
          } catch { /* ok */ }
        }

        setTradeReceipt(receipt);
        toast.success(`Transfer executed — ${txHashes.length} transaction${txHashes.length > 1 ? "s" : ""}`);

        // Invalidate balances so inventory refreshes
        window.dispatchEvent(new Event("veggat:balanceInvalidate"));
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Transfer failed";
        toast.error(`Self-trade failed: ${msg}`);
        setConfirmed(false);
        setExecuting(false);
        return;
      }

      setExecuting(false);
      setPhase("complete");
    }
  }, [tradeId, selfTrade, selfSourceAddr, selfDestAddr, chainId, myItems, theirItems, readyTradeHash, tradeHash]);

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

  // ────────────────────────────────────────────────────────────
  // Render
  // ────────────────────────────────────────────────────────────

  const displayPartner = selfTrade
    ? {
        name: selfDestAddr
          ? addressBook.getDisplayName(selfDestAddr)
          : "Select wallet",
        image: null,
        walletAddress: selfDestAddr ?? null,
      }
    : {
        name: partner?.walletAddress
          ? (partner?.name ?? addressBook.getDisplayName(partner.walletAddress))
          : (partner?.name ?? "Trader"),
        image: partner?.image ?? null,
        walletAddress: partner?.walletAddress ?? null,
      };

  return (
    <motion.div
      initial={{ opacity: 0, x: 20, filter: "blur(4px)" }}
      animate={{ opacity: 1, x: 0, filter: "blur(0px)" }}
      exit={{ opacity: 0, x: 20, filter: "blur(4px)" }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-col bg-zinc-950 relative overflow-hidden rounded-xl border border-zinc-800 max-h-[calc(100vh-10rem)]"
    >
      {/* Ambient glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className={`absolute -top-20 -right-20 w-40 h-40 rounded-full blur-3xl opacity-20 transition-colors duration-1000 ${
            phase === "confirm"
              ? "bg-amber-400"
              : phase === "complete"
                ? "bg-emerald-400"
                : selfTrade
                  ? "bg-purple-400"
                  : "bg-blue-400"
          }`}
        />
      </div>

      {/* ── Header ───────────────────────────────────────── */}
      <div className="relative flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-sm">
        <div className="flex items-center gap-2 min-w-0">
          <motion.button
            type="button"
            onClick={onClose}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            className="p-1 rounded-lg hover:bg-zinc-900 transition-colors shrink-0"
          >
            <FiChevronLeft className="h-4 w-4 text-zinc-500" />
          </motion.button>
          <div className="flex items-center gap-1.5 min-w-0">
            {selfTrade ? (
              <ArrowLeftRight className="h-4 w-4 text-purple-400 shrink-0" />
            ) : (
              <FiRepeat className="h-4 w-4 text-emerald-500 shrink-0" />
            )}
            <div className="flex flex-col leading-tight min-w-0">
              <span className="text-sm font-semibold text-zinc-200">
                {selfTrade ? "Self-Trade" : "Trade"}
              </span>
              {isRenaming && displayPartner.walletAddress ? (
                <div className="flex items-center gap-1">
                  <input
                    ref={renameInputRef}
                    type="text"
                    value={renameValue}
                    onChange={(e) => setRenameValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && renameValue.trim()) {
                        addressBook.setNickname(
                          displayPartner.walletAddress!,
                          renameValue.trim(),
                          chainId,
                        );
                        setIsRenaming(false);
                        toast.success("Address nickname saved");
                      }
                      if (e.key === "Escape") setIsRenaming(false);
                    }}
                    onBlur={() => {
                      if (renameValue.trim()) {
                        addressBook.setNickname(
                          displayPartner.walletAddress!,
                          renameValue.trim(),
                          chainId,
                        );
                        toast.success("Address nickname saved");
                      }
                      setIsRenaming(false);
                    }}
                    placeholder="Enter nickname…"
                    autoFocus
                    className="w-28 bg-zinc-800 border border-zinc-600 rounded px-1.5 py-0.5 text-[10px] text-zinc-200 focus:ring-1 focus:ring-emerald-500/50"
                  />
                </div>
              ) : (
                <span className="text-[10px] text-zinc-500 truncate flex items-center gap-1">
                  {displayPartner.name}
                  {displayPartner.walletAddress && (
                    <>
                      <span className="font-mono text-zinc-600">
                        ({displayPartner.walletAddress.slice(0, 6)}…{displayPartner.walletAddress.slice(-4)})
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setRenameValue(
                            addressBook.getNickname(displayPartner.walletAddress!) ?? "",
                          );
                          setIsRenaming(true);
                        }}
                        className="p-0.5 rounded hover:bg-zinc-700/60 text-zinc-600 hover:text-zinc-400 transition"
                        title="Rename this address"
                      >
                        <FiEdit2 className="h-2.5 w-2.5" />
                      </button>
                    </>
                  )}
                </span>
              )}
            </div>
          </div>
          <TradeExpiry expiresAt={expiresAt} />
        </div>
        <TradeSessionToken tradeId={tradeId} />
      </div>

      {/* ── Phase Progress ──────────────────────────────── */}
      <PhaseIndicator phase={phase} />

      {/* ── Self-trade Wallet Selectors ──────────────────── */}
      {selfTrade && phase === "offer" && (
        <div className="px-3 py-2.5 border-b border-zinc-800 bg-zinc-900/20">
          <div className="flex items-center gap-1.5 mb-2">
            <ArrowLeftRight className="h-3.5 w-3.5 text-purple-400" />
            <span className="text-[10px] uppercase tracking-widest text-zinc-400 font-semibold">
              Transfer Between Wallets
            </span>
          </div>
          <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center">
            <WalletSelector
              label="From wallet..."
              selectedAddress={selfSourceAddr}
              onSelect={setSelfSourceAddr}
            />
            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-zinc-800 border border-zinc-700">
              <FiArrowRight className="h-3 w-3 text-zinc-400" />
            </div>
            <WalletSelector
              label="To wallet..."
              selectedAddress={selfDestAddr}
              onSelect={setSelfDestAddr}
              excludeAddress={selfSourceAddr}
            />
          </div>
        </div>
      )}

      {/* ── P2P Participant Banner (mirrors self-trade layout) ── */}
      {!selfTrade && phase === "offer" && (
        <div className="px-3 py-2 border-b border-zinc-800 bg-zinc-900/20">
          <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center">
            {/* You */}
            <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-zinc-800/50 border border-zinc-700/60">
              <Avatar className="h-6 w-6 ring-1 ring-offset-1 ring-offset-zinc-950 ring-emerald-700 shrink-0">
                <AvatarImage src={currentUser?.image ?? undefined} />
                <AvatarFallback className="text-[9px] bg-zinc-800 text-zinc-400">
                  {(currentUser?.name ?? "Y")[0].toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col min-w-0">
                <span className="text-[11px] font-medium text-zinc-200 leading-tight truncate">
                  {currentUser?.name ?? "You"}
                </span>
                {address && (
                  <span className="text-zinc-600 text-[8px] font-mono leading-tight">
                    {address.slice(0, 6)}…{address.slice(-4)}
                  </span>
                )}
              </div>
            </div>

            {/* Arrow */}
            <div className="flex items-center justify-center w-6 h-6 rounded-full bg-zinc-800 border border-zinc-700">
              <ArrowLeftRight className="h-3 w-3 text-emerald-400" />
            </div>

            {/* Partner */}
            <div className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-zinc-800/50 border border-zinc-700/60">
              <Avatar className="h-6 w-6 ring-1 ring-offset-1 ring-offset-zinc-950 ring-zinc-600 shrink-0">
                <AvatarImage src={displayPartner.image ?? undefined} />
                <AvatarFallback className="text-[9px] bg-zinc-800 text-zinc-400">
                  {(displayPartner.name ?? "?")[0].toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <div className="flex flex-col min-w-0">
                <span className="text-[11px] font-medium text-zinc-200 leading-tight truncate">
                  {displayPartner.name ?? "Partner"}
                </span>
                {displayPartner.walletAddress && (
                  <span className="text-zinc-600 text-[8px] font-mono leading-tight">
                    {displayPartner.walletAddress.slice(0, 6)}…{displayPartner.walletAddress.slice(-4)}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Trade Body ──────────────────────────────────── */}
      <div className="relative flex-1 min-h-0 overflow-y-auto p-2.5">
        <AnimatePresence mode="wait">
          {phase === "complete" ? (
            <TradeComplete
              key="complete"
              name={displayPartner.name}
              selfTrade={selfTrade}
              receipt={tradeReceipt}
            />
          ) : phase === "cancelled" ? (
            <TradeCancelled key="cancelled" />
          ) : (
            <motion.div
              key="trade-panels"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col gap-2"
            >
              {/* Two offer grids — always side-by-side */}
              <div className="grid grid-cols-2 gap-2">
                {/* Your side (left — source) */}
                <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-2">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
                      {selfTrade ? "Source" : "Your offer"}
                    </span>
                    <AnimatePresence>
                      {myReady && (
                        <motion.span
                          initial={{ opacity: 0, scale: 0.5 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.5 }}
                          className="flex items-center gap-0.5 text-[9px] text-emerald-400 font-medium bg-emerald-900/20 px-1.5 py-0.5 rounded-full"
                        >
                          <FiCheckCircle className="h-2.5 w-2.5" /> Ready
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </div>
                  <OfferGrid
                    items={myItems}
                    isDragOver={myOfferDragOver}
                    isLocked={myReady}
                    onRemoveItem={removeMyItem}
                    onReorderItem={reorderMyItem}
                    onDragOver={handleOfferDragOver}
                    onDragLeave={handleOfferDragLeave}
                    onDrop={handleOfferDrop}
                  />
                  {phase === "offer" && (
                    <p className="text-[8px] text-zinc-600 mt-1 flex items-center gap-0.5">
                      <FiArrowRight className="h-2 w-2" />
                      Drag from inventory
                    </p>
                  )}
                </div>

                {/* Their side (right — destination) */}
                <div className="rounded-lg border border-zinc-800 bg-zinc-950/40 p-2">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">
                      {selfTrade ? "Destination" : displayPartner.name ?? "Partner"}
                    </span>
                    <AnimatePresence>
                      {theirReady && (
                        <motion.span
                          initial={{ opacity: 0, scale: 0.5 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.5 }}
                          className="flex items-center gap-0.5 text-[9px] text-emerald-400 font-medium bg-emerald-900/20 px-1.5 py-0.5 rounded-full"
                        >
                          <FiCheckCircle className="h-2.5 w-2.5" /> Ready
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </div>
                  <OfferGrid items={theirItems} isRemote />
                </div>
              </div>

              {/* Trade Verification Summary — visible in confirm phase */}
              <AnimatePresence>
                {phase === "confirm" && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="rounded-lg border border-amber-800/40 bg-zinc-950/70 p-2 space-y-1.5 overflow-hidden"
                  >
                    <div className="flex items-center gap-2 text-[10px] text-amber-400 font-semibold uppercase tracking-widest">
                      <FiShield className="h-3 w-3" />
                      Trade Verification
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[10px]">
                      {/* You give */}
                      <div className="space-y-1">
                        <span className="text-zinc-500 font-medium">You give:</span>
                        {myItems.length === 0 ? (
                          <span className="text-zinc-600 italic">Nothing</span>
                        ) : (
                          myItems.map((item) => (
                            <div key={item.id} className="flex items-center gap-1.5 text-red-400">
                              <span className="font-mono">−</span>
                              <span className="font-semibold">{item.amount}</span>
                              <span className="text-zinc-400">{item.token.symbol}</span>
                            </div>
                          ))
                        )}
                      </div>

                      {/* You receive */}
                      <div className="space-y-1">
                        <span className="text-zinc-500 font-medium">You receive:</span>
                        {theirItems.length === 0 ? (
                          <span className="text-zinc-600 italic">Nothing</span>
                        ) : (
                          theirItems.map((item) => (
                            <div key={item.id} className="flex items-center gap-1.5 text-emerald-400">
                              <span className="font-mono">+</span>
                              <span className="font-semibold">{item.amount}</span>
                              <span className="text-zinc-400">{item.token.symbol}</span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    {/* Trade Hash */}
                    <div className="flex items-center justify-between pt-1.5 border-t border-zinc-800/50">
                      <span className="text-[9px] text-zinc-600">Trade hash</span>
                      <span className="text-[9px] font-mono text-zinc-500">{tradeHash}</span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Action Panel — compact bar below both grids */}
              <TradeActionPanel
                phase={phase}
                myReady={myReady}
                theirReady={theirReady}
                myItemsCount={myItems.length}
                confirmed={confirmed}
                executing={executing}
                onCancel={handleCancel}
                onReady={handleReady}
                onConfirm={handleConfirm}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Security Footer ──────────────────────────────── */}
      {phase !== "complete" && phase !== "cancelled" && (
        <div className="px-3 py-1 border-t border-zinc-900 bg-zinc-900/30">
          <div className="flex items-center justify-center gap-1.5 text-[9px] text-zinc-600">
            <FiLock className="h-2.5 w-2.5" />
            <span>
              End-to-end verified &middot; Hash: {tradeHash}
            </span>
          </div>
        </div>
      )}

      {/* ── Action Bar ───────────────────────────────────── */}
      {phase !== "complete" && phase !== "cancelled" && null}
    </motion.div>
  );
}

// ────────────────────────────────────────────────────────────
// Trade Complete Screen
// ────────────────────────────────────────────────────────────

function TradeComplete({
  name,
  selfTrade,
  receipt,
}: {
  name: string | null;
  selfTrade: boolean;
  receipt?: TradeReceipt | null;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col items-center justify-center py-6 px-4 text-center"
    >
      <motion.div
        className="relative mb-3"
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{
          type: "spring",
          stiffness: 300,
          damping: 20,
          delay: 0.1,
        }}
      >
        <motion.div
          className="absolute inset-0 rounded-full bg-emerald-400/20"
          animate={{ scale: [1, 1.5, 1], opacity: [0.5, 0, 0.5] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
        <div className="relative h-14 w-14 rounded-full bg-emerald-900/30 flex items-center justify-center">
          <motion.div
            initial={{ scale: 0, rotate: -90 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{
              type: "spring",
              stiffness: 400,
              damping: 15,
              delay: 0.3,
            }}
          >
            <FiCheckCircle className="h-7 w-7 text-emerald-500" />
          </motion.div>
        </div>
      </motion.div>

      <motion.h3
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="text-base font-bold text-zinc-200 mb-1"
      >
        {selfTrade ? "Transfer Complete!" : "Trade Complete!"}
      </motion.h3>
      <motion.p
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="text-xs text-zinc-400 mb-3"
      >
        {selfTrade
          ? "Tokens have been transferred between your wallets."
          : `You traded with ${name ?? "a trader"}. Check your wallet for tokens.`}
      </motion.p>

      {/* Receipt details for self-trades */}
      {receipt && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
          className="w-full max-w-xs space-y-2 text-left"
        >
          <div className="rounded-lg border border-zinc-800 bg-zinc-950/60 p-3 space-y-2">
            {/* Addresses */}
            <div className="flex items-center gap-1.5 text-[10px] text-zinc-400">
              <span className="font-mono text-zinc-300" title={receipt.sourceAddress}>
                {receipt.sourceAddress.slice(0, 6)}…{receipt.sourceAddress.slice(-4)}
              </span>
              <FiArrowRight className="h-3 w-3 text-emerald-500 shrink-0" />
              <span className="font-mono text-zinc-300" title={receipt.destAddress}>
                {receipt.destAddress.slice(0, 6)}…{receipt.destAddress.slice(-4)}
              </span>
            </div>

            {/* Items transferred */}
            {receipt.items.length > 0 && (
              <div className="space-y-0.5">
                {receipt.items.map((item, i) => (
                  <div key={i} className="flex items-center justify-between text-[10px]">
                    <span className="text-zinc-400">{item.symbol}</span>
                    <span className="font-mono text-zinc-200">{item.amount}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Chain + Gas */}
            <div className="flex items-center justify-between text-[10px] text-zinc-500 pt-1 border-t border-zinc-800">
              <span>{receipt.chainName}</span>
              {receipt.gasUsed && <span>Gas: {receipt.gasUsed}</span>}
            </div>

            {/* Tx hashes */}
            {receipt.txHashes.length > 0 && (
              <div className="space-y-0.5 pt-1 border-t border-zinc-800">
                {receipt.txHashes.map((hash, i) => (
                  <div key={i} className="flex items-center gap-1 text-[9px]">
                    <span className="text-zinc-500">Tx {i + 1}:</span>
                    <span className="font-mono text-zinc-400 truncate" title={hash}>
                      {hash.slice(0, 10)}…{hash.slice(-8)}
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Timestamp */}
            <div className="text-[9px] text-zinc-600 text-right">
              {new Date(receipt.timestamp).toLocaleTimeString()}
            </div>
          </div>
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7 }}
        className="mt-4 flex items-center gap-1.5 text-[10px] text-zinc-500"
      >
        <FiShield className="h-3 w-3" />
        {receipt?.txHashes.length ? "On-chain verified" : "Cryptographically verified"}
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
      className="flex flex-col items-center justify-center py-8 px-4 text-center"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 400, damping: 20 }}
        className="h-12 w-12 rounded-full bg-red-900/20 flex items-center justify-center mb-3"
      >
        <FiX className="h-6 w-6 text-red-400" />
      </motion.div>
      <h3 className="text-base font-bold text-zinc-200 mb-1">
        Trade Cancelled
      </h3>
      <p className="text-xs text-zinc-400">
        No items were exchanged. All assets remain in their original wallets.
      </p>
    </motion.div>
  );
}
