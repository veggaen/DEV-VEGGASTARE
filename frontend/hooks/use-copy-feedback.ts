/**
 * @fileOverview Reusable hook for clipboard copy with animated feedback state.
 * Returns `{ copied, copy }` — `copied` is true for a short duration after
 * a successful copy, then auto-resets. Consumers render the UI (tooltip,
 * checkmark, etc.) based on the `copied` flag.
 *
 * @stability stable
 */
"use client";

import { useState, useCallback, useRef } from "react";

interface UseCopyFeedbackOptions {
  /** Duration (ms) the "copied" state stays true. Default: 1800 */
  duration?: number;
  /** Optional callback after a successful copy */
  onCopy?: () => void;
}

export function useCopyFeedback(opts: UseCopyFeedbackOptions = {}) {
  const { duration = 1800, onCopy } = opts;
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const copy = useCallback(
    async (text: string) => {
      try {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        onCopy?.();

        // Clear any previous timer
        if (timerRef.current) clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => setCopied(false), duration);
        return true;
      } catch {
        return false;
      }
    },
    [duration, onCopy],
  );

  return { copied, copy } as const;
}
