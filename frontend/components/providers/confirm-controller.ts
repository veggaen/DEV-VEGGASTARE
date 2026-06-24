/**
 * Framework-agnostic coordination for a single-instance confirm dialog.
 *
 * The tricky, bug-prone part of a promise-based confirm() is the resolver
 * lifecycle: open() must return a promise that settles exactly once on the next
 * confirm/cancel, a second open() while one is pending must not strand the first
 * promise forever, and settling twice must be a no-op. That logic lives here as
 * a plain object so it can be unit-tested without rendering React — the provider
 * just maps onOpen→state and confirm/cancel→settle.
 */
import type { ConfirmOptions } from "./confirm-dialog-types";

export type ConfirmController = {
  /** Open the dialog with options; resolves true (confirm) or false (cancel). */
  open: (opts: ConfirmOptions) => Promise<boolean>;
  /** Settle the pending request. No-op if nothing is pending. */
  settle: (value: boolean) => void;
  /** Whether a request is currently awaiting an answer. */
  isPending: () => boolean;
};

export function createConfirmController(
  onChange: (open: boolean, opts: ConfirmOptions | null) => void
): ConfirmController {
  let resolver: ((value: boolean) => void) | null = null;

  const open: ConfirmController["open"] = (opts) => {
    // If a request is already pending, resolve the stale one as cancelled so its
    // awaiter never hangs, then start fresh.
    if (resolver) {
      resolver(false);
      resolver = null;
    }
    onChange(true, opts);
    return new Promise<boolean>((resolve) => {
      resolver = resolve;
    });
  };

  const settle: ConfirmController["settle"] = (value) => {
    if (!resolver) return; // already settled or never opened — no-op
    const r = resolver;
    resolver = null;
    onChange(false, null);
    r(value);
  };

  const isPending: ConfirmController["isPending"] = () => resolver !== null;

  return { open, settle, isPending };
}
