"use client";

/**
 * @fileOverview  The per-stack progress list shown while stacks move: wallet
 *                prompt → confirming → confirmed, with the explorer link as
 *                soon as there is a hash. Shared by the Send dialog and the
 *                trade window.
 * @stability     evolving
 */

import { FiAlertCircle, FiCheckCircle, FiCircle, FiExternalLink, FiLoader } from "react-icons/fi";
import type { SendStep } from "@/lib/send-stacks";
import { cn } from "@/lib/utils";

const LABEL: Record<SendStep["status"], string> = {
  queued: "Waiting",
  wallet: "Confirm in your wallet",
  pending: "Confirming on-chain…",
  confirmed: "Confirmed",
  failed: "Failed",
};

export function SendProgress({ steps, className }: { steps: SendStep[]; className?: string }) {
  if (!steps.length) return null;
  return (
    <ol className={cn("space-y-1", className)} aria-live="polite" aria-label="Transfer progress">
      {steps.map((step) => (
        <li key={step.key} className="flex items-start gap-2 rounded-lg border border-border/60 bg-foreground/[0.03] px-2.5 py-1.5 text-[11px]">
          <span className="mt-px shrink-0" aria-hidden="true">
            {step.status === "confirmed" && <FiCheckCircle className="h-3.5 w-3.5 text-brand-accent-hover dark:text-brand-accent-light" />}
            {step.status === "failed" && <FiAlertCircle className="h-3.5 w-3.5 text-red-600 dark:text-red-400" />}
            {(step.status === "wallet" || step.status === "pending") && <FiLoader className="h-3.5 w-3.5 text-amber-600 motion-safe:animate-spin dark:text-amber-400" />}
            {step.status === "queued" && <FiCircle className="h-3.5 w-3.5 text-muted-foreground/60" />}
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center justify-between gap-2">
              <span className="truncate font-semibold text-foreground">{step.amount} {step.symbol}</span>
              <span className={cn("shrink-0", step.status === "failed" ? "text-red-600 dark:text-red-400" : step.status === "confirmed" ? "text-brand-accent-hover dark:text-brand-accent-light" : "text-muted-foreground")}>{LABEL[step.status]}</span>
            </span>
            {step.error && <span className="mt-0.5 block text-red-600 dark:text-red-400">{step.error}</span>}
            {step.hash && (
              step.explorerUrl ? (
                <a href={step.explorerUrl} target="_blank" rel="noopener noreferrer" className="mt-0.5 inline-flex items-center gap-1 font-mono text-[10px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">
                  {step.hash.slice(0, 10)}…{step.hash.slice(-6)} <FiExternalLink className="h-2.5 w-2.5" aria-hidden="true" />
                </a>
              ) : (
                <span className="mt-0.5 block font-mono text-[10px] text-muted-foreground">{step.hash.slice(0, 10)}…{step.hash.slice(-6)}</span>
              )
            )}
          </span>
        </li>
      ))}
    </ol>
  );
}
