"use client";

import { useEffect, useRef } from "react";
import { useAccount, useChainId, useSwitchChain } from "wagmi";
import { useActiveNetwork } from "./ActiveNetworkContext";

/** Keeps EVM chain & ActiveNetwork in sync (two-way). */
export default function NetworkSyncBridge() {
  const { active, setActive } = useActiveNetwork();
  const walletChainId = useChainId();
  const { isConnected } = useAccount();
  const { switchChainAsync } = useSwitchChain();

  const lastApplied = useRef<number | null>(null);

  // If wallet chain changes (user switched in MetaMask/Coinbase), update ActiveNetwork.
  useEffect(() => {
    if (!isConnected) return;
    if (active.kind === "evm") {
      if (walletChainId && walletChainId !== active.chainId) {
        setActive({ kind: "evm", chainId: walletChainId });
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [walletChainId, isConnected]);

  // If app requests a different EVM chain, ask wallet to switch.
  useEffect(() => {
    if (!isConnected) return;
    if (active.kind !== "evm") return;

    const target = active.chainId;
    if (lastApplied.current === target) return;
    if (walletChainId === target) {
      lastApplied.current = target;
      return;
    }

    (async () => {
      try {
        await switchChainAsync({ chainId: target });
        lastApplied.current = target;
      } catch {
        // user rejected or chain not added – leave as-is
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, isConnected]);

  return null;
}
