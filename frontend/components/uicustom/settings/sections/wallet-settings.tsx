"use client";

/**
 * @fileOverview  Settings › Web3 & Wallet, compact: the Web3 switch, then the
 *                live session and ownership verification side by side, then
 *                the linked payout wallets. The linking guide is a one-line
 *                disclosure under the header, not a card. Nothing here moves
 *                money.
 * @stability     evolving
 */

import { useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { useAccount, useDisconnect } from "wagmi";
import { FiChevronRight, FiKey, FiLock, FiShield } from "react-icons/fi";
import { Button } from "@/components/ui/button";
import WalletConnectChooser from "@/components/crypto-related/WalletConnectChooser";
import EvmWalletVerify from "@/components/crypto-related/EvmWalletVerify";
import EvmWalletList from "@/components/crypto-related/EvmWalletList";
import { Web3ModeControl } from "@/components/uicustom/settings/web3-mode-control";
import { useCurrentUser } from "@/hooks/use-current-user";
import { useWeb3Mode } from "@/hooks/use-web3-mode";
import { isDemoUserId } from "@/lib/demo-policy";
import { SectionHeader, SettingsGroup, StatusPill, settingsCard } from "../settings-primitives";
import { cn } from "@/lib/utils";

export function Web3WalletSettings() {
  const user = useCurrentUser();
  const demo = isDemoUserId(user?.id);
  const web3State = useWeb3Mode();
  const web3Enabled = web3State.data === true;
  const [walletRefresh, setWalletRefresh] = useState(0);
  const [guide, setGuide] = useState(false);

  return (
    <div className="space-y-5">
      <SectionHeader
        icon={FiKey}
        title="Web3 & Wallet"
        description="Wallet connections and verified payout addresses. Optional; not needed for shopping."
        actions={
          <div className="flex items-center gap-3 rounded-xl border border-border/60 bg-card/60 px-3 py-1.5">
            <span className="text-sm font-medium text-foreground">Web3 mode</span>
            <Web3ModeControl />
          </div>
        }
      />

      <button
        type="button"
        aria-expanded={guide}
        aria-controls="wallet-linking-guide"
        onClick={() => setGuide((v) => !v)}
        className="inline-flex min-h-8 items-center gap-1.5 rounded-lg px-1.5 text-xs font-medium text-brand-accent-hover transition-colors hover:bg-brand-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring dark:text-brand-accent-light"
      >
        <FiChevronRight aria-hidden="true" className={cn("size-3.5 transition-transform duration-200", guide && "rotate-90")} />
        How wallet linking works
      </button>
      {guide && (
        <ol id="wallet-linking-guide" className="-mt-2 grid gap-1.5 rounded-xl border border-border/60 bg-foreground/[0.03] px-4 py-3 text-xs text-foreground/85 sm:grid-cols-2 [&>li]:flex [&>li]:gap-2">
          <li><span className="font-semibold text-brand-accent">1</span>Enable Web3 mode (top right) to unlock wallet features.</li>
          <li><span className="font-semibold text-brand-accent">2</span>Connect a browser extension, or AppKit for WalletConnect and social wallets.</li>
          <li><span className="font-semibold text-brand-accent">3</span>Sign a free challenge message to prove ownership; that links the wallet.</li>
          <li><span className="font-semibold text-brand-accent">4</span>Verified wallets raise your trust level; a confirmation email follows every link or unlink.</li>
        </ol>
      )}

      {demo && (
        <p className="rounded-xl border border-dashed border-border/70 px-3 py-2 text-xs text-muted-foreground">
          Demo preview: inspect the connection options. Saving a link, changing payout settings and on-chain transactions are disabled; no signature is requested.
        </p>
      )}

      {(web3Enabled || demo) && (
        <>
          <div className="grid gap-3 lg:grid-cols-2">
            <section aria-label="Wallet session" className={cn(settingsCard, "flex flex-col gap-3 p-4")}>
              <div>
                <p className="text-sm font-semibold text-foreground">Connection</p>
                <p className="text-xs text-muted-foreground">MetaMask, Coinbase or Rabby directly; AppKit for WalletConnect and social wallets.</p>
              </div>
              <WalletConnectChooser authenticateDirect={false}>
                <Button type="button" variant="vegaEmeraldBtn" size="sm" className="h-auto min-h-10 w-fit whitespace-normal px-4">Choose connection method</Button>
              </WalletConnectChooser>
              <WalletSessionLine />
            </section>
            {demo ? (
              <section aria-label="Ownership" className={cn(settingsCard, "p-4 text-xs text-muted-foreground")}>Ownership verification signs a message with your own wallet. Not available in the demo.</section>
            ) : (
              <EvmWalletVerify enabled={web3Enabled} onVerified={() => setWalletRefresh((prev) => prev + 1)} />
            )}
          </div>

          {!demo && (
            <SettingsGroup title="Linked wallets" description="Saved payout addresses. Removing a link is separate from disconnecting the session above.">
              <div className={cn(settingsCard, "p-4")}>
                <EvmWalletList enabled={web3Enabled} refreshToken={walletRefresh} />
              </div>
            </SettingsGroup>
          )}

          <p className="flex items-start gap-2 text-xs text-muted-foreground">
            <FiShield aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-brand-accent" />
            <span>Each verified wallet raises your verification tier and Reach multiplier. See the <Link href="/settings?section=verification" className="font-medium text-brand-accent-hover underline underline-offset-4 dark:text-brand-accent-light">Verification section</Link>.</span>
          </p>
        </>
      )}

      {web3State.data === undefined && !demo && (
        <div role="status" className="rounded-xl border border-border/60 bg-foreground/[0.03] p-4 text-sm text-muted-foreground">
          {web3State.isError ? "Wallet settings unavailable. Retry above." : "Loading wallet settings…"}
        </div>
      )}
      {web3State.data === false && !demo && (
        <div className="flex items-center gap-3 rounded-xl border border-dashed border-border/70 px-4 py-5 text-sm text-muted-foreground">
          <FiLock className="size-5 shrink-0 text-muted-foreground/60" aria-hidden="true" />
          Turn on Web3 mode (top right) to connect and manage wallets.
        </div>
      )}
    </div>
  );
}

function WalletSessionLine() {
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

  if (!isConnected) return <p className="text-xs text-muted-foreground">No live session in this browser. Verified wallets stay linked for payouts.</p>;
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-brand-accent/25 bg-brand-accent/[0.08] px-2.5 py-1.5">
      <p className="flex items-center gap-2 text-xs text-foreground">Connected <StatusPill tone="accent">{shortAddress}</StatusPill></p>
      <Button type="button" variant="ghost" size="sm" disabled={busy} onClick={() => void disconnectSession()} className="h-8 px-2 text-xs">{busy ? "Disconnecting…" : "Disconnect"}</Button>
    </div>
  );
}
