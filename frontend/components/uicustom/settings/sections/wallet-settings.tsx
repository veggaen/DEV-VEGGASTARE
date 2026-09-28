"use client";

/**
 * @fileOverview  Settings › Web3 & Wallet: the Web3 mode switch, the live
 *                wallet session, ownership verification and the list of linked
 *                payout wallets. Nothing here moves money.
 * @stability     evolving
 */

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { useAccount, useDisconnect } from "wagmi";
import { FiChevronRight, FiInfo, FiKey, FiLock, FiShield } from "react-icons/fi";
import { Button } from "@/components/ui/button";
import WalletConnectChooser from "@/components/crypto-related/WalletConnectChooser";
import EvmWalletVerify from "@/components/crypto-related/EvmWalletVerify";
import EvmWalletList from "@/components/crypto-related/EvmWalletList";
import { Web3ModeControl } from "@/components/uicustom/settings/web3-mode-control";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useWeb3Mode } from "@/hooks/use-web3-mode";
import { isDemoUserId } from "@/lib/demo-policy";
import { SectionHeader, SettingsCard, SettingsGroup, StatusPill } from "../settings-primitives";
import { cn } from "@/lib/utils";

export function Web3WalletSettings() {
  const user = useCurrentUser();
  const demo = isDemoUserId(user?.id);
  const web3State = useWeb3Mode();
  const web3Enabled = web3State.data === true;
  const [walletRefresh, setWalletRefresh] = useState(0);
  const [linkingGuide, setLinkingGuide] = useState(false);

  return (
    <div className="space-y-6">
      <SectionHeader icon={FiKey} title="Web3 & Wallet" description="Experimental wallet connections and verified payout addresses. Not required for shopping." />

      <SettingsCard tone="accent" className="p-0">
        <button
          type="button"
          aria-expanded={linkingGuide}
          aria-controls="wallet-linking-guide"
          onClick={() => setLinkingGuide((prev) => !prev)}
          className="flex min-h-12 w-full items-center justify-between gap-3 rounded-2xl px-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <span className="flex items-center gap-2 text-sm font-semibold text-foreground"><FiInfo className="size-4 text-brand-accent" aria-hidden="true" />How wallet linking works</span>
          <FiChevronRight aria-hidden="true" className={cn("size-4 text-brand-accent transition-transform duration-200", linkingGuide && "rotate-90")} />
        </button>
        {linkingGuide && (
          <ol id="wallet-linking-guide" className="space-y-1.5 border-t border-brand-accent/20 px-4 py-3 text-sm text-foreground/85 [counter-reset:step]">
            <li><strong>Enable Web3 mode</strong> below to unlock wallet features.</li>
            <li><strong>Connect</strong> with a browser extension directly, or use AppKit for WalletConnect and social wallets.</li>
            <li><strong>Verify ownership</strong> by signing a challenge message. This links the wallet to your account.</li>
            <li>Each verified wallet <strong>raises your trust level</strong> and unlocks features like crypto payments.</li>
            <li className="text-xs text-muted-foreground">A confirmation email is sent every time you link or unlink a wallet.</li>
          </ol>
        )}
      </SettingsCard>

      {demo && (
        <SettingsCard tone="muted" className="text-sm text-muted-foreground">
          Demo preview: you can inspect wallet connection options. Saving a wallet link, changing payout settings and on-chain transactions are disabled. No signature is requested here.
        </SettingsCard>
      )}

      <SettingsCard className="flex items-center justify-between gap-4">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">Web3 mode</p>
          <p className="text-xs text-muted-foreground">Wallet sign-in and experimental tools. Saved payout addresses are separate.</p>
        </div>
        <Web3ModeControl />
      </SettingsCard>

      {(web3Enabled || demo) && (
        <>
          <SettingsGroup title="Connection" description="The wallet this browser talks to right now.">
            <SettingsCard className="space-y-3">
              <div>
                <p className="text-sm font-medium text-foreground">Connect a wallet</p>
                <p className="text-xs text-muted-foreground">Browser extension for MetaMask, Coinbase or Rabby; AppKit for WalletConnect and social wallets.</p>
              </div>
              <WalletConnectChooser authenticateDirect={false}>
                <Button type="button" variant="vegaEmeraldBtn" className="h-auto min-h-11 w-full justify-center whitespace-normal px-3 py-3">Choose wallet connection method</Button>
              </WalletConnectChooser>
              <WalletSessionDisconnectButton />
            </SettingsCard>
          </SettingsGroup>

          {!demo && (
            <SettingsGroup title="Ownership" description="Signing proves the wallet is yours. No transaction, no fee.">
              <SettingsCard className="space-y-3">
                <div>
                  <p className="text-sm font-medium text-foreground">Verify &amp; link wallet</p>
                  <p className="text-xs text-muted-foreground">Sign a message to prove ownership and link this wallet to your account.</p>
                </div>
                <EvmWalletVerify enabled={web3Enabled} onVerified={() => setWalletRefresh((prev) => prev + 1)} />
              </SettingsCard>
            </SettingsGroup>
          )}

          {!demo && (
            <SettingsGroup title="Linked wallets" description="Removing a link is separate from disconnecting the current session.">
              <SettingsCard className="space-y-3">
                <EvmWalletList enabled={web3Enabled} refreshToken={walletRefresh} />
              </SettingsCard>
            </SettingsGroup>
          )}

          <SettingsCard tone="accent" className="flex items-start gap-3">
            <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-brand-accent/15 text-brand-accent"><FiShield className="size-4" aria-hidden="true" /></span>
            <p className="text-sm text-foreground/90">
              <span className="font-semibold">Boost your trust level.</span> Linking wallets raises your verification tier and Reach multiplier. Check your level in the{" "}
              <Link href="/settings?section=verification" className="font-medium text-brand-accent-hover underline underline-offset-4 dark:text-brand-accent-light">Verification section</Link>.
            </p>
          </SettingsCard>
        </>
      )}

      {web3State.data === undefined && !demo && (
        <div role="status" className="min-h-40 rounded-2xl border border-border/60 bg-foreground/[0.03] p-4 text-sm text-muted-foreground">
          {web3State.isError ? "Wallet settings unavailable. Retry above." : "Loading wallet settings…"}
        </div>
      )}
      {web3State.data === false && !demo && (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border/70 py-8 text-center">
          <FiLock className="size-7 text-muted-foreground/60" aria-hidden="true" />
          <p className="text-sm text-muted-foreground">Enable Web3 mode above to connect and manage wallets.</p>
        </div>
      )}
    </div>
  );
}

function WalletSessionDisconnectButton() {
  const { address, isConnected } = useAccount();
  const { disconnectAsync } = useDisconnect();
  const [busy, setBusy] = useState(false);
  const shortAddress = address ? `${address.slice(0, 6)}…${address.slice(-4)}` : null;

  const disconnectSession = async () => {
    setBusy(true);
    try {
      await disconnectAsync();
      toast.success("Wallet session disconnected. Your verified wallet link is still saved.");
    } catch {
      toast.error("Could not disconnect the wallet session.");
    } finally {
      setBusy(false);
    }
  };

  if (!isConnected) {
    return <p className="rounded-xl border border-dashed border-border/70 px-3 py-2 text-xs text-muted-foreground">No live wallet session. Verified wallets can still stay linked for seller payouts.</p>;
  }
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-brand-accent/25 bg-brand-accent/[0.08] px-3 py-2">
      <div className="min-w-0">
        <p className="flex items-center gap-2 text-xs font-semibold text-foreground">Current session <StatusPill tone="accent">{shortAddress}</StatusPill></p>
        <p className="text-xs text-muted-foreground">Connected in this browser. Disconnecting does not unlink it from your account.</p>
      </div>
      <Button type="button" variant="vegaNormalBtn" size="sm" disabled={busy} onClick={() => void disconnectSession()} className="min-h-10">{busy ? "Disconnecting…" : "Disconnect session"}</Button>
    </div>
  );
}
