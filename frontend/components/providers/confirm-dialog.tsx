"use client";

/**
 * Branded, promise-based confirmation dialog — a drop-in replacement for the
 * native window.confirm(), which is blocking, unstyled and off-brand.
 *
 * Usage:
 *   const confirm = useConfirm();
 *   if (!(await confirm({ title: "Delete this conversation?", confirmLabel: "Delete", destructive: true }))) return;
 *   // ...proceed
 *
 * The provider is mounted once (in AppProviders); a single dialog instance is
 * reused, so there's no per-call-site dialog state to manage. Resolving the
 * promise on confirm/cancel keeps call sites as terse as the native confirm().
 */

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

export type ConfirmOptions = {
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Style the confirm button as destructive (red). Defaults to false. */
  destructive?: boolean;
};

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = React.createContext<ConfirmFn | null>(null);

export function ConfirmDialogProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const [opts, setOpts] = React.useState<ConfirmOptions | null>(null);
  // Hold the active promise's resolver so confirm/cancel can settle it.
  const resolverRef = React.useRef<((value: boolean) => void) | null>(null);

  const confirm = React.useCallback<ConfirmFn>((options) => {
    setOpts(options);
    setOpen(true);
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
    });
  }, []);

  const settle = React.useCallback((value: boolean) => {
    resolverRef.current?.(value);
    resolverRef.current = null;
    setOpen(false);
  }, []);

  // Radix calls onOpenChange(false) on overlay click / Esc — treat as cancel.
  const handleOpenChange = React.useCallback(
    (next: boolean) => {
      if (!next) settle(false);
      else setOpen(true);
    },
    [settle]
  );

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="max-w-sm" hideCloseButton>
          <DialogHeader>
            <DialogTitle>{opts?.title ?? "Are you sure?"}</DialogTitle>
            {opts?.description && (
              <DialogDescription>{opts.description}</DialogDescription>
            )}
          </DialogHeader>
          <DialogFooter className="mt-2 gap-2 sm:gap-2">
            <Button variant="outline" onClick={() => settle(false)}>
              {opts?.cancelLabel ?? "Cancel"}
            </Button>
            <Button
              variant={opts?.destructive ? "destructive" : "default"}
              onClick={() => settle(true)}
              autoFocus
            >
              {opts?.confirmLabel ?? "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ConfirmContext.Provider>
  );
}

/**
 * Returns a `confirm(opts)` function that resolves to true/false. If the provider
 * is somehow absent, falls back to the native confirm so callers never break.
 */
export function useConfirm(): ConfirmFn {
  const ctx = React.useContext(ConfirmContext);
  return React.useMemo<ConfirmFn>(() => {
    if (ctx) return ctx;
    return (opts) =>
      Promise.resolve(
        typeof window !== "undefined"
          ? window.confirm(opts.description ? `${opts.title}\n\n${opts.description}` : opts.title)
          : false
      );
  }, [ctx]);
}
