"use client";

import React, { useState, useCallback, useRef, useMemo, useEffect } from "react";
import { motion, AnimatePresence, Reorder } from "framer-motion";
import { useAccount, useChainId, useChains, useSwitchChain } from "wagmi";
import { formatUnits } from "viem";
import { useTokenBalances, type InventoryToken } from "@/hooks/use-token-balances";
import { toast } from "sonner";
import { FiChevronDown, FiRefreshCw, FiCopy, FiScissors, FiLayers, FiSend, FiRepeat, FiPackage, FiSearch, FiTarget } from "react-icons/fi";

// ────────────────────────────────────────────────────────────
// Types
// ────────────────────────────────────────────────────────────

export interface InventorySlot {
  id: string;
  token: InventoryToken;
  /** Display amount — may differ from token.displayBalance after splitting */
  amount: string;
  /** Raw amount as bigint string */
  rawAmount: string;
  /** Visual position in the grid */
  order: number;
}

interface CryptoInventoryProps {
  onTradeRequest?: (userId: string) => void;
  onSlotSelect?: (slot: InventorySlot | null) => void;
  /** If set, inventory is in "trade mode" — selected slots go into trade offer */
  tradeMode?: boolean;
  /** Compact mode for sidebar/sheet embedding */
  compact?: boolean;
  className?: string;
}

// ────────────────────────────────────────────────────────────
// Main Component
// ────────────────────────────────────────────────────────────

export function CryptoInventory({
  onTradeRequest,
  onSlotSelect,
  tradeMode = false,
  compact = false,
  className = "",
}: CryptoInventoryProps) {
  const { isConnected, address } = useAccount();
  const chainId = useChainId();
  const chains = useChains();
  const { switchChain, status: switchStatus } = useSwitchChain();
  const { tokens, loading, refetch } = useTokenBalances();

  const [slots, setSlots] = useState<InventorySlot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; slotId: string } | null>(null);
  const [splitDialog, setSplitDialog] = useState<string | null>(null);
  const [splitAmount, setSplitAmount] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  // Floating ghost: split item attached to cursor
  const [floatingItem, setFloatingItem] = useState<InventorySlot | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const inventoryRef = useRef<HTMLDivElement>(null);

  // Convert tokens to inventory slots
  const inventorySlots = useMemo(() => {
    if (slots.length > 0) return slots;
    return tokens.map((token, i) => ({
      id: token.id,
      token,
      amount: token.displayBalance,
      rawAmount: token.rawBalance.toString(),
      order: i,
    }));
  }, [tokens, slots]);

  // Filter slots by search
  const filteredSlots = useMemo(() => {
    if (!searchQuery.trim()) return inventorySlots;
    const q = searchQuery.toLowerCase();
    return inventorySlots.filter(
      (s) =>
        s.token.symbol.toLowerCase().includes(q) ||
        s.token.address.toLowerCase().includes(q)
    );
  }, [inventorySlots, searchQuery]);

  const activeChain = chains.find((c) => c.id === chainId);

  // ── Context Menu ──
  const handleContextMenu = useCallback((e: React.MouseEvent, slotId: string) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({ x: e.clientX, y: e.clientY, slotId });
  }, []);

  const closeContextMenu = useCallback(() => setContextMenu(null), []);

  // Close context menu on click outside
  React.useEffect(() => {
    if (contextMenu) {
      const handler = () => closeContextMenu();
      window.addEventListener("click", handler);
      return () => window.removeEventListener("click", handler);
    }
  }, [contextMenu, closeContextMenu]);

  // ── Split Logic ──
  const handleSplit = useCallback(
    (slotId: string) => {
      setSplitDialog(slotId);
      setSplitAmount("");
      closeContextMenu();
    },
    [closeContextMenu]
  );

  const confirmSplit = useCallback(() => {
    if (!splitDialog || !splitAmount) return;
    const sourceSlot = inventorySlots.find((s) => s.id === splitDialog);
    if (!sourceSlot) return;

    const splitRaw = BigInt(
      Math.floor(parseFloat(splitAmount) * 10 ** sourceSlot.token.decimals)
    );
    const sourceRaw = BigInt(sourceSlot.rawAmount);

    if (splitRaw <= BigInt(0) || splitRaw >= sourceRaw) {
      toast.error("Invalid split amount");
      return;
    }

    const remainingRaw = sourceRaw - splitRaw;
    const newSlotId = `${sourceSlot.id}:split-${Date.now()}`;

    // Deduct from source immediately
    setSlots((prev) => {
      const current = prev.length > 0 ? prev : inventorySlots;
      return current.map((s) =>
        s.id === splitDialog
          ? {
              ...s,
              rawAmount: remainingRaw.toString(),
              amount: formatCompactBalance(remainingRaw, s.token.decimals),
            }
          : s
      );
    });

    // Attach split portion to cursor as floating ghost
    const ghost: InventorySlot = {
      id: newSlotId,
      token: { ...sourceSlot.token, id: newSlotId },
      amount: formatCompactBalance(splitRaw, sourceSlot.token.decimals),
      rawAmount: splitRaw.toString(),
      order: -1,
    };
    setFloatingItem(ghost);
    setSplitDialog(null);
    toast.success(
      `${splitAmount} ${sourceSlot.token.symbol} split — click a slot to place it`,
      { duration: 4000 }
    );
  }, [splitDialog, splitAmount, inventorySlots]);

  // Mouse tracking for floating ghost
  useEffect(() => {
    if (!floatingItem) return;

    const handleMouseMove = (e: MouseEvent) => {
      setMousePos({ x: e.clientX, y: e.clientY });
    };

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        // Put the split back into the source
        setSlots((prev) => {
          const updated = [...prev];
          updated.push({
            ...floatingItem,
            order: updated.length,
          });
          return updated;
        });
        setFloatingItem(null);
        toast.info("Split cancelled — item returned to inventory");
      }
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("keydown", handleEscape);
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("keydown", handleEscape);
    };
  }, [floatingItem]);

  // Drop floating ghost onto a slot position
  const handleSlotDrop = useCallback(() => {
    if (!floatingItem) return;

    setSlots((prev) => {
      const current = prev.length > 0 ? prev : inventorySlots;
      return [
        ...current,
        {
          ...floatingItem,
          order: current.length,
        },
      ];
    });
    setFloatingItem(null);
    toast.success(`Placed ${floatingItem.amount} ${floatingItem.token.symbol}`);
  }, [floatingItem, inventorySlots]);

  // ── Merge Logic ──
  const handleMerge = useCallback(() => {
    setSlots((prev) => {
      const current = prev.length > 0 ? prev : inventorySlots;
      const merged = new Map<string, InventorySlot>();

      for (const slot of current) {
        // Key by base token (chainId:address)
        const baseKey = `${slot.token.chainId}:${slot.token.address}`;
        const existing = merged.get(baseKey);
        if (existing) {
          const totalRaw = BigInt(existing.rawAmount) + BigInt(slot.rawAmount);
          merged.set(baseKey, {
            ...existing,
            rawAmount: totalRaw.toString(),
            amount: formatCompactBalance(totalRaw, existing.token.decimals),
          });
        } else {
          merged.set(baseKey, { ...slot, id: baseKey });
        }
      }

      return Array.from(merged.values()).map((s, i) => ({ ...s, order: i }));
    });
    toast.success("Inventory merged");
  }, [inventorySlots]);

  // ── Copy Address ──
  const handleCopyAddress = useCallback(
    (slotId: string) => {
      const slot = inventorySlots.find((s) => s.id === slotId);
      if (slot) {
        navigator.clipboard.writeText(slot.token.address);
        toast.success(`Copied ${slot.token.symbol} address`);
      }
      closeContextMenu();
    },
    [inventorySlots, closeContextMenu]
  );

  // ── Select Slot ──
  const handleSlotClick = useCallback(
    (slotId: string) => {
      // If floating item active, drop it here
      if (floatingItem) {
        handleSlotDrop();
        return;
      }
      setSelectedSlot((prev) => (prev === slotId ? null : slotId));
      const slot = inventorySlots.find((s) => s.id === slotId);
      onSlotSelect?.(slot ?? null);
    },
    [inventorySlots, onSlotSelect, floatingItem, handleSlotDrop]
  );

  // ── Reorder ──
  const handleReorder = useCallback((newOrder: InventorySlot[]) => {
    setSlots(newOrder.map((s, i) => ({ ...s, order: i })));
  }, []);

  if (!isConnected) {
    return (
      <div className={`flex flex-col items-center justify-center py-12 text-center ${className}`}>
        <FiPackage className="h-12 w-12 text-zinc-400 dark:text-zinc-600 mb-3" />
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Connect a wallet to view your inventory</p>
      </div>
    );
  }

  return (
    <div className={`flex flex-col ${className}`} ref={inventoryRef}>
      {/* ── Header: Chain Selector + Actions ── */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-zinc-200 dark:border-zinc-800">
        {/* Chain Selector (bag tab) */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <select
              className="appearance-none bg-zinc-100 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg pl-3 pr-7 py-1.5 text-xs font-semibold text-zinc-800 dark:text-zinc-200 cursor-pointer focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
              value={chainId}
              onChange={(e) => switchChain({ chainId: Number(e.target.value) })}
              disabled={switchStatus === "pending"}
            >
              {chains.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <FiChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-zinc-400 pointer-events-none" />
          </div>
          {switchStatus === "pending" && (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
            >
              <FiRefreshCw className="h-3.5 w-3.5 text-amber-500" />
            </motion.div>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1">
          {/* Search */}
          <div className="relative">
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-24 bg-zinc-100 dark:bg-zinc-900 border border-zinc-300 dark:border-zinc-700 rounded-lg pl-7 pr-2 py-1 text-xs text-zinc-700 dark:text-zinc-300 placeholder:text-zinc-400 focus:ring-2 focus:ring-emerald-500/50 focus:w-36 transition-all"
            />
            <FiSearch className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-zinc-400" />
          </div>

          {/* Merge */}
          <button
            type="button"
            onClick={handleMerge}
            className="p-1.5 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors text-zinc-500 dark:text-zinc-400 hover:text-emerald-500"
            title="Merge all split stacks"
          >
            <FiLayers className="h-3.5 w-3.5" />
          </button>

          {/* Refresh */}
          <button
            type="button"
            onClick={() => {
              setSlots([]);
              refetch();
            }}
            className="p-1.5 rounded-lg hover:bg-zinc-200 dark:hover:bg-zinc-800 transition-colors text-zinc-500 dark:text-zinc-400 hover:text-emerald-500"
            title="Refresh balances"
          >
            <FiRefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* ── Inventory Grid ── */}
      <div className="relative flex-1 overflow-y-auto overflow-x-hidden scrollbar-thin scrollbar-thumb-zinc-300 dark:scrollbar-thumb-zinc-700">
        {loading && filteredSlots.length === 0 ? (
          <div className="flex items-center justify-center py-16">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
            >
              <FiRefreshCw className="h-6 w-6 text-zinc-400" />
            </motion.div>
          </div>
        ) : filteredSlots.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center px-4">
            <FiPackage className="h-8 w-8 text-zinc-400 dark:text-zinc-600 mb-2" />
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              {searchQuery ? "No tokens match your search" : "No tokens found on this chain"}
            </p>
          </div>
        ) : (
          <Reorder.Group
            axis="x"
            values={filteredSlots}
            onReorder={handleReorder}
            className={`grid gap-1.5 p-2 ${
              compact
                ? "grid-cols-4"
                : "grid-cols-4 sm:grid-cols-5 md:grid-cols-6 lg:grid-cols-7"
            }`}
            style={{ listStyle: "none" }}
          >
            <AnimatePresence mode="popLayout">
              {filteredSlots.map((slot) => (
                <InventorySlotCard
                  key={slot.id}
                  slot={slot}
                  isSelected={selectedSlot === slot.id}
                  tradeMode={tradeMode}
                  onClick={() => handleSlotClick(slot.id)}
                  onContextMenu={(e) => handleContextMenu(e, slot.id)}
                />
              ))}
            </AnimatePresence>
          </Reorder.Group>
        )}
      </div>

      {/* ── Status Bar ── */}
      <div className="flex items-center justify-between px-3 py-1.5 border-t border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950">
        <span className="text-[10px] text-zinc-400 dark:text-zinc-500">
          {filteredSlots.length} token{filteredSlots.length !== 1 ? "s" : ""} · {activeChain?.name ?? `Chain ${chainId}`}
        </span>
        {address && (
          <span className="text-[10px] font-mono text-zinc-400 dark:text-zinc-500 truncate max-w-[100px]">
            {address.slice(0, 6)}…{address.slice(-4)}
          </span>
        )}
      </div>

      {/* ── Context Menu Overlay ── */}
      <AnimatePresence>
        {contextMenu && (
          <InventoryContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            slotId={contextMenu.slotId}
            slot={inventorySlots.find((s) => s.id === contextMenu.slotId)}
            onSplit={() => handleSplit(contextMenu.slotId)}
            onCopy={() => handleCopyAddress(contextMenu.slotId)}
            onClose={closeContextMenu}
            tradeMode={tradeMode}
          />
        )}
      </AnimatePresence>

      {/* ── Split Dialog ── */}
      <AnimatePresence>
        {splitDialog && (
          <SplitDialog
            slot={inventorySlots.find((s) => s.id === splitDialog)}
            value={splitAmount}
            onChange={setSplitAmount}
            onConfirm={confirmSplit}
            onCancel={() => setSplitDialog(null)}
          />
        )}
      </AnimatePresence>

      {/* ── Floating Ghost (split attached to cursor) ── */}
      <AnimatePresence>
        {floatingItem && (
          <FloatingGhostItem
            item={floatingItem}
            x={mousePos.x}
            y={mousePos.y}
            onClick={handleSlotDrop}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Inventory Slot Card
// ────────────────────────────────────────────────────────────

function InventorySlotCard({
  slot,
  isSelected,
  tradeMode,
  onClick,
  onContextMenu,
}: {
  slot: InventorySlot;
  isSelected: boolean;
  tradeMode: boolean;
  onClick: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
}) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <Reorder.Item
      value={slot}
      layout
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.8 }}
      transition={{ type: "spring", stiffness: 500, damping: 30 }}
      whileDrag={{
        scale: 1.12,
        zIndex: 50,
        boxShadow: "0 8px 32px rgba(0,0,0,0.25)",
      }}
      className="list-none"
    >
      <motion.div
        onHoverStart={() => setIsHovered(true)}
        onHoverEnd={() => setIsHovered(false)}
        onClick={onClick}
        onContextMenu={onContextMenu}
        className={`
          relative aspect-square rounded-xl cursor-grab active:cursor-grabbing
          border-2 transition-colors duration-150 select-none
          flex flex-col items-center justify-center gap-0.5 p-1
          ${
            isSelected
              ? "border-emerald-500 bg-emerald-500/10 dark:bg-emerald-500/15 shadow-[0_0_12px_rgba(16,185,129,0.3)]"
              : "border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900 hover:border-zinc-400 dark:hover:border-zinc-600"
          }
          ${tradeMode ? "ring-1 ring-amber-500/30" : ""}
        `}
      >
        {/* Token Icon */}
        <div className="relative w-7 h-7 sm:w-8 sm:h-8 flex items-center justify-center">
          {slot.token.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={slot.token.logo}
              alt={slot.token.symbol}
              className="w-full h-full rounded-full object-contain"
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = "none";
              }}
            />
          ) : (
            <div className="w-full h-full rounded-full bg-linear-to-br from-zinc-300 to-zinc-500 dark:from-zinc-600 dark:to-zinc-800 flex items-center justify-center">
              <span className="text-[10px] font-bold text-white">
                {slot.token.symbol.slice(0, 2)}
              </span>
            </div>
          )}
        </div>

        {/* Stack Size (OSRS-style top-left overlay) */}
        <div className="absolute top-0.5 left-0.5 right-0.5">
          <span
            className={`text-[9px] sm:text-[10px] font-bold leading-none drop-shadow-[0_1px_2px_rgba(0,0,0,0.5)] px-0.5 ${getStackColor(slot.amount)}`}
          >
            {slot.amount}
          </span>
        </div>

        {/* Symbol */}
        <span className="text-[8px] sm:text-[9px] font-medium text-zinc-500 dark:text-zinc-400 truncate max-w-full leading-none">
          {slot.token.symbol}
        </span>

        {/* Hover Tooltip */}
        <AnimatePresence>
          {isHovered && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              className="absolute -top-14 left-1/2 -translate-x-1/2 z-50 pointer-events-none"
            >
              <div className="bg-zinc-900 dark:bg-zinc-800 text-white rounded-lg px-2.5 py-1.5 shadow-xl border border-zinc-700 whitespace-nowrap">
                <div className="text-[10px] font-semibold">{slot.token.symbol}</div>
                <div className="text-[9px] text-zinc-300">
                  {formatFullBalance(BigInt(slot.rawAmount), slot.token.decimals)} {slot.token.symbol}
                </div>
                <div className="text-[8px] text-zinc-500 font-mono mt-0.5">
                  {slot.token.address === "0x0000000000000000000000000000000000000000"
                    ? "Native"
                    : `${slot.token.address.slice(0, 8)}…${slot.token.address.slice(-6)}`}
                </div>
                {/* Arrow */}
                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-zinc-900 dark:bg-zinc-800 rotate-45 border-r border-b border-zinc-700" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </Reorder.Item>
  );
}

// ────────────────────────────────────────────────────────────
// Context Menu (right-click)
// ────────────────────────────────────────────────────────────

function InventoryContextMenu({
  x,
  y,
  slotId,
  slot,
  onSplit,
  onCopy,
  onClose,
  tradeMode,
}: {
  x: number;
  y: number;
  slotId: string;
  slot?: InventorySlot;
  onSplit: () => void;
  onCopy: () => void;
  onClose: () => void;
  tradeMode: boolean;
}) {
  const menuItems = [
    { icon: FiScissors, label: "Split Stack", action: onSplit },
    { icon: FiCopy, label: "Copy Address", action: onCopy },
    ...(tradeMode
      ? [{ icon: FiRepeat, label: "Add to Trade", action: onClose }]
      : []),
    { icon: FiSend, label: "Send", action: onClose },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
      transition={{ duration: 0.1 }}
      className="fixed z-100"
      style={{ left: x, top: y }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 rounded-xl shadow-2xl overflow-hidden min-w-[160px]">
        {/* Header */}
        {slot && (
          <div className="px-3 py-2 border-b border-zinc-100 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-950">
            <span className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
              {slot.token.symbol}
            </span>
            <span className="text-[10px] text-zinc-400 ml-1.5">{slot.amount}</span>
          </div>
        )}
        {/* Items */}
        {menuItems.map((item) => (
          <button
            key={item.label}
            type="button"
            onClick={item.action}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-zinc-700 dark:text-zinc-300 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors"
          >
            <item.icon className="h-3.5 w-3.5" />
            {item.label}
          </button>
        ))}
      </div>
    </motion.div>
  );
}

// ────────────────────────────────────────────────────────────
// Split Dialog
// ────────────────────────────────────────────────────────────

function SplitDialog({
  slot,
  value,
  onChange,
  onConfirm,
  onCancel,
}: {
  slot?: InventorySlot;
  value: string;
  onChange: (v: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!slot) return null;

  const maxAmount = parseFloat(
    formatUnits(BigInt(slot.rawAmount), slot.token.decimals)
  );

  const quickPercentages = [25, 50, 75];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-100 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={onCancel}
    >
      <motion.div
        initial={{ scale: 0.9, y: 10 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 10 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-white dark:bg-zinc-900 rounded-2xl border border-zinc-200 dark:border-zinc-700 shadow-2xl p-5 w-80"
      >
        <div className="flex items-center gap-2 mb-1">
          <FiScissors className="h-4 w-4 text-emerald-500" />
          <h3 className="text-sm font-semibold text-zinc-800 dark:text-zinc-200">
            Split {slot.token.symbol}
          </h3>
        </div>
        <p className="text-[10px] text-zinc-500 dark:text-zinc-400 mb-3">
          Stack: {slot.amount} {slot.token.symbol} &middot; Split will attach to your cursor
        </p>

        {/* Input */}
        <div className="relative mb-2">
          <input
            type="number"
            step="any"
            min="0"
            max={maxAmount}
            placeholder={`Amount to split off...`}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            autoFocus
            className="w-full bg-zinc-100 dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-800 dark:text-zinc-200 focus:ring-2 focus:ring-emerald-500/50 transition-all pr-14"
            onKeyDown={(e) => e.key === "Enter" && onConfirm()}
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-medium text-zinc-400">
            {slot.token.symbol}
          </span>
        </div>

        {/* Quick percentage buttons */}
        <div className="flex gap-1.5 mb-3">
          {quickPercentages.map((pct) => (
            <button
              key={pct}
              type="button"
              onClick={() => {
                const val = (maxAmount * pct) / 100;
                onChange(val.toFixed(slot.token.decimals > 4 ? 6 : slot.token.decimals));
              }}
              className="flex-1 py-1 rounded-md text-[10px] font-medium border border-zinc-200 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 hover:text-emerald-600 hover:border-emerald-300 transition-colors"
            >
              {pct}%
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 text-xs py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className="flex-1 text-xs py-2 rounded-xl bg-emerald-600 text-white hover:bg-emerald-500 shadow-lg shadow-emerald-500/25 transition-all font-semibold flex items-center justify-center gap-1.5"
          >
            <FiScissors className="h-3 w-3" />
            Split &amp; Grab
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ────────────────────────────────────────────────────────────
// Floating Ghost Item (split attached to cursor)
// ────────────────────────────────────────────────────────────

function FloatingGhostItem({
  item,
  x,
  y,
  onClick,
}: {
  item: InventorySlot;
  x: number;
  y: number;
  onClick: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.5 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.5 }}
      transition={{ type: "spring", stiffness: 500, damping: 25 }}
      className="fixed pointer-events-none z-200"
      style={{
        left: x - 28,
        top: y - 28,
      }}
    >
      {/* Pulsing ring */}
      <motion.div
        className="absolute inset-0 rounded-xl border-2 border-emerald-500"
        animate={{
          boxShadow: [
            "0 0 0 0 rgba(16,185,129,0.4)",
            "0 0 0 8px rgba(16,185,129,0)",
          ],
        }}
        transition={{ duration: 1.2, repeat: Infinity }}
      />

      {/* Card */}
      <div className="relative w-14 h-14 rounded-xl border-2 border-emerald-500 bg-emerald-500/10 backdrop-blur-md flex flex-col items-center justify-center shadow-2xl shadow-emerald-500/30">
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
            <div className="w-full h-full rounded-full bg-linear-to-br from-emerald-400 to-emerald-600 flex items-center justify-center">
              <span className="text-[7px] font-bold text-white">
                {item.token.symbol.slice(0, 2)}
              </span>
            </div>
          )}
        </div>
        <span className="text-[8px] font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
          {item.amount}
        </span>
        <span className="text-[7px] text-emerald-500/80">{item.token.symbol}</span>

        {/* Placement indicator */}
        <motion.div
          className="absolute -bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-0.5 text-[8px] text-emerald-500 font-medium whitespace-nowrap"
          animate={{ opacity: [0.5, 1, 0.5] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          <FiTarget className="h-2.5 w-2.5" />
          Click slot to place
        </motion.div>
      </div>
    </motion.div>
  );
}

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

/** OSRS-style stack color: white < 99K, yellow < 9.99M, green >= 10M */
function getStackColor(display: string): string {
  const stripped = display.replace(/[^0-9.KMBkmb]/g, "");
  const upper = stripped.toUpperCase();

  if (upper.includes("B") || upper.includes("G"))
    return "text-emerald-400"; // billions — green

  if (upper.includes("M")) {
    const num = parseFloat(upper.replace("M", ""));
    return num >= 10
      ? "text-emerald-400" // 10M+ — green
      : "text-white"; // <10M — white
  }

  if (upper.includes("K")) {
    const num = parseFloat(upper.replace("K", ""));
    return num >= 100
      ? "text-amber-300" // 100K+ — yellow
      : "text-white";
  }

  return "text-amber-100"; // small stacks — soft yellow/white
}

function formatCompactBalance(raw: bigint, decimals: number): string {
  const value = formatUnits(raw, decimals);
  const num = parseFloat(value);
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(1)}B`;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  if (num >= 1) return num.toFixed(2);
  if (num >= 0.0001) return num.toFixed(4);
  return num.toExponential(2);
}

function formatFullBalance(raw: bigint, decimals: number): string {
  const value = formatUnits(raw, decimals);
  const num = parseFloat(value);
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 6,
    minimumFractionDigits: 2,
  }).format(num);
}
