"use client";

import { useActiveWalletOverride } from "@/contexts/active-wallet-context";

/**
 * @fileOverview  OSRS-style 4×7 inventory grid with drag-and-drop, split stacks,
 *               context menu, and stack-size colour coding.
 * @stability     experimental
 *
 * Visual reference:  Old-School RuneScape inventory – 28 fixed slots
 *   • Occupied slots show token icon + stacked quantity (top-left overlay)
 *   • Empty slots are dark "stone" squares
 *   • Items are HTML5-draggable → compatible with OsrsTradeWindow drop targets
 *   • Right-click → context menu: Split · Copy Address · Send · Add to Trade
 */

import React, { useState, useCallback, useRef, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useAccount, useChainId, useChains, useSwitchChain } from "wagmi";
import { formatUnits } from "viem";
import { useTokenBalances, CHAIN_LOGOS, type InventoryToken } from "@/hooks/use-token-balances";
import { useNftBalances, type InventoryNft } from "@/hooks/use-nft-balances";
import { TokenIcon } from "@/components/ui/token-icon";
import { toast } from "sonner";
import {
  FiChevronDown,
  FiRefreshCw,
  FiCopy,
  FiScissors,
  FiLayers,
  FiSend,
  FiRepeat,
  FiPackage,
  FiSearch,
  FiTarget,
  FiExternalLink,
} from "react-icons/fi";

// ────────────────────────────────────────────────────────────
// Constants
// ────────────────────────────────────────────────────────────

/** OSRS inventory = 4 columns, minimum 7 rows = 28 slots, grows for more items */
const COLS = 4;
const MIN_ROWS = 7;
const MIN_SLOTS = COLS * MIN_ROWS;
const DRAG_THRESHOLD_PX = 8;

/** MIME type for HTML5 drag-and-drop */
export const INVENTORY_DND_TYPE = "application/x-veggat-slot";

/** Block explorer base URLs by chain ID */
const EXPLORER_URLS: Record<number, string> = {
  1: "https://etherscan.io",
  11155111: "https://sepolia.etherscan.io",
  8453: "https://basescan.org",
  84532: "https://sepolia.basescan.org",
  369: "https://scan.pulsechain.com",
  137: "https://polygonscan.com",
  42161: "https://arbiscan.io",
  10: "https://optimistic.etherscan.io",
};

/** Get explorer URL for a token address on a given chain */
function getExplorerTokenUrl(chainId: number, tokenAddress: string): string | null {
  const base = EXPLORER_URLS[chainId];
  if (!base) return null;
  if (tokenAddress === "0x0000000000000000000000000000000000000000") return base;
  return `${base}/token/${tokenAddress}`;
}

/** Get explorer URL for a wallet address on a given chain */
function getExplorerAddressUrl(chainId: number, walletAddress: string): string | null {
  const base = EXPLORER_URLS[chainId];
  if (!base) return null;
  return `${base}/address/${walletAddress}`;
}

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

type DragPayload = {
  slot: InventorySlot;
  sourceIndex?: number;
  origin: "inventory" | "external";
  movedRawAmount?: string;
  modifier?: "none" | "third" | "half";
};

interface OsrsInventoryProps {
  /** Callback when a slot is clicked */
  onSlotSelect?: (slot: InventorySlot | null) => void;
  /** If set, the inventory is in trade mode — context menu shows "Add to Trade" */
  tradeMode?: boolean;
  /** Shift+click callback — adds item to trade offer. When set + tradeMode=true,
   *  shift+click sends the slot to trade instead of splitting. */
  onAddToTrade?: (slot: InventorySlot) => void;
  /** Compact mode for sidebar/sheet embedding */
  compact?: boolean;
  className?: string;
}

// ────────────────────────────────────────────────────────────
// Main Component
// ────────────────────────────────────────────────────────────

export function OsrsInventory({
  onSlotSelect,
  tradeMode = false,
  onAddToTrade,
  compact = false,
  className = "",
}: OsrsInventoryProps) {
  const { isConnected, address } = useAccount();
  const chainId = useChainId();
  const chains = useChains();
  const { switchChain, status: switchStatus } = useSwitchChain();
  const { override } = useActiveWalletOverride();
  const { tokens, loading, refetch } = useTokenBalances();
  const { nfts, loading: nftsLoading, refetch: refetchNfts } = useNftBalances();

  /** Active tab: "tokens" (ERC-20 + native) or "nfts" (ERC-721/1155) */
  const [activeTab, setActiveTab] = useState<"tokens" | "nfts">("tokens");
  /** Sub-filter within the tokens tab */
  const [tokenFilter, setTokenFilter] = useState<"all" | "native" | "erc20" | "stable">("all");

  const effectiveAddress = override?.address ?? address;
  const effectiveConnected = Boolean(effectiveAddress) && (Boolean(override?.address) || isConnected);

  const [gridState, setGridState] = useState<(InventorySlot | null)[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    slotId: string;
  } | null>(null);
  const [splitDialog, setSplitDialog] = useState<string | null>(null);
  const [splitAmount, setSplitAmount] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [floatingItem, setFloatingItem] = useState<InventorySlot | null>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [draggedSlotId, setDraggedSlotId] = useState<string | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  /** Expanded detail panel — shows token info below grid without layout shift */
  const [detailSlotId, setDetailSlotId] = useState<string | null>(null);
  const inventoryRef = useRef<HTMLDivElement>(null);
  const pointerIntentRef = useRef<{
    slotId: string;
    sourceIndex: number;
    startX: number;
    startY: number;
    moved: boolean;
    shift: boolean;
    ctrl: boolean;
    meta: boolean;
  } | null>(null);

  // Track whether inventory's own drop handler consumed the current drag,
  // and the last payload so dragEnd can remove items dropped outside.
  const dragConsumedRef = useRef(false);
  const lastDragPayloadRef = useRef<DragPayload | null>(null);

  const activeChain = chains.find((c) => c.id === chainId);

  // Track whether we just finished a floating-item operation so the grid
  // sync below doesn't immediately overwrite user-modified grid state.
  const wasFloatingRef = useRef(false);

  // Track previous tradeMode so we can re-sync grid when trade closes
  const prevTradeModeRef = useRef(tradeMode);

  // ── Re-sync inventory when trade window closes ────────
  // Items dragged to trade are removed from gridState via handleDragEnd.
  // Closing the trade loses those items — force a rebuild from real tokens.
  const [tradeCloseRevision, setTradeCloseRevision] = useState(0);
  useEffect(() => {
    const wasTrade = prevTradeModeRef.current;
    prevTradeModeRef.current = tradeMode;
    if (wasTrade && !tradeMode) {
      // Trade just closed — bump revision so the token-sync below re-runs
      setTradeCloseRevision((r) => r + 1);
    }
  }, [tradeMode]);

  // ── Build dynamic grid from fetched tokens ─────────────
  // Skip refresh while a floating item (split ghost) is active — otherwise
  // the token poll resets the source back to its full balance, duplicating
  // the ghost amount.  Also skip the FIRST cycle after the ghost is placed
  // so the split/merge result isn't wiped out.
  useEffect(() => {
    if (floatingItem) {
      wasFloatingRef.current = true;
      return;
    }
    if (wasFloatingRef.current) {
      wasFloatingRef.current = false;
      return;
    }

    // Deduplicate tokens by id (prevents duplicate keys from race conditions)
    const seenIds = new Set<string>();
    const uniqueTokens = tokens.filter((t) => {
      if (seenIds.has(t.id)) return false;
      seenIds.add(t.id);
      return true;
    });

    const mapped = uniqueTokens.map((token, i) => ({
      id: token.id,
      token,
      amount: token.displayBalance,
      rawAmount: token.rawBalance.toString(),
      order: i,
    } satisfies InventorySlot));

    // Grow grid if we have more items than MIN_SLOTS (28), always pad to row-aligned size
    const neededSlots = Math.max(MIN_SLOTS, mapped.length + COLS); // +COLS for one extra row
    const gridSize = Math.ceil(neededSlots / COLS) * COLS;

    const nextGrid: (InventorySlot | null)[] = [...mapped];
    while (nextGrid.length < gridSize) nextGrid.push(null);

    setGridState(nextGrid);
  }, [tokens, chainId, floatingItem, tradeCloseRevision]);

  const inventorySlots = useMemo(
    () => gridState.filter((slot): slot is InventorySlot => slot !== null),
    [gridState],
  );

  // ── Stablecoin symbols for filter ─────────────────────────
  const STABLECOINS = useMemo(() => new Set(["USDC", "USDT", "DAI", "BUSD", "TUSD", "FRAX", "LUSD", "GUSD", "PYUSD", "USDP", "USDD", "RAI"]), []);

  // ── Token sub-filter counts ────────────────────────────────
  const filterCounts = useMemo(() => {
    let native = 0, erc20 = 0, stable = 0;
    for (const slot of gridState) {
      if (!slot) continue;
      if (slot.token.isNative) native++;
      else if (STABLECOINS.has(slot.token.symbol.toUpperCase())) { stable++; erc20++; }
      else erc20++;
    }
    return { native, erc20, stable };
  }, [gridState, STABLECOINS]);

  // ── Filter by search + token sub-filter ─────────────────────
  const visibleGridSlots = useMemo(() => {
    return gridState.map((slot) => {
      if (!slot) return null;
      // Apply sub-filter first
      if (tokenFilter === "native" && !slot.token.isNative) return null;
      if (tokenFilter === "erc20" && slot.token.isNative) return null;
      if (tokenFilter === "stable" && !STABLECOINS.has(slot.token.symbol.toUpperCase())) return null;
      // Then search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matches = slot.token.symbol.toLowerCase().includes(q) || slot.token.address.toLowerCase().includes(q);
        if (!matches) return null;
      }
      return slot;
    });
  }, [gridState, searchQuery, tokenFilter, STABLECOINS]);

  // ── Context Menu ───────────────────────────────────────────
  const handleContextMenu = useCallback(
    (e: React.MouseEvent, slotId: string) => {
      e.preventDefault();
      e.stopPropagation();
      setContextMenu({ x: e.clientX, y: e.clientY, slotId });
    },
    [],
  );

  const closeContextMenu = useCallback(() => setContextMenu(null), []);

  useEffect(() => {
    if (contextMenu) {
      const handler = () => closeContextMenu();
      window.addEventListener("click", handler);
      return () => window.removeEventListener("click", handler);
    }
  }, [contextMenu, closeContextMenu]);

  // ── Split Logic ────────────────────────────────────────────
  const handleSplit = useCallback(
    (slotId: string) => {
      setSplitDialog(slotId);
      setSplitAmount("");
      closeContextMenu();
    },
    [closeContextMenu],
  );

  const confirmSplit = useCallback(() => {
    if (!splitDialog || !splitAmount) return;
    const sourceSlot = inventorySlots.find((s) => s.id === splitDialog);
    if (!sourceSlot) return;

    const splitRaw = BigInt(
      Math.floor(parseFloat(splitAmount) * 10 ** sourceSlot.token.decimals),
    );
    const sourceRaw = BigInt(sourceSlot.rawAmount);

    if (splitRaw <= BigInt(0) || splitRaw >= sourceRaw) {
      toast.error("Invalid split amount");
      return;
    }

    const remainingRaw = sourceRaw - splitRaw;
    const newSlotId = `${sourceSlot.id}:split-${Date.now()}`;

    setGridState((prev) => {
      const next = [...prev];
      const sourceIdx = next.findIndex((slot) => slot?.id === splitDialog);
      if (sourceIdx >= 0 && next[sourceIdx]) {
        next[sourceIdx] = {
          ...next[sourceIdx],
          rawAmount: remainingRaw.toString(),
          amount: formatCompactBalance(remainingRaw, sourceSlot.token.decimals),
        };
      }
      return next;
    });

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
      { duration: 4000 },
    );
  }, [splitDialog, splitAmount, inventorySlots]);

  // ── Mouse tracking for floating ghost ──────────────────────
  useEffect(() => {
    if (!floatingItem) return;

    const handleMouseMove = (e: MouseEvent) =>
      setMousePos({ x: e.clientX, y: e.clientY });

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setGridState((prev) => {
          const updated = [...prev];
          const emptyIdx = updated.findIndex((slot) => slot === null);
          if (emptyIdx >= 0) {
            updated[emptyIdx] = { ...floatingItem, order: emptyIdx };
          }
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

  // ── Drop floating ghost onto a slot ────────────────────────
  const handleSlotDrop = useCallback((targetIndex: number) => {
    if (!floatingItem) return;
    setGridState((prev) => {
      const next = [...prev];
      const target = next[targetIndex];

      if (!target) {
        next[targetIndex] = { ...floatingItem, order: targetIndex };
        return next;
      }

      const canMerge =
        target.token.chainId === floatingItem.token.chainId &&
        target.token.address.toLowerCase() === floatingItem.token.address.toLowerCase();
      if (canMerge) {
        const mergedRaw = BigInt(target.rawAmount) + BigInt(floatingItem.rawAmount);
        next[targetIndex] = {
          ...target,
          rawAmount: mergedRaw.toString(),
          amount: formatCompactBalance(mergedRaw, target.token.decimals),
        };
        return next;
      }

      const emptyIdx = next.findIndex((slot) => slot === null);
      if (emptyIdx >= 0) {
        next[emptyIdx] = target;
        next[targetIndex] = { ...floatingItem, order: targetIndex };
        return next;
      }

      return next;
    });
    setFloatingItem(null);
    toast.success(`Placed ${floatingItem.amount} ${floatingItem.token.symbol}`);
  }, [floatingItem]);

  // ── Merge Logic ────────────────────────────────────────────
  const handleMerge = useCallback(() => {
    setGridState((prev) => {
      const current = prev.filter((slot): slot is InventorySlot => slot !== null);
      const merged = new Map<string, InventorySlot>();

      for (const slot of current) {
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

      const compacted = Array.from(merged.values()).map((s, i) => ({ ...s, order: i }));
      const next: (InventorySlot | null)[] = [...compacted];
      const totalSlots = Math.max(MIN_SLOTS, Math.ceil(next.length / COLS) * COLS + COLS);
      while (next.length < totalSlots) next.push(null);
      return next.slice(0, totalSlots);
    });
    toast.success("Inventory merged");
  }, []);

  // ── Copy Address ───────────────────────────────────────────
  const handleCopyAddress = useCallback(
    (slotId: string) => {
      const slot = inventorySlots.find((s) => s.id === slotId);
      if (slot) {
        navigator.clipboard.writeText(slot.token.address);
        toast.success(`Copied ${slot.token.symbol} address`);
      }
      closeContextMenu();
    },
    [inventorySlots, closeContextMenu],
  );

  // ── Select Slot ────────────────────────────────────────────
  const handleSlotClick = useCallback(
    (slotId: string) => {
      if (floatingItem) {
        const targetIndex = gridState.findIndex((slot) => slot?.id === slotId);
        if (targetIndex >= 0) handleSlotDrop(targetIndex);
        return;
      }
      setSelectedSlot((prev) => (prev === slotId ? null : slotId));
      // Toggle detail panel — same click selects AND expands
      setDetailSlotId((prev) => (prev === slotId ? null : slotId));
      const slot = inventorySlots.find((s) => s.id === slotId);
      onSlotSelect?.(slot ?? null);
    },
    [inventorySlots, onSlotSelect, floatingItem, handleSlotDrop, gridState],
  );

  const quickSplitToCursor = useCallback(
    (slotId: string, mode: "third" | "half") => {
      let ghost: InventorySlot | null = null;

      setGridState((prev) => {
        const next = [...prev];
        const sourceIndex = next.findIndex((slot) => slot?.id === slotId);
        if (sourceIndex < 0 || !next[sourceIndex]) return prev;

        const sourceSlot = next[sourceIndex];
        const sourceRaw = BigInt(sourceSlot.rawAmount);
        const divisor = mode === "third" ? BigInt(3) : BigInt(2);
        const movedRaw = sourceRaw / divisor;
        if (movedRaw <= BigInt(0) || movedRaw >= sourceRaw) return prev;

        const remainingRaw = sourceRaw - movedRaw;
        next[sourceIndex] = {
          ...sourceSlot,
          rawAmount: remainingRaw.toString(),
          amount: formatCompactBalance(remainingRaw, sourceSlot.token.decimals),
        };

        const ghostId = `${sourceSlot.id}:${mode}-${Date.now()}`;
        ghost = {
          id: ghostId,
          token: { ...sourceSlot.token, id: ghostId },
          rawAmount: movedRaw.toString(),
          amount: formatCompactBalance(movedRaw, sourceSlot.token.decimals),
          order: -1,
        };

        return next;
      });

      if (!ghost) {
        toast.error("Not enough balance to split this stack");
        return;
      }

      setFloatingItem(ghost as InventorySlot);
      toast.success(
        `${mode === "third" ? "Shift" : "Ctrl"}+click split ready — place the stack in any slot`,
      );
    },
    [],
  );

  /** Quick-split from context menu — custom amount string → floating item */
  const quickSplitCustomAmount = useCallback(
    (slotId: string, amountStr: string) => {
      const slot = gridState.find((s) => s?.id === slotId);
      if (!slot) return;

      const requestedFloat = parseFloat(amountStr);
      if (isNaN(requestedFloat) || requestedFloat <= 0) {
        toast.error("Enter a valid amount to split");
        return;
      }

      // Convert to raw bigint
      const factor = BigInt(10) ** BigInt(slot.token.decimals);
      // Multiply carefully to avoid floating point issues
      const movedRaw = BigInt(
        Math.floor(requestedFloat * Number(factor)),
      );
      const sourceRaw = BigInt(slot.rawAmount);

      if (movedRaw <= BigInt(0) || movedRaw >= sourceRaw) {
        toast.error("Split amount must be between 0 and the total balance");
        return;
      }

      let ghost: InventorySlot | null = null;

      setGridState((prev) => {
        const next = [...prev];
        const sourceIndex = next.findIndex((s) => s?.id === slotId);
        if (sourceIndex < 0 || !next[sourceIndex]) return prev;

        const currentSlot = next[sourceIndex]!;
        const currentRaw = BigInt(currentSlot.rawAmount);
        if (movedRaw >= currentRaw) return prev;

        const remainingRaw = currentRaw - movedRaw;
        next[sourceIndex] = {
          ...currentSlot,
          rawAmount: remainingRaw.toString(),
          amount: formatCompactBalance(remainingRaw, currentSlot.token.decimals),
        };

        const ghostId = `${currentSlot.id}:custom-${Date.now()}`;
        ghost = {
          id: ghostId,
          token: { ...currentSlot.token, id: ghostId },
          rawAmount: movedRaw.toString(),
          amount: formatCompactBalance(movedRaw, currentSlot.token.decimals),
          order: -1,
        };

        return next;
      });

      closeContextMenu();

      if (ghost) {
        setFloatingItem(ghost as InventorySlot);
        toast.success("Split ready — click a slot to place");
      }
    },
    [gridState, closeContextMenu],
  );

  const handleSlotPointerDown = useCallback(
    (slotId: string, sourceIndex: number, event: React.PointerEvent) => {
      pointerIntentRef.current = {
        slotId,
        sourceIndex,
        startX: event.clientX,
        startY: event.clientY,
        moved: false,
        shift: event.shiftKey,
        ctrl: event.ctrlKey,
        meta: event.metaKey,
      };
    },
    [],
  );

  const handleSlotPointerMove = useCallback((slotId: string, event: React.PointerEvent) => {
    const current = pointerIntentRef.current;
    if (!current || current.slotId !== slotId) return;
    const dx = event.clientX - current.startX;
    const dy = event.clientY - current.startY;
    const distance = Math.hypot(dx, dy);
    if (distance >= DRAG_THRESHOLD_PX) {
      current.moved = true;
    }
  }, []);

  const handleSlotPointerUp = useCallback(
    (slotId: string, event: React.PointerEvent) => {
      const current = pointerIntentRef.current;
      if (!current || current.slotId !== slotId) {
        pointerIntentRef.current = null;
        return;
      }

      // During an active HTML5 drag, ignore pointer-up (browser fires pointercancel instead,
      // but some browsers may still fire pointerup on certain touch devices).
      // IMPORTANT: Do NOT clear pointerIntentRef here — handleDragStart still needs
      // the shift/ctrl flags that were captured during pointerdown.
      if (current.moved || draggedSlotId) return;

      // Not a drag — this was a click. Clear the ref now.
      pointerIntentRef.current = null;

      // Floating-item placement always takes priority over modifier splits.
      // Without this, shift/ctrl clicking while a ghost is active would
      // create yet another split instead of placing the existing ghost.
      if (floatingItem) {
        handleSlotClick(slotId);
        return;
      }

      if (event.shiftKey) {
        // In trade mode: shift+click adds item to trade offer
        if (tradeMode && onAddToTrade) {
          const slot = gridState.find((s) => s?.id === slotId);
          if (slot) {
            onAddToTrade(slot);
            toast.success(`Added ${slot.token.symbol} to trade offer`, {
              duration: 1500,
            });
          }
          return;
        }
        quickSplitToCursor(slotId, "third");
        return;
      }

      if (event.ctrlKey || event.metaKey) {
        quickSplitToCursor(slotId, "half");
        return;
      }

      handleSlotClick(slotId);
    },
    [handleSlotClick, quickSplitToCursor, draggedSlotId, floatingItem, tradeMode, onAddToTrade, gridState],
  );

  // ── HTML5 Drag Start ──────────────────────────────────────
  const handleDragStart = useCallback(
    (e: React.DragEvent, slot: InventorySlot, sourceIndex: number) => {
      const intent = pointerIntentRef.current;

      const effectiveShift = e.shiftKey || Boolean(intent?.shift);
      const effectiveCtrl = e.ctrlKey || e.metaKey || Boolean(intent?.ctrl) || Boolean(intent?.meta);
      const modifier: "none" | "third" | "half" = effectiveShift ? "third" : effectiveCtrl ? "half" : "none";

      let movedRawAmount: string | undefined;
      let movedSlot = slot;
      if (modifier !== "none") {
        const sourceRaw = BigInt(slot.rawAmount);
        const divisor = modifier === "third" ? BigInt(3) : BigInt(2);
        const candidate = sourceRaw / divisor;
        if (candidate > BigInt(0) && candidate < sourceRaw) {
          movedRawAmount = candidate.toString();
          movedSlot = {
            ...slot,
            rawAmount: movedRawAmount,
            amount: formatCompactBalance(candidate, slot.token.decimals),
          };
        }
      }

      // Serialize slot for cross-component DnD
      // token.rawBalance is bigint — use a replacer so JSON.stringify doesn't throw
      const payload: DragPayload = {
        slot: movedSlot,
        sourceIndex,
        origin: "inventory",
        movedRawAmount,
        modifier,
      };
      const payloadJson = JSON.stringify(payload, (_key, value) =>
        typeof value === "bigint" ? value.toString() : value,
      );
      e.dataTransfer.setData(INVENTORY_DND_TYPE, payloadJson);
      e.dataTransfer.setData("text/plain", payloadJson);
      e.dataTransfer.effectAllowed = "move";

      // Create a small drag image so the browser doesn't use the full slot rendering
      const dragEl = document.createElement("div");
      dragEl.style.cssText = "width:40px;height:40px;background:rgba(16,185,129,0.25);border-radius:8px;border:2px solid rgba(16,185,129,0.6);position:absolute;top:-9999px;";
      document.body.appendChild(dragEl);
      e.dataTransfer.setDragImage(dragEl, 20, 20);
      requestAnimationFrame(() => dragEl.remove());

      lastDragPayloadRef.current = payload;
      dragConsumedRef.current = false;
      setDraggedSlotId(slot.id);
    },
    [],
  );

  const handleSlotDragOver = useCallback((e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setDragOverIndex(targetIndex);
  }, []);

  const handleSlotDragLeave = useCallback((e: React.DragEvent) => {
    // Only clear if we're leaving the slot (not entering a child)
    const related = e.relatedTarget as Node | null;
    if (related && (e.currentTarget as Node).contains(related)) return;
    setDragOverIndex(null);
  }, []);

  const handleSlotDragDrop = useCallback((e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    setDragOverIndex(null);
    dragConsumedRef.current = true;

    try {
      const raw = e.dataTransfer.getData(INVENTORY_DND_TYPE) || e.dataTransfer.getData("text/plain");
      if (!raw) return;

      let payload: DragPayload;
      const parsed = JSON.parse(raw) as DragPayload | InventorySlot;
      if ((parsed as DragPayload).slot) {
        payload = parsed as DragPayload;
      } else {
        payload = { slot: parsed as InventorySlot, origin: "external" };
      }

      const sourceSlot = payload.slot;

      // All logic now runs inside the setGridState updater so it always
      // sees the latest state (fixes ghost/merge bug from stale closure).
      if (payload.origin === "inventory" && payload.sourceIndex != null) {
        const sourceIndex = payload.sourceIndex;
        if (sourceIndex === targetIndex) return;

        setGridState((prev) => {
          const next = [...prev];
          const currentSource = next[sourceIndex];
          const currentTarget = next[targetIndex];
          if (!currentSource) return prev;

          const currentSourceRaw = BigInt(currentSource.rawAmount);
          const moved = payload.movedRawAmount ? BigInt(payload.movedRawAmount) : currentSourceRaw;
          const isCurrentPartial = moved < currentSourceRaw;

          // Validate partial drop target
          if (isCurrentPartial && currentTarget) {
            const canMergePartial =
              currentTarget.token.chainId === currentSource.token.chainId &&
              currentTarget.token.address.toLowerCase() === currentSource.token.address.toLowerCase();
            if (!canMergePartial) {
              toast.info("Partial drags can only drop on empty or same-token slots");
              return prev;
            }
          }

          const movedSlotData: InventorySlot = isCurrentPartial
            ? {
                ...currentSource,
                rawAmount: moved.toString(),
                amount: formatCompactBalance(moved, currentSource.token.decimals),
              }
            : currentSource;

          const canMerge =
            currentTarget &&
            currentTarget.token.chainId === movedSlotData.token.chainId &&
            currentTarget.token.address.toLowerCase() === movedSlotData.token.address.toLowerCase();

          if (canMerge) {
            const mergedRaw = BigInt(currentTarget.rawAmount) + BigInt(movedSlotData.rawAmount);
            next[targetIndex] = {
              ...currentTarget,
              rawAmount: mergedRaw.toString(),
              amount: formatCompactBalance(mergedRaw, currentTarget.token.decimals),
            };

            if (isCurrentPartial) {
              const remainingRaw = currentSourceRaw - moved;
              next[sourceIndex] = {
                ...currentSource,
                rawAmount: remainingRaw.toString(),
                amount: formatCompactBalance(remainingRaw, currentSource.token.decimals),
              };
            } else {
              next[sourceIndex] = null;
            }
            return next;
          }

          if (isCurrentPartial) {
            const remainingRaw = currentSourceRaw - moved;
            next[sourceIndex] = {
              ...currentSource,
              rawAmount: remainingRaw.toString(),
              amount: formatCompactBalance(remainingRaw, currentSource.token.decimals),
            };
            next[targetIndex] = {
              ...movedSlotData,
              order: targetIndex,
            };
            return next;
          }

          next[targetIndex] = currentSource;
          next[sourceIndex] = currentTarget ?? null;
          return next;
        });
        return;
      }

      setGridState((prev) => {
        const next = [...prev];
        const currentTarget = next[targetIndex];

        const canMerge =
          currentTarget &&
          currentTarget.token.chainId === sourceSlot.token.chainId &&
          currentTarget.token.address.toLowerCase() === sourceSlot.token.address.toLowerCase();

        if (canMerge) {
          const mergedRaw = BigInt(currentTarget.rawAmount) + BigInt(sourceSlot.rawAmount);
          next[targetIndex] = {
            ...currentTarget,
            rawAmount: mergedRaw.toString(),
            amount: formatCompactBalance(mergedRaw, currentTarget.token.decimals),
          };
          return next;
        }

        if (!currentTarget) {
          next[targetIndex] = { ...sourceSlot, order: targetIndex };
          return next;
        }

        return prev;
      });
    } catch {
      toast.error("Failed to move item");
    }
  }, []);

  const handleDragEnd = useCallback((e: React.DragEvent) => {
    const payload = lastDragPayloadRef.current;
    lastDragPayloadRef.current = null;
    pointerIntentRef.current = null;
    setDraggedSlotId(null);
    setDragOverIndex(null);

    // If the drop was NOT handled by our own inventory drop handler, the item
    // was dropped outside (e.g. into the trade window).  Remove / reduce it.
    if (!dragConsumedRef.current && e.dataTransfer.dropEffect === "move" && payload) {
      const movedRaw = payload.movedRawAmount ? BigInt(payload.movedRawAmount) : null;

      setGridState((prev) => {
        const next = [...prev];
        const idx =
          payload.sourceIndex != null
            ? payload.sourceIndex
            : next.findIndex((s) => s?.id === payload.slot.id);
        if (idx < 0 || !next[idx]) return prev;

        if (movedRaw) {
          // Partial drag — reduce the source balance
          const current = next[idx]!;
          const remaining = BigInt(current.rawAmount) - movedRaw;
          if (remaining > BigInt(0)) {
            next[idx] = {
              ...current,
              rawAmount: remaining.toString(),
              amount: formatCompactBalance(remaining, current.token.decimals),
            };
          } else {
            next[idx] = null;
          }
        } else {
          // Full drag — remove the slot entirely
          next[idx] = null;
        }
        return next;
      });
    }
    dragConsumedRef.current = false;
  }, []);

  // ────────────────────────────────────────────────────────────
  // Not connected
  // ────────────────────────────────────────────────────────────

  if (!isConnected) {
    return (
      <div
        className={`flex flex-col items-center justify-center py-12 text-center ${className}`}
      >
        <FiPackage className="h-12 w-12 text-zinc-400 dark:text-zinc-600 mb-3" />
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          Connect a wallet to view your inventory
        </p>
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col bg-zinc-950/80 rounded-xl border border-zinc-800 overflow-hidden ${className}`}
      ref={inventoryRef}
    >
      {/* ── Header: Chain Selector + Actions ───────────────── */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-zinc-800 bg-zinc-900/60">
        {/* Chain Selector */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <select
              className="appearance-none bg-zinc-800 border border-zinc-700 rounded-lg pl-3 pr-7 py-1.5 text-xs font-semibold text-zinc-200 cursor-pointer focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all"
              value={chainId}
              onChange={(e) =>
                switchChain({ chainId: Number(e.target.value) })
              }
              disabled={switchStatus === "pending"}
            >
              {chains.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
            <FiChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 h-3 w-3 text-zinc-500 pointer-events-none" />
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
          <div className="relative">
            <input
              type="text"
              placeholder="Search..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-24 bg-zinc-800 border border-zinc-700 rounded-lg pl-7 pr-2 py-1 text-xs text-zinc-300 placeholder:text-zinc-500 focus:ring-2 focus:ring-emerald-500/50 focus:w-36 transition-all"
            />
            <FiSearch className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-zinc-500" />
          </div>
          <button
            type="button"
            onClick={handleMerge}
            className="p-1.5 rounded-lg hover:bg-zinc-800 transition-colors text-zinc-500 hover:text-emerald-400"
            title="Merge all split stacks"
          >
            <FiLayers className="h-3.5 w-3.5" />
          </button>
          <button
            type="button"
            onClick={() => {
              wasFloatingRef.current = false;
              setFloatingItem(null);
              setGridState([]);
              refetch();
            }}
            className="p-1.5 rounded-lg hover:bg-zinc-800 transition-colors text-zinc-500 hover:text-emerald-400"
            title="Refresh balances (consolidates split stacks)"
          >
            <FiRefreshCw
              className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
            />
          </button>
        </div>
      </div>

      {/* ── Tab Switcher: Tokens / NFTs ─────────────────────── */}
      <div className="border-b border-zinc-800 bg-zinc-900/40">
        <div className="flex items-center gap-0">
          <button
            type="button"
            onClick={() => setActiveTab("tokens")}
            className={`flex-1 text-center py-1.5 text-[10px] font-semibold transition-colors ${
              activeTab === "tokens"
                ? "text-emerald-400 border-b-2 border-emerald-500"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            Tokens ({inventorySlots.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("nfts")}
            className={`flex-1 text-center py-1.5 text-[10px] font-semibold transition-colors ${
              activeTab === "nfts"
                ? "text-purple-400 border-b-2 border-purple-500"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
          >
            NFTs ({nfts.length})
          </button>
        </div>
        {/* Sub-filter pills — only visible in tokens tab */}
        {activeTab === "tokens" && inventorySlots.length > 0 && (
          <div className="flex items-center gap-1 px-2 pb-1.5 pt-1 overflow-x-auto no-scrollbar">
            {([
              { key: "all" as const, label: "All", count: inventorySlots.length },
              { key: "native" as const, label: "Native", count: filterCounts.native },
              { key: "erc20" as const, label: "Tokens", count: filterCounts.erc20 },
              { key: "stable" as const, label: "Stable", count: filterCounts.stable },
            ] as const).map(({ key, label, count }) => (
              <button
                key={key}
                type="button"
                onClick={() => setTokenFilter(key)}
                className={`shrink-0 px-2 py-0.5 rounded-md text-[9px] font-semibold transition-colors ${
                  tokenFilter === key
                    ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                    : "text-zinc-500 hover:text-zinc-300 border border-transparent hover:border-zinc-700"
                }`}
              >
                {label} {count > 0 && <span className="text-zinc-600 ml-0.5">{count}</span>}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* ── Inventory Grid (4 cols, dynamic rows, scrollable) ───── */}
      <div className="relative p-2 overflow-y-auto max-h-[calc(100vh-280px)]" style={{ scrollbarWidth: 'thin', scrollbarColor: '#3f3f46 transparent' }}>
        {/* ── Token Grid ──────────────────────── */}
        {activeTab === "tokens" && (
          <>
        {loading && inventorySlots.length === 0 ? (
          <div className="flex items-center justify-center py-16">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{
                repeat: Infinity,
                duration: 1.5,
                ease: "linear",
              }}
            >
              <FiRefreshCw className="h-6 w-6 text-zinc-500" />
            </motion.div>
          </div>
        ) : (
          <div
            className="grid gap-1"
            style={{
              gridTemplateColumns: `repeat(${COLS}, 1fr)`,
            }}
            onDragLeave={(e) => {
              // Clear drag-over when cursor leaves the entire grid
              const related = e.relatedTarget as Node | null;
              if (!related || !(e.currentTarget as Node).contains(related)) {
                setDragOverIndex(null);
              }
            }}
          >
            {visibleGridSlots.map((slot, idx) => (
              <OsrsSlot
                key={slot ? `${slot.id}@${idx}` : `empty-${idx}`}
                slot={slot}
                index={idx}
                isSelected={slot ? selectedSlot === slot.id : false}
                isDragging={slot ? draggedSlotId === slot.id : false}
                isDragOver={dragOverIndex === idx}
                tradeMode={tradeMode}
                onClick={
                  // Empty slots need a click handler when a floating ghost
                  // is active so the user can place it anywhere in the grid.
                  !slot && floatingItem
                    ? () => handleSlotDrop(idx)
                    : undefined
                }
                onContextMenu={
                  slot
                    ? (e) => handleContextMenu(e, slot.id)
                    : undefined
                }
                onPointerDown={
                  slot
                    ? (e) => handleSlotPointerDown(slot.id, idx, e)
                    : undefined
                }
                onPointerMove={
                  slot
                    ? (e) => handleSlotPointerMove(slot.id, e)
                    : undefined
                }
                onPointerUp={
                  slot
                    ? (e) => handleSlotPointerUp(slot.id, e)
                    : undefined
                }
                onDragStart={
                  slot ? (e) => handleDragStart(e, slot, idx) : undefined
                }
                onDragEnd={handleDragEnd}
                onDragOver={(e) => handleSlotDragOver(e, idx)}
                onDragLeave={handleSlotDragLeave}
                onDrop={(e) => handleSlotDragDrop(e, idx)}
              />
            ))}
          </div>
        )}
          </>
        )}

        {/* ── NFT Grid ────────────────────────── */}
        {activeTab === "nfts" && (
          <>
            {nftsLoading && nfts.length === 0 ? (
              <div className="flex items-center justify-center py-16">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 1.5, ease: "linear" }}
                >
                  <FiRefreshCw className="h-6 w-6 text-zinc-500" />
                </motion.div>
              </div>
            ) : nfts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <FiPackage className="h-8 w-8 text-zinc-600 mb-2" />
                <p className="text-xs text-zinc-500">No NFTs found on this chain</p>
                <p className="text-[10px] text-zinc-600 mt-1">ERC-721 and ERC-1155 tokens will appear here</p>
              </div>
            ) : (
              <div
                className="grid gap-1"
                style={{ gridTemplateColumns: `repeat(${COLS}, 1fr)` }}
              >
                {nfts.map((nft) => (
                  <NftSlot key={nft.id} nft={nft} />
                ))}
                {/* Pad with empties to fill the row */}
                {Array.from({ length: Math.max(0, COLS - (nfts.length % COLS)) % COLS }).map((_, i) => (
                  <div
                    key={`nft-empty-${i}`}
                    className="aspect-square rounded-lg bg-zinc-900/60 border border-zinc-800/60"
                    style={{ boxShadow: "inset 0 1px 3px rgba(0,0,0,0.4), inset 0 -1px 1px rgba(255,255,255,0.03)" }}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Token Detail Panel — expands below grid on click ─── */}
      <AnimatePresence>
        {detailSlotId && (() => {
          const detailSlot = inventorySlots.find((s) => s.id === detailSlotId);
          if (!detailSlot) return null;
          const explorerUrl = getExplorerTokenUrl(detailSlot.token.chainId, detailSlot.token.address);
          const isNativeToken = detailSlot.token.address === "0x0000000000000000000000000000000000000000";
          return (
            <motion.div
              key="detail-panel"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              className="overflow-hidden border-t border-zinc-800/60"
            >
              <div className="px-3 py-2.5 bg-zinc-900/80 space-y-2">
                {/* Header row: icon + name + close */}
                <div className="flex items-center gap-2.5">
                  <TokenIcon
                    address={detailSlot.token.address}
                    chainId={detailSlot.token.chainId}
                    symbol={detailSlot.token.symbol}
                    logo={detailSlot.token.logo}
                    size={28}
                    className="ring-1 ring-zinc-700/60 shadow-lg"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-sm font-semibold text-zinc-100">{detailSlot.token.symbol}</span>
                      {isNativeToken && (
                        <span className="text-[8px] font-medium uppercase tracking-wider text-sky-400 bg-sky-400/10 px-1.5 py-px rounded">Native</span>
                      )}
                      {!isNativeToken && STABLECOINS.has(detailSlot.token.symbol.toUpperCase()) && (
                        <span className="text-[8px] font-medium uppercase tracking-wider text-emerald-400 bg-emerald-400/10 px-1.5 py-px rounded">Stable</span>
                      )}
                    </div>
                    <span className="text-[11px] text-zinc-500 block truncate">
                      {isNativeToken ? `Native · ${activeChain?.name ?? `Chain ${detailSlot.token.chainId}`}` : `${detailSlot.token.address.slice(0, 10)}…${detailSlot.token.address.slice(-6)}`}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setDetailSlotId(null)}
                    className="text-zinc-500 hover:text-zinc-300 transition-colors p-1"
                  >
                    <FiChevronDown className="h-4 w-4 rotate-180" />
                  </button>
                </div>

                {/* Balance info */}
                <div className="bg-zinc-950/60 rounded-md px-2.5 py-1.5 flex items-baseline justify-between">
                  <div>
                    <span className="text-xs text-zinc-400">Balance</span>
                    <div className="text-sm font-bold text-zinc-100">
                      {formatFullBalance(BigInt(detailSlot.rawAmount), detailSlot.token.decimals)}
                      <span className="text-zinc-500 font-normal ml-1 text-xs">{detailSlot.token.symbol}</span>
                    </div>
                  </div>
                  {/* Chain badge */}
                  <div className="flex items-center gap-1">
                    {CHAIN_LOGOS[detailSlot.token.chainId] && (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={CHAIN_LOGOS[detailSlot.token.chainId]} alt="" className="w-4 h-4 rounded-full" draggable={false} />
                    )}
                    <span className="text-[10px] text-zinc-500">{activeChain?.name ?? `Chain ${detailSlot.token.chainId}`}</span>
                  </div>
                </div>

                {/* Action buttons */}
                <div className="flex gap-1.5">
                  {explorerUrl && (
                    <a
                      href={explorerUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium text-zinc-400 bg-zinc-800/60 hover:bg-zinc-700/60 hover:text-zinc-200 transition-colors"
                    >
                      <FiExternalLink className="h-3 w-3" />
                      Explorer
                    </a>
                  )}
                  {!isNativeToken && (
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(detailSlot.token.address);
                        toast.success("Contract address copied");
                      }}
                      className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium text-zinc-400 bg-zinc-800/60 hover:bg-zinc-700/60 hover:text-zinc-200 transition-colors"
                    >
                      <FiCopy className="h-3 w-3" />
                      Copy Address
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      // Open context menu actions for split
                      if (detailSlot) handleSplit(detailSlot.id);
                    }}
                    className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium text-zinc-400 bg-zinc-800/60 hover:bg-zinc-700/60 hover:text-zinc-200 transition-colors"
                  >
                    <FiScissors className="h-3 w-3" />
                    Split
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      toast.info("Send coming soon");
                    }}
                    className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium text-zinc-400 bg-zinc-800/60 hover:bg-zinc-700/60 hover:text-zinc-200 transition-colors"
                  >
                    <FiSend className="h-3 w-3" />
                    Send
                  </button>
                </div>
              </div>
            </motion.div>
          );
        })()}
      </AnimatePresence>

      {/* ── Status Bar — chain + active wallet ──────────── */}
      <div className="flex items-center justify-between gap-2 px-3 py-1.5 border-t border-zinc-800 bg-zinc-900/60">
        <span className="text-[10px] text-zinc-500">
          {activeTab === "tokens"
            ? `${inventorySlots.length} token${inventorySlots.length !== 1 ? "s" : ""}`
            : `${nfts.length} NFT${nfts.length !== 1 ? "s" : ""}`}{" "}
          · {activeChain?.name ?? `Chain ${chainId}`}
        </span>
        {effectiveConnected && effectiveAddress && (
          <button
            type="button"
            onClick={() => {
              navigator.clipboard.writeText(effectiveAddress);
              toast.success("Address copied");
            }}
            className="flex items-center gap-1 text-[10px] font-mono text-emerald-500/80 hover:text-emerald-400 truncate max-w-36 transition-colors"
            title={effectiveAddress}
          >
            <FiTarget className="h-2.5 w-2.5 shrink-0" />
            {effectiveAddress.slice(0, 6)}…{effectiveAddress.slice(-4)}
          </button>
        )}
      </div>

      {/* ── Context Menu ────────────────────────────────────── */}
      <AnimatePresence>
        {contextMenu && (
          <OsrsContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            slotId={contextMenu.slotId}
            slot={inventorySlots.find((s) => s.id === contextMenu.slotId)}
            onSplit={() => handleSplit(contextMenu.slotId)}
            onQuickSplit={(amount) =>
              quickSplitCustomAmount(contextMenu.slotId, amount)
            }
            onCopy={() => handleCopyAddress(contextMenu.slotId)}
            onClose={closeContextMenu}
            tradeMode={tradeMode}
            onAddToTrade={onAddToTrade ? (slot) => {
              onAddToTrade(slot);
              closeContextMenu();
            } : undefined}
          />
        )}
      </AnimatePresence>

      {/* ── Split Dialog ────────────────────────────────────── */}
      <AnimatePresence>
        {splitDialog && (
          <OsrsSplitDialog
            slot={inventorySlots.find((s) => s.id === splitDialog)}
            value={splitAmount}
            onChange={setSplitAmount}
            onConfirm={confirmSplit}
            onCancel={() => setSplitDialog(null)}
          />
        )}
      </AnimatePresence>

      {/* ── Floating Ghost ──────────────────────────────────── */}
      <AnimatePresence>
        {floatingItem && (
          <OsrsFloatingGhost
            item={floatingItem}
            x={mousePos.x}
            y={mousePos.y}
            onClick={() => {
              const emptyIdx = gridState.findIndex((slot) => slot === null);
              if (emptyIdx >= 0) handleSlotDrop(emptyIdx);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// NFT Slot (OSRS stone tile — shows NFT thumbnail + badge)
// ────────────────────────────────────────────────────────────

function NftSlot({ nft }: { nft: InventoryNft }) {
  const [isHovered, setIsHovered] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className="relative aspect-square rounded-lg select-none transition-all duration-100 cursor-pointer border-2 border-zinc-700/80 bg-zinc-900/80 hover:border-purple-500/60 hover:bg-purple-500/5"
    >
      {/* NFT Image */}
      <div className="absolute inset-0 flex items-center justify-center p-1">
        {nft.imageUrl && !imgFailed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={nft.imageUrl}
            alt={nft.name ?? `NFT #${nft.tokenId}`}
            draggable={false}
            className="w-full h-full rounded-md object-cover pointer-events-none"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <div className="w-full h-full rounded-md bg-linear-to-br from-purple-900/40 to-zinc-800 flex items-center justify-center">
            <span className="text-[10px] font-bold text-purple-300">NFT</span>
          </div>
        )}
      </div>

      {/* Standard badge — top-left */}
      <div className="absolute top-0.5 left-0.5 z-10 pointer-events-none">
        <span
          className={`text-[7px] font-bold px-1 py-0.5 rounded ${
            nft.standard === "ERC-1155"
              ? "bg-amber-500/20 text-amber-400"
              : "bg-purple-500/20 text-purple-400"
          }`}
        >
          {nft.standard === "ERC-1155" ? "1155" : "721"}
        </span>
      </div>

      {/* Balance badge — top-right (only ERC-1155 with balance > 1) */}
      {nft.standard === "ERC-1155" && nft.balance > 1 && (
        <div className="absolute top-0.5 right-0.5 z-10 pointer-events-none">
          <span
            className="text-[8px] font-bold text-amber-300 leading-none"
            style={{ textShadow: "1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000" }}
          >
            x{nft.balance}
          </span>
        </div>
      )}

      {/* Hover overlay with details */}
      <AnimatePresence>
        {isHovered && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0 z-20 rounded-lg backdrop-blur-md bg-zinc-950/85 flex flex-col items-center justify-center px-1.5 py-1 text-center overflow-hidden"
          >
            <span className="text-[10px] font-bold text-purple-300 leading-tight truncate max-w-full">
              {nft.name ?? `#${nft.tokenId}`}
            </span>
            {nft.collectionName && (
              <span className="text-[8px] text-zinc-400 leading-tight truncate max-w-full mt-0.5">
                {nft.collectionName}
              </span>
            )}
            <span className="text-[8px] text-zinc-500 leading-tight truncate max-w-full mt-0.5">
              {nft.contractAddress.slice(0, 6)}…{nft.contractAddress.slice(-4)}
            </span>
            <span className="text-[7px] text-zinc-600 mt-0.5">
              Token #{nft.tokenId.length > 8 ? `${nft.tokenId.slice(0, 6)}…` : nft.tokenId}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Inventory Slot (OSRS stone tile)
// ────────────────────────────────────────────────────────────

function OsrsSlot({
  slot,
  index,
  isSelected,
  isDragging,
  isDragOver,
  tradeMode,
  onClick,
  onContextMenu,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onDragStart,
  onDragEnd,
  onDragOver,
  onDragLeave,
  onDrop,
}: {
  slot: InventorySlot | null;
  index: number;
  isSelected: boolean;
  isDragging: boolean;
  isDragOver: boolean;
  tradeMode: boolean;
  onClick?: () => void;
  onContextMenu?: (e: React.MouseEvent) => void;
  onPointerDown?: (e: React.PointerEvent) => void;
  onPointerMove?: (e: React.PointerEvent) => void;
  onPointerUp?: (e: React.PointerEvent) => void;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDragLeave?: (e: React.DragEvent) => void;
  onDrop?: (e: React.DragEvent) => void;
}) {
  const [isHovered, setIsHovered] = useState(false);
  const isEmpty = !slot;

  return (
    <div
      onClick={onClick}
      onContextMenu={onContextMenu}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      draggable={!!slot}
      onDragStart={onDragStart as unknown as React.DragEventHandler<HTMLDivElement>}
      onDragEnd={onDragEnd as unknown as React.DragEventHandler<HTMLDivElement>}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`
        relative aspect-square select-none transition-all duration-150
        ${isDragOver && !isDragging
          ? "ring-2 ring-emerald-400/70 bg-emerald-500/10 border border-emerald-500/40 scale-[1.03] rounded-md"
          : isEmpty
          ? `bg-zinc-900/40 border border-zinc-800/40 rounded-md ${onClick ? "cursor-pointer hover:border-emerald-700/30 hover:bg-emerald-500/5" : ""}`
          : `cursor-grab active:cursor-grabbing border
             ${isSelected
               ? "border-emerald-500/80 bg-emerald-500/10 shadow-[0_0_8px_rgba(16,185,129,0.25)] rounded-md"
               : "border-zinc-700/50 bg-zinc-900/70 hover:border-zinc-500/70 hover:bg-zinc-800/60 rounded-md"
             }
             ${tradeMode ? "ring-1 ring-amber-500/15" : ""}
             ${isDragging ? "opacity-30 scale-95" : ""}`}
      `}
      style={{
        boxShadow: isDragOver && !isDragging
          ? "0 0 12px rgba(16,185,129,0.3), inset 0 0 6px rgba(16,185,129,0.1)"
          : isEmpty
            ? "inset 0 1px 2px rgba(0,0,0,0.3)"
            : isHovered && !isDragging
              ? "0 2px 8px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.05)"
              : undefined,
      }}
    >
      {slot && (
        <>
          {/* Token Icon — larger, centered */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className={`transition-transform duration-150 ${isHovered && !isDragging ? "scale-110" : ""}`}>
              <TokenIcon
                address={slot.token.address}
                chainId={slot.token.chainId}
                symbol={slot.token.symbol}
                logo={slot.token.logo}
                size={34}
                className="drop-shadow-[0_2px_6px_rgba(0,0,0,0.6)] pointer-events-none"
              />
            </div>
          </div>

          {/* Stack Size — top-left, OSRS style */}
          <div className="absolute top-0.5 left-1 z-10 pointer-events-none">
            <span
              className={`text-[9px] sm:text-[10px] font-bold leading-none tracking-tight ${getStackColor(slot.amount)}`}
              style={{
                textShadow:
                  "1px 1px 0 #000, -1px -1px 0 #000, 1px -1px 0 #000, -1px 1px 0 #000, 0 1px 0 #000",
              }}
            >
              {slot.amount}
            </span>
          </div>

          {/* Symbol label — bottom center */}
          <div className="absolute bottom-0 inset-x-0 text-center z-10 pointer-events-none">
            <span
              className="text-[7px] sm:text-[8px] font-semibold text-zinc-400/90 leading-none uppercase tracking-wider"
              style={{
                textShadow: "0 1px 3px rgba(0,0,0,0.9)",
              }}
            >
              {slot.token.symbol}
            </span>
          </div>

          {/* Chain badge — top-right mini indicator */}
          {CHAIN_LOGOS[slot.token.chainId] && (
            <div className={`absolute top-0.5 right-0.5 z-10 pointer-events-none transition-opacity duration-150 ${isHovered ? "opacity-100" : "opacity-40"}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={CHAIN_LOGOS[slot.token.chainId]} alt="" className="w-3 h-3 rounded-full ring-1 ring-black/40" draggable={false} />
            </div>
          )}

          {/* Hover overlay — glassmorphism with token details */}
          <AnimatePresence>
            {isHovered && !isDragging && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.12 }}
                className="absolute inset-0 z-20 rounded-md backdrop-blur-sm bg-zinc-950/80 flex flex-col items-center justify-center px-1 py-0.5 overflow-hidden"
              >
                {/* Token icon at top (smaller) */}
                <TokenIcon
                  address={slot.token.address}
                  chainId={slot.token.chainId}
                  symbol={slot.token.symbol}
                  logo={slot.token.logo}
                  size={18}
                  className="mb-0.5 opacity-90"
                />
                {/* Symbol */}
                <span className="text-[10px] font-bold text-zinc-100 leading-tight truncate max-w-full">
                  {slot.token.symbol}
                </span>
                {/* Full balance */}
                <span className="text-[9px] text-emerald-400 font-semibold leading-tight truncate max-w-full">
                  {formatFullBalance(BigInt(slot.rawAmount), slot.token.decimals)}
                </span>
                {/* Address or "Native" */}
                <span className="text-[8px] text-zinc-500 leading-tight truncate max-w-full mt-px">
                  {slot.token.address === "0x0000000000000000000000000000000000000000"
                    ? "Native"
                    : `${slot.token.address.slice(0, 6)}…${slot.token.address.slice(-4)}`}
                </span>
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </div>
  );
}

// ────────────────────────────────────────────────────────────
// Context Menu (right-click)
// ────────────────────────────────────────────────────────────

function OsrsContextMenu({
  x,
  y,
  slotId,
  slot,
  onSplit,
  onQuickSplit,
  onCopy,
  onClose,
  tradeMode,
  onAddToTrade,
}: {
  x: number;
  y: number;
  slotId: string;
  slot?: InventorySlot;
  onSplit: () => void;
  onQuickSplit: (amount: string) => void;
  onCopy: () => void;
  onClose: () => void;
  tradeMode: boolean;
  onAddToTrade?: (slot: InventorySlot) => void;
}) {
  const [quickSplitValue, setQuickSplitValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const menuItems = [
    { icon: FiScissors, label: "Split Stack…", action: onSplit },
    { icon: FiCopy, label: "Copy Address", action: onCopy },
    ...(tradeMode
      ? [{
          icon: FiRepeat,
          label: "Add to Trade",
          action: () => {
            if (onAddToTrade && slot) onAddToTrade(slot);
            else onClose();
          },
        }]
      : []),
    { icon: FiSend, label: "Send", action: onClose },
  ];

  const maxAmount = slot
    ? parseFloat(formatUnits(BigInt(slot.rawAmount), slot.token.decimals))
    : 0;

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
      <div className="bg-zinc-900 border border-zinc-700 rounded-xl shadow-2xl overflow-hidden min-w-48">
        {/* Header */}
        {slot && (
          <div className="px-3 py-2 border-b border-zinc-800 bg-zinc-950 flex items-center gap-2">
            <TokenIcon
              address={slot.token.address}
              chainId={slot.token.chainId}
              symbol={slot.token.symbol}
              logo={slot.token.logo}
              size={16}
            />
            <span className="text-xs font-semibold text-zinc-300">
              {slot.token.symbol}
            </span>
            <span className="text-[10px] text-zinc-500 ml-auto">
              {slot.amount}
            </span>
          </div>
        )}

        {/* Inline Quick-Split Input */}
        {slot && (
          <div className="px-2 py-1.5 border-b border-zinc-800 bg-zinc-950/50">
            <div className="relative">
              <FiScissors className="absolute left-2 top-1/2 -translate-y-1/2 h-3 w-3 text-zinc-500" />
              <input
                ref={inputRef}
                type="number"
                step="any"
                min="0"
                max={maxAmount}
                placeholder={`Split amount (max ${maxAmount > 1000 ? formatCompactBalance(BigInt(slot.rawAmount), slot.token.decimals) : maxAmount.toFixed(2)})`}
                value={quickSplitValue}
                onChange={(e) => setQuickSplitValue(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                onKeyDown={(e) => {
                  e.stopPropagation();
                  if (e.key === "Enter" && quickSplitValue.trim()) {
                    onQuickSplit(quickSplitValue.trim());
                  }
                  if (e.key === "Escape") onClose();
                }}
                autoFocus
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg pl-7 pr-2 py-1.5 text-[11px] text-zinc-200 placeholder:text-zinc-600 focus:ring-1 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
              />
            </div>
            {/* Quick split percentages */}
            <div className="flex gap-1 mt-1">
              {[25, 33, 50, 75].map((pct) => (
                <button
                  key={pct}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    const val = (maxAmount * pct) / 100;
                    const formatted = val.toFixed(
                      slot.token.decimals > 4 ? 6 : Math.min(slot.token.decimals, 2),
                    );
                    onQuickSplit(formatted);
                  }}
                  className="flex-1 py-0.5 rounded text-[9px] font-medium border border-zinc-700/60 text-zinc-500 hover:bg-emerald-900/20 hover:text-emerald-400 hover:border-emerald-600/40 transition-colors"
                >
                  {pct}%
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Menu items */}
        {menuItems.map((item) => (
          <button
            key={item.label}
            type="button"
            onClick={item.action}
            className="w-full flex items-center gap-2 px-3 py-2 text-xs text-zinc-300 hover:bg-emerald-900/30 hover:text-emerald-400 transition-colors"
          >
            <item.icon className="h-3.5 w-3.5" />
            {item.label}
          </button>
        ))}

        {/* Explorer link at bottom if available */}
        {slot &&
          (() => {
            const url = getExplorerTokenUrl(
              slot.token.chainId,
              slot.token.address,
            );
            if (!url) return null;
            return (
              <a
                href={url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="w-full flex items-center gap-2 px-3 py-2 text-xs text-zinc-300 hover:bg-emerald-900/30 hover:text-emerald-400 transition-colors border-t border-zinc-800"
              >
                <FiExternalLink className="h-3.5 w-3.5" />
                View on Explorer
              </a>
            );
          })()}
      </div>
    </motion.div>
  );
}

// ────────────────────────────────────────────────────────────
// Split Dialog
// ────────────────────────────────────────────────────────────

function OsrsSplitDialog({
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
    formatUnits(BigInt(slot.rawAmount), slot.token.decimals),
  );
  const quickPercentages = [25, 50, 75];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-100 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onCancel}
    >
      <motion.div
        initial={{ scale: 0.9, y: 10 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 10 }}
        onClick={(e) => e.stopPropagation()}
        className="bg-zinc-900 rounded-2xl border border-zinc-700 shadow-2xl p-5 w-80"
      >
        <div className="flex items-center gap-2 mb-1">
          <FiScissors className="h-4 w-4 text-emerald-500" />
          <h3 className="text-sm font-semibold text-zinc-200">
            Split {slot.token.symbol}
          </h3>
        </div>
        <p className="text-[10px] text-zinc-500 mb-3">
          Stack: {slot.amount} {slot.token.symbol} &middot; Split attaches to
          your cursor
        </p>

        <div className="relative mb-2">
          <input
            type="number"
            step="any"
            min="0"
            max={maxAmount}
            placeholder="Amount to split off..."
            value={value}
            onChange={(e) => onChange(e.target.value)}
            autoFocus
            className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2.5 text-sm text-zinc-200 focus:ring-2 focus:ring-emerald-500/50 transition-all pr-14"
            onKeyDown={(e) => e.key === "Enter" && onConfirm()}
          />
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-medium text-zinc-500">
            {slot.token.symbol}
          </span>
        </div>

        <div className="flex gap-1.5 mb-3">
          {quickPercentages.map((pct) => (
            <button
              key={pct}
              type="button"
              onClick={() => {
                const val = (maxAmount * pct) / 100;
                onChange(
                  val.toFixed(
                    slot.token.decimals > 4 ? 6 : slot.token.decimals,
                  ),
                );
              }}
              className="flex-1 py-1 rounded-md text-[10px] font-medium border border-zinc-700 text-zinc-400 hover:bg-emerald-900/20 hover:text-emerald-400 hover:border-emerald-700/50 transition-colors"
            >
              {pct}%
            </button>
          ))}
        </div>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 text-xs py-2 rounded-xl border border-zinc-700 text-zinc-400 hover:bg-zinc-800 transition-colors"
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
// Floating Ghost Item
// ────────────────────────────────────────────────────────────

function OsrsFloatingGhost({
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
      style={{ left: x - 28, top: y - 28 }}
    >
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
      <div className="relative w-14 h-14 rounded-xl border-2 border-emerald-500 bg-emerald-500/10 backdrop-blur-md flex flex-col items-center justify-center shadow-2xl shadow-emerald-500/30">
        <div className="w-5 h-5 flex items-center justify-center">
          <TokenIcon
            address={item.token.address}
            chainId={item.token.chainId}
            symbol={item.token.symbol}
            logo={item.token.logo}
            size={20}
          />
        </div>
        <span className="text-[8px] font-bold text-emerald-400 mt-0.5">
          {item.amount}
        </span>
        <span className="text-[7px] text-emerald-500/80">
          {item.token.symbol}
        </span>
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

/** OSRS-style stack colour: white < 100K, yellow 100K–9.99M, green ≥ 10M */
function getStackColor(display: string): string {
  const stripped = display.replace(/[^0-9.KMBkmb]/g, "");
  const upper = stripped.toUpperCase();

  if (upper.includes("B") || upper.includes("G")) return "text-emerald-400";
  if (upper.includes("M")) {
    const num = parseFloat(upper.replace("M", ""));
    return num >= 10 ? "text-emerald-400" : "text-white";
  }
  if (upper.includes("K")) {
    const num = parseFloat(upper.replace("K", ""));
    return num >= 100 ? "text-amber-300" : "text-white";
  }
  return "text-amber-100";
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
