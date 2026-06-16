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
import { signIn } from "next-auth/react";
import Image from "next/image";
import { toast } from "sonner";
import { FiLoader } from "react-icons/fi";

/**
 * After a wallet connects, run SIWE → NextAuth: fetch a nonce, ask the wallet to
 * sign it, then signIn('wallet'). On success the user is logged into the wallet's
 * linked account, or a new low-reach WALLET_ONLY account is created.
 */
async function signInWithWallet(address: string, signMessage: (msg: string) => Promise<string>) {
  const res = await fetch("/api/auth/wallet/nonce", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ address }),
  });
  if (!res.ok) throw new Error("Could not start wallet sign-in");
  const { message } = await res.json();
  const signature = await signMessage(message);
  const result = await signIn("wallet", { address, signature, redirect: false, callbackUrl: "/products" });
  if (result?.error) throw new Error("Wallet sign-in failed");
  return result;
}

// Friendly metadata per connector id (icons live in /public/wallets).
const WALLET_META: Record<string, { label: string; icon?: string; emoji?: string }> = {
  metaMask: { label: "MetaMask", emoji: "🦊" },
  metaMaskSDK: { label: "MetaMask", emoji: "🦊" },
  coinbaseWallet: { label: "Coinbase Wallet", icon: "/wallets/coinbase.webp" },
  coinbaseWalletSDK: { label: "Coinbase Wallet", icon: "/wallets/coinbase.webp" },
  injected: { label: "Browser wallet", emoji: "🔌" },
};

export default function DirectWalletConnect({ className = "" }: { className?: string }) {
  const [authing, setAuthing] = React.useState(false);

  const { connectAsync, connectors, isPending, variables } = useConnect();

  const handleConnect = async (connector: (typeof connectors)[number]) => {
    try {
      const result = await connectAsync({ connector });
      const account = result.accounts?.[0];
      if (!account) throw new Error("No account returned");
      setAuthing(true);
      toast.loading("Sign the message in your wallet…", { id: "wallet-auth" });
      // Get a client to sign the SIWE message.
      const client = await connector.getProvider?.();
      const signMessage = async (msg: string) => {
        // EIP-1193 personal_sign
        return (await (client as { request: (a: unknown) => Promise<string> }).request({
          method: "personal_sign",
          params: [msg, account],
        }));
      };
      await signInWithWallet(account, signMessage);
      toast.success("Signed in with wallet", { id: "wallet-auth" });
      window.location.href = "/products";
    } catch (e) {
      toast.error((e as Error)?.message?.slice(0, 120) || "Wallet sign-in failed", { id: "wallet-auth" });
    } finally {
      setAuthing(false);
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

  if (direct.length === 0) return null;

  return (
    <div className={`grid grid-cols-1 gap-2 ${className}`}>
      {direct.map((w) => {
        const busy = (isPending && variables?.connector === w.connector) || authing;
        const pending = busy;
        return (
          <button
            key={w.connector.uid}
            type="button"
            disabled={isPending || authing}
            onClick={() => handleConnect(w.connector)}
            className="flex items-center gap-3 h-12 rounded-xl border border-border/70 bg-muted/20 px-3 text-sm font-medium text-foreground enabled:hover:border-brand-accent/40 enabled:hover:bg-muted/50 transition-all active:scale-[0.99] disabled:opacity-60 disabled:cursor-wait"
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
            <span className="flex-1 text-left">{authing ? "Sign in your wallet…" : pending ? "Connecting…" : w.label}</span>
          </button>
        );
      })}
    </div>
  );
}
