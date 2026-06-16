"use client";

/**
 * DirectWalletConnect — first-class direct wallet connection that does NOT depend
 * on Reown/AppKit. Uses the wagmi connectors (metaMask / coinbaseWallet /
 * injected) configured in evmConfig.ts, so it works even if AppKit is down or
 * unconfigured — and gives users who simply prefer their own wallet a direct
 * path instead of the Reown modal.
 *
 * Rendered as a compact set of buttons. Connection success is handled by the
 * app's existing wagmi/SIWE verification flow elsewhere; here we just connect.
 */

import * as React from "react";
import { useConnect } from "wagmi";
import Image from "next/image";
import { toast } from "sonner";
import { FiLoader } from "react-icons/fi";

// Friendly metadata per connector id (icons live in /public/wallets).
const WALLET_META: Record<string, { label: string; icon?: string; emoji?: string }> = {
  metaMask: { label: "MetaMask", emoji: "🦊" },
  metaMaskSDK: { label: "MetaMask", emoji: "🦊" },
  coinbaseWallet: { label: "Coinbase Wallet", icon: "/wallets/coinbase.webp" },
  coinbaseWalletSDK: { label: "Coinbase Wallet", icon: "/wallets/coinbase.webp" },
  injected: { label: "Browser wallet", emoji: "🔌" },
};

export default function DirectWalletConnect({ className = "" }: { className?: string }) {
  const { connect, connectors, isPending, variables } = useConnect({
    mutation: {
      onError: (e) => toast.error(e?.message?.slice(0, 120) || "Wallet connection failed"),
      onSuccess: () => toast.success("Wallet connected"),
    },
  });

  // De-duplicate by friendly label, prefer EIP-6963 injected providers, and
  // drop the WalletConnect connector here (that's the Reown/AppKit path).
  const direct = React.useMemo(() => {
    const seen = new Set<string>();
    return connectors
      .filter((c) => c.id !== "walletConnect" && c.type !== "walletConnect")
      .map((c) => {
        const meta = WALLET_META[c.id] ?? { label: c.name, emoji: "👛" };
        return { connector: c, ...meta };
      })
      .filter((w) => {
        if (seen.has(w.label)) return false;
        seen.add(w.label);
        return true;
      });
  }, [connectors]);

  if (direct.length === 0) return null;

  return (
    <div className={`grid grid-cols-1 gap-2 ${className}`}>
      {direct.map((w) => {
        const pending = isPending && variables?.connector === w.connector;
        return (
          <button
            key={w.connector.uid}
            type="button"
            disabled={isPending}
            onClick={() => connect({ connector: w.connector })}
            className="flex items-center justify-center gap-2 h-11 rounded-xl border border-zinc-200 dark:border-zinc-700 text-sm font-medium text-zinc-700 dark:text-zinc-300 enabled:hover:bg-zinc-50 dark:enabled:hover:bg-zinc-900 transition-colors disabled:opacity-60 disabled:cursor-wait"
            title={`Connect with ${w.label}`}
          >
            {pending ? (
              <FiLoader className="h-4 w-4 animate-spin" />
            ) : w.icon ? (
              <Image src={w.icon} alt={w.label} width={18} height={18} className="rounded-sm" />
            ) : (
              <span className="text-base leading-none">{w.emoji}</span>
            )}
            <span>{pending ? "Connecting…" : w.label}</span>
          </button>
        );
      })}
    </div>
  );
}
