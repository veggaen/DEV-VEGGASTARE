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
import type { ConfirmOptions } from "./confirm-dialog-types";
import { createConfirmController } from "./confirm-controller";

export type { ConfirmOptions };

type ConfirmFn = (opts: ConfirmOptions) => Promise<boolean>;

const ConfirmContext = React.createContext<ConfirmFn | null>(null);

export function ConfirmDialogProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false);
  const [opts, setOpts] = React.useState<ConfirmOptions | null>(null);

  // The promise/resolver lifecycle lives in a pure, unit-tested controller; the
  // provider just maps its onChange callback to React state. (controller is
  // created once — refs keep the latest setState without re-instantiating it.)
  const controllerRef = React.useRef<ReturnType<typeof createConfirmController> | null>(null);
  if (controllerRef.current === null) {
    controllerRef.current = createConfirmController((nextOpen, nextOpts) => {
      setOpen(nextOpen);
      if (nextOpts !== null) setOpts(nextOpts);
    });
  }
  const controller = controllerRef.current;

  const confirm = React.useCallback<ConfirmFn>(
    (options) => controller.open(options),
    [controller]
  );

  const settle = React.useCallback(
    (value: boolean) => controller.settle(value),
    [controller]
  );

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
