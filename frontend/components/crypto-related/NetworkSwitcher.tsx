"use client";

import { useMemo, useState } from "react";
import { useAccount, useChainId, useSwitchChain, useChains } from "wagmi";

/**
 * Small helper that extracts a readable error message
 * from wagmi/BaseError without relying on missing TS types.
 */
function getErrMsg(err: unknown): string {
  if (err && typeof err === "object") {
    const anyErr = err as Record<string, unknown>;
    if (typeof anyErr.shortMessage === "string" && anyErr.shortMessage.trim()) {
      return anyErr.shortMessage;
    }
    if (typeof anyErr.message === "string" && anyErr.message.trim()) {
      return anyErr.message;
    }
  }
  return "Failed to switch network.";
}

export default function NetworkSwitcher() {
  const chains = useChains();
  const { isConnected } = useAccount();
  const activeChainId = useChainId();
  const { switchChain, status, error } = useSwitchChain();
  const [pendingId, setPendingId] = useState<number | null>(null);

  const opts = useMemo(
    () => chains.map((c) => ({ id: c.id, label: c.name })),
    [chains]
  );

  const onChange = (id: number) => {
    if (!isConnected) {
      // Let the user connect first; don’t auto-connect here
      setPendingId(null);
      return;
    }
    if (id === activeChainId) return;
    setPendingId(id);
    try {
      switchChain({ chainId: id });
    } catch {
      setPendingId(null);
    }
  };

  const disabled = status === "pending" || !isConnected;
  const errMsg = error ? getErrMsg(error) : "";

  return (
    <div className="inline-flex items-center gap-2">
      <label className="text-xs text-gray-500 dark:text-gray-400">Network</label>
      <select
        className="px-2 py-1 rounded border border-gray-300 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm"
        value={activeChainId ?? ""}
        onChange={(e) => onChange(Number(e.target.value))}
        disabled={disabled}
        title={!isConnected ? "Connect a wallet to switch networks" : undefined}
      >
        {opts.map((o) => {
          const showPending = pendingId === o.id && status === "pending";
          return (
            <option key={o.id} value={o.id}>
              {o.label}
              {showPending ? " (switching…)" : ""}
            </option>
          );
        })}
      </select>

      {error && (
        <span
          className="text-xs text-red-600 max-w-[240px] truncate"
          title={errMsg}
        >
          {errMsg}
        </span>
      )}
    </div>
  );
}
