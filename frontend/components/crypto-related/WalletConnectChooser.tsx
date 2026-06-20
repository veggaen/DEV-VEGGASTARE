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

  const openAppKit = async () => {
    try {
      const { ModalController } = await import("@reown/appkit-controllers");
      ModalController.open({ view: "Connect" });
      setOpen(false);
      setTimeout(() => {
        const isOpen = (ModalController as unknown as { state?: { open?: boolean } })?.state?.open;
        if (!isOpen) {
          import("sonner").then(({ toast }) =>
            toast.error("Wallet connect is still loading — try again in a moment.")
          );
        }
      }, 600);
    } catch {
      import("sonner").then(({ toast }) =>
        toast.error("Wallet connect unavailable right now.")
      );
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-md rounded-2xl border-border/60 bg-card shadow-2xl">
        <DialogHeader>
          <DialogTitle className="text-lg">Connect a wallet</DialogTitle>
          <DialogDescription>
            Pick how you want to connect — the full picker, or your wallet directly.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-1">
          {/* Method 1 — All wallets via Reown AppKit */}
          {IS_WEB3_CONFIGURED && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Recommended
              </p>
              <button
                type="button"
                onClick={openAppKit}
                className="group flex w-full items-center gap-3 rounded-xl border border-border/70 bg-muted/30 p-3.5 text-left transition-all hover:border-brand-accent/50 hover:bg-muted/60 active:scale-[0.99]"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-accent/12 text-brand-accent">
                  {/* Reown / AppKit mark */}
                  <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none">
                    <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" />
                    <path d="M7 12.5l2.2 2.2L17 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-semibold text-foreground">Reown AppKit</span>
                  <span className="block text-xs text-muted-foreground">600+ wallets · WalletConnect QR · social &amp; email</span>
                </span>
                <FiChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </button>
            </div>
          )}

          {/* Method 2 — Direct, no Reown */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Or connect directly
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
