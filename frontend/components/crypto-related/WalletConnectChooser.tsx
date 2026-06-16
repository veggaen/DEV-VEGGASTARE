"use client";

/**
 * WalletConnectChooser — lets the user pick HOW they want to connect a wallet,
 * separating the two connection methods so people who don't want to touch Reown
 * have a clean direct path:
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
import { FiGlobe, FiChevronRight } from "react-icons/fi";
import { IS_WEB3_CONFIGURED } from "@/lib/web3-config";
import DirectWalletConnect from "./DirectWalletConnect";

export default function WalletConnectChooser({ children }: { children: React.ReactNode }) {
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
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Connect a wallet</DialogTitle>
          <DialogDescription>
            Choose how you&apos;d like to connect.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-1">
          {/* Method 1 — All wallets via Reown AppKit */}
          {IS_WEB3_CONFIGURED && (
            <div>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                All wallets
              </p>
              <button
                type="button"
                onClick={openAppKit}
                className="group flex w-full items-center gap-3 rounded-xl border border-border bg-card/50 p-3 text-left transition-colors hover:border-brand-accent/40 hover:bg-muted/50"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-accent/10 text-brand-accent">
                  <FiGlobe className="h-5 w-5" />
                </span>
                <span className="flex-1 min-w-0">
                  <span className="block text-sm font-medium text-foreground">600+ wallets, social & email</span>
                  <span className="block text-xs text-muted-foreground">WalletConnect, QR, and more — via AppKit</span>
                </span>
                <FiChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
              </button>
            </div>
          )}

          {/* Method 2 — Direct, no Reown */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Connect directly
            </p>
            <DirectWalletConnect />
            <p className="mt-2 text-[11px] text-muted-foreground/70">
              Connects your wallet straight away — no third-party modal.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
