"use client";

/**
 * @fileOverview  DEPRECATED — This context is replaced by trade-mode-context.tsx.
 *               Kept as a thin shim for backwards compatibility.
 *               Use `useTradeMode()` from `@/contexts/trade-mode-context` instead.
 * @stability     deprecated
 */

export {
  TradeModeProvider as PaperModeProvider,
  useTradeMode as usePaperMode,
} from "./trade-mode-context";
