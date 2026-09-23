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
import { useWalletSignIn } from "@/hooks/use-wallet-sign-in";

// Friendly metadata per connector id (icons live in /public/wallets).
const WALLET_META: Record<string, { label: string; icon?: string; emoji?: string }> = {
  metaMask: { label: "MetaMask", emoji: "🦊" },
  metaMaskSDK: { label: "MetaMask", emoji: "🦊" },
  coinbaseWallet: { label: "Coinbase Wallet", icon: "/wallets/coinbase.webp" },
  coinbaseWalletSDK: { label: "Coinbase Wallet", icon: "/wallets/coinbase.webp" },
  injected: { label: "Browser wallet", emoji: "🔌" },
};

export default function DirectWalletConnect({
  className = "",
  authenticateOnConnect = true,
  onConnected,
}: {
  className?: string;
  authenticateOnConnect?: boolean;
  onConnected?: () => void;
}) {
  const { connectAsync, connectors, isPending, variables } = useConnect();
  const { signInWithAddress, signingIn: authing } = useWalletSignIn();
  const [error, setError] = React.useState<string | null>(null);
  const [ready, setReady] = React.useState<Record<string, boolean>>({});
  React.useEffect(() => {
    let active = true;
    for (const connector of connectors) {
      // Only probe extension connectors. SDK / WalletConnect providers may open
      // an external picker and must not initialize as a side effect of rendering.
      if (connector.type !== 'injected') continue;
      void connector.getProvider().then(provider => {
        if (active) setReady(previous => ({ ...previous, [connector.uid]: !!provider }));
      }).catch(() => {
        if (active) setReady(previous => ({ ...previous, [connector.uid]: false }));
      });
    }
    return () => { active = false; };
  }, [connectors]);

  const handleConnect = async (connector: (typeof connectors)[number]) => {
    setError(null);
    try {
      const result = await connectAsync({ connector });
      const account = result.accounts?.[0];
      if (!account) throw new Error("No account returned");
      if (!authenticateOnConnect) {
        toast.success(`${connector.name} connected`);
        onConnected?.();
        return;
      }
      // Shared SIWE flow (wagmi useSignMessage under the hood) — same path the
      // AppKit bridge uses, so there's one implementation.
      if (await signInWithAddress(account)) onConnected?.();
    } catch (e) {
      const msg = (e as Error)?.message ?? "";
      setError(/reject|denied|cancel/i.test(msg)
        ? 'Connection cancelled. You can choose a wallet again when ready.'
        : 'Could not connect. Check that your wallet is installed and unlocked, then try again.');
    }
  };

  // De-duplicate by friendly label, prefer EIP-6963 injected providers, and
  // drop the WalletConnect connector here (that's the Reown/AppKit path).
  const direct = React.useMemo(() => {
    const seen = new Set<string>();
    return connectors
      // Exclude the Reown/AppKit-managed connectors (WalletConnect QR bridge and
      // the embedded social "auth" connector) — this panel is for DIRECT wallets.
      .filter((c) =>
        c.id !== "walletConnect" &&
        c.type !== "walletConnect" &&
        c.id !== "auth" &&
        c.type !== "auth" &&
        !/auth/i.test(c.name))
      .map((c) => {
        const meta = WALLET_META[c.id] ?? { label: c.name, emoji: "👛" };
        // Prefer the connector's OWN icon (EIP-6963 wallets expose a real
        // brand icon as a data URI) so MetaMask/etc. show their true logo.
        const connectorIcon = (c as unknown as { icon?: string }).icon;
        return { connector: c, ...meta, icon: connectorIcon ?? meta.icon };
      })
      .filter((w) => {
        if (seen.has(w.label)) return false;
        seen.add(w.label);
        return true;
      });
  }, [connectors]);

  if (direct.length === 0) {
    return (
      <div className={`rounded-xl border border-dashed border-border/70 bg-muted/20 p-3 text-sm text-muted-foreground ${className}`}>
        No browser extension wallets detected. Open Veggat in your wallet browser or use a browser with a wallet extension installed.
      </div>
    );
  }

  return (
    <div className={`grid grid-cols-1 gap-2 ${className}`}>
      {error && <p role="alert" className="rounded-lg border border-border p-3 text-sm text-muted-foreground">{error}</p>}
      {direct.map((w) => {
        const busy = (isPending && variables?.connector === w.connector) || authing;
        const pending = busy;
        const unavailable = w.connector.type === 'injected' && !ready[w.connector.uid];
        return (
          <button
            key={w.connector.uid}
            type="button"
            disabled={isPending || authing || unavailable}
            onClick={() => handleConnect(w.connector)}
            className="flex min-h-12 items-center gap-3 rounded-xl border border-border/70 bg-muted/20 px-3 py-2 text-sm font-medium text-foreground enabled:hover:border-brand-accent/40 enabled:hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
            title={`Connect with ${w.label}`}
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-background">
              {pending ? (
                <FiLoader className="h-4 w-4 animate-spin text-muted-foreground" />
              ) : w.icon ? (
                <Image src={w.icon} alt={w.label} width={20} height={20} unoptimized className="rounded" />
              ) : (
                <span className="text-base leading-none">{w.emoji}</span>
              )}
            </span>
            <span className="min-w-0 flex-1 text-left">{authing ? "Sign in your wallet…" : pending ? "Connecting…" : w.label}
              {unavailable && <span className="block text-xs font-normal text-muted-foreground">No extension detected in this browser</span>}
            </span>
          </button>
        );
      })}
    </div>
  );
}
