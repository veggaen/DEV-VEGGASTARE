"use client";

/**
 * @fileOverview WalletConnectChooser — lets the user pick HOW they want to
 * connect a wallet, separating the two connection methods so people who don't
 * want to touch Reown have a clean direct path.
 * @stability evolving
 *
 *
 *   1. "All wallets" → opens the Reown AppKit modal (600+ wallets, WalletConnect
 *      QR, social/email). One integration, nested options.
 *   2. "Connect directly" → MetaMask / Coinbase / browser wallet straight through
 *      wagmi (no Reown). For users who prefer their own wallet only.
 *
 * Rendered as a Dialog (centered modal on desktop, full-width on mobile). The
 * trigger is provided by the parent via `children` (asChild).
 */

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FiChevronRight } from "react-icons/fi";
import { IS_WEB3_CONFIGURED } from "@/lib/web3-config";
import DirectWalletConnect from "./DirectWalletConnect";

export default function WalletConnectChooser({
  children,
  authenticateDirect = true,
}: {
  children: React.ReactNode;
  authenticateDirect?: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  const [opening, setOpening] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const openAppKit = async () => {
    if (!IS_WEB3_CONFIGURED || opening) return;
    setOpening(true);
    setError(null);
    try {
      const { ModalController } = await import("@reown/appkit-controllers");
      await ModalController.open({ view: "Connect" });
      setOpen(false);
    } catch {
      setError("WalletConnect could not open. Try a browser wallet below, or try again later.");
    } finally { setOpening(false); }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] overflow-y-auto overscroll-contain sm:max-w-md rounded-2xl border-border/60 bg-card p-4 shadow-2xl sm:p-6 [&>button]:right-2 [&>button]:top-2 [&>button]:flex [&>button]:size-11 [&>button]:items-center [&>button]:justify-center motion-reduce:animate-none">
        <DialogHeader className="pr-10 text-left">
          <DialogTitle className="text-lg">Connect a wallet</DialogTitle>
          <DialogDescription>
            Connect a browser wallet or use WalletConnect. Connecting alone does not authorize a payment.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-1">
          {/* Method 1 — All wallets via Reown AppKit */}
          {IS_WEB3_CONFIGURED ? (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Recommended
              </p>
              <button
                type="button"
                onClick={openAppKit}
                disabled={opening}
                className="group flex w-full items-center gap-3 rounded-xl border border-border/70 bg-muted/30 p-3.5 text-left hover:border-brand-accent/50 hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-60"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-accent/12 text-brand-accent">
                  {/* Reown / AppKit mark */}
                  <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none">
                    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
                    <path d="M7 12.5l2.2 2.2L17 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-semibold text-foreground">{opening ? 'Opening WalletConnect…' : 'WalletConnect · Reown'}</span>
                  <span className="block text-xs text-muted-foreground">600+ wallets · WalletConnect QR · social &amp; email</span>
                </span>
                <FiChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </button>
            </div>
          ) : <div className="rounded-xl border border-border bg-muted/30 p-4">
            <p className="text-sm font-medium">WalletConnect unavailable</p>
            <p className="mt-1 text-sm text-muted-foreground">QR and mobile-wallet connections are not configured for this deployment. A detected browser wallet can still connect below.</p>
          </div>}
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}

          {/* Method 2 — Direct, no Reown */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Browser wallets
            </p>
            <DirectWalletConnect authenticateOnConnect={authenticateDirect} onConnected={() => setOpen(false)} />
            <p className="mt-2 text-[11px] text-muted-foreground/70">
              Goes straight to your wallet — no third-party picker.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
