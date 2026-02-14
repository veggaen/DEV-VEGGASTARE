/**
 * @fileOverview Compact multi-wallet panel for the nav sidebar.
 * Shows all linked wallets (from DB) plus the live-connected wallet.
 * Replaces the old single-AppKit-button layout.
 *
 * @stability experimental
 */
"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useAccount, useChainId } from "wagmi";
import { useWallet as useSolanaWallet } from "@solana/wallet-adapter-react";
import { FiCopy, FiCheck, FiZap, FiExternalLink } from "react-icons/fi";
import { toast } from "sonner";
import AppKitButton from "./AppKitButton";
import { CHAIN_DISPLAY } from "@/lib/vegga-system-constants";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type LinkedWallet = {
  id: string;
  label: string;
  family: "EVM" | "SOLANA" | "BITCOIN";
  address: string;
  chainId: number | null;
  isDefault: boolean;
  verifiedAt: string | null;
};

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function trimAddress(addr: string, head = 6, tail = 4) {
  if (!addr || addr.length <= head + tail + 2) return addr;
  return `${addr.slice(0, head)}…${addr.slice(-tail)}`;
}

function chainIcon(family: string) {
  return CHAIN_DISPLAY[family]?.icon ?? "⬡";
}

function chainColor(family: string) {
  return CHAIN_DISPLAY[family]?.color ?? "#71717a";
}

/* ------------------------------------------------------------------ */
/*  WalletRow                                                          */
/* ------------------------------------------------------------------ */

function WalletRow({
  label,
  family,
  address,
  isLive,
  isDefault,
  verified,
}: {
  label: string;
  family: string;
  address: string;
  isLive?: boolean;
  isDefault?: boolean;
  verified?: boolean;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      toast.success("Address copied");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Copy failed");
    }
  };

  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-100 dark:border-zinc-800">
      {/* Chain icon */}
      <span
        className="text-sm shrink-0"
        style={{ color: chainColor(family) }}
        title={family}
      >
        {chainIcon(family)}
      </span>

      {/* Info column */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1">
          <span className="text-[11px] font-medium text-zinc-700 dark:text-zinc-300 truncate">
            {label}
          </span>
          {isLive && (
            <span className="relative flex h-1.5 w-1.5 shrink-0">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
            </span>
          )}
          {isDefault && (
            <span className="text-[8px] uppercase tracking-wider px-1 py-px rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-semibold shrink-0">
              Primary
            </span>
          )}
          {verified && (
            <FiCheck className="h-3 w-3 text-emerald-500 shrink-0" />
          )}
        </div>
        <span className="text-[10px] font-mono text-zinc-500 dark:text-zinc-400 block truncate" title={address}>
          {trimAddress(address)}
        </span>
      </div>

      {/* Copy */}
      <button
        type="button"
        onClick={copy}
        className="p-1 rounded hover:bg-zinc-200 dark:hover:bg-zinc-700 transition-colors shrink-0"
        title="Copy address"
      >
        {copied ? (
          <FiCheck className="h-3 w-3 text-emerald-500" />
        ) : (
          <FiCopy className="h-3 w-3 text-zinc-400" />
        )}
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  SidebarWalletPanel                                                 */
/* ------------------------------------------------------------------ */

export default function SidebarWalletPanel({
  isLoggedIn,
  web3Enabled,
  onClose,
}: {
  isLoggedIn: boolean;
  web3Enabled: boolean;
  onClose: () => void;
}) {
  const { address: evmAddress, isConnected: evmConnected } = useAccount();
  const evmChainId = useChainId();

  // Solana wallet state (safe even if provider not available)
  let solAddress: string | null = null;
  let solConnected = false;
  try {
    const sol = useSolanaWallet();
    solAddress = sol.publicKey?.toBase58() ?? null;
    solConnected = sol.connected;
  } catch {
    // Solana provider may not be mounted
  }

  const [linkedWallets, setLinkedWallets] = useState<LinkedWallet[]>([]);
  const [loading, setLoading] = useState(false);

  const fetchLinked = useCallback(async () => {
    if (!isLoggedIn || !web3Enabled) {
      setLinkedWallets([]);
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/wallets/evm");
      if (res.ok) {
        const json = await res.json();
        setLinkedWallets(Array.isArray(json?.wallets) ? json.wallets : []);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [isLoggedIn, web3Enabled]);

  useEffect(() => {
    fetchLinked();
  }, [fetchLinked]);

  // Build display list: linked wallets + live connections not yet linked
  const displayWallets: Array<{
    key: string;
    label: string;
    family: string;
    address: string;
    isLive: boolean;
    isDefault: boolean;
    verified: boolean;
  }> = [];

  // 1. Add all linked wallets from DB
  const linkedAddresses = new Set<string>();
  for (const w of linkedWallets) {
    linkedAddresses.add(w.address.toLowerCase());
    const isLive =
      (w.family === "EVM" && evmConnected && evmAddress?.toLowerCase() === w.address.toLowerCase()) ||
      (w.family === "SOLANA" && solConnected && solAddress?.toLowerCase() === w.address.toLowerCase());
    displayWallets.push({
      key: w.id,
      label: w.label,
      family: w.family,
      address: w.address,
      isLive,
      isDefault: w.isDefault,
      verified: !!w.verifiedAt,
    });
  }

  // 2. Add live connections that aren't linked yet
  if (evmConnected && evmAddress && !linkedAddresses.has(evmAddress.toLowerCase())) {
    displayWallets.push({
      key: `live-evm-${evmAddress}`,
      label: "Connected (not linked)",
      family: "EVM",
      address: evmAddress,
      isLive: true,
      isDefault: false,
      verified: false,
    });
  }
  if (solConnected && solAddress && !linkedAddresses.has(solAddress.toLowerCase())) {
    displayWallets.push({
      key: `live-sol-${solAddress}`,
      label: "Connected (not linked)",
      family: "SOLANA",
      address: solAddress,
      isLive: true,
      isDefault: false,
      verified: false,
    });
  }

  const hasAnyWallet = displayWallets.length > 0;

  return (
    <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-2 bg-zinc-50/50 dark:bg-zinc-900/50 border-b border-zinc-100 dark:border-zinc-800">
        <FiZap className="h-4 w-4 text-emerald-500" />
        <span className="text-xs font-medium text-zinc-600 dark:text-zinc-400">
          Web3 Wallets
        </span>
        {hasAnyWallet && (
          <span className="text-[10px] text-zinc-400 dark:text-zinc-500 tabular-nums">
            {displayWallets.length}
          </span>
        )}
        {isLoggedIn && web3Enabled && (
          <Link
            href="/settings?section=wallet"
            onClick={onClose}
            className="ml-auto text-[10px] text-zinc-400 hover:text-emerald-500 transition-colors"
          >
            Manage →
          </Link>
        )}
      </div>

      {/* Body */}
      <div className="p-2.5 space-y-1.5">
        {/* Wallet list */}
        {displayWallets.map((w) => (
          <WalletRow
            key={w.key}
            label={w.label}
            family={w.family}
            address={w.address}
            isLive={w.isLive}
            isDefault={w.isDefault}
            verified={w.verified}
          />
        ))}

        {/* Empty state */}
        {!hasAnyWallet && !loading && (
          <div className="text-center py-2">
            <p className="text-[11px] text-zinc-500 dark:text-zinc-400 mb-2">
              No wallets connected
            </p>
          </div>
        )}

        {/* Loading */}
        {loading && !hasAnyWallet && (
          <div className="flex justify-center py-3">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-emerald-500 border-t-transparent" />
          </div>
        )}

        {/* AppKit connect button */}
        <div className="flex justify-center pt-1">
          <AppKitButton size="sm" />
        </div>

        {/* Quick links */}
        {isLoggedIn && web3Enabled && (
          <Link
            href="/dashboard/inventory"
            onClick={onClose}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-[11px] text-zinc-500 dark:text-zinc-400 hover:text-emerald-500 dark:hover:text-emerald-400 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors"
          >
            <FiExternalLink className="h-3 w-3" />
            Token Inventory
          </Link>
        )}
      </div>
    </div>
  );
}
