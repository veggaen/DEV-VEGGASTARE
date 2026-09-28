"use client";

import { useEffect, useRef } from "react";
import { useAccount, useChainId, useSwitchChain } from "wagmi";
import { useActiveNetwork } from "./ActiveNetworkContext";

/**
 * Keeps the wallet's EVM chain and the app's ActiveNetwork in sync, two ways.
 * One effect decides who moved: when the wallet's chain changed (or a
 * connection just appeared) the app follows the wallet; when the app's chain
 * changed (the user picked a network in the UI) the wallet is asked to follow.
 * Two separate effects used to fight each other on first connect: a wallet on
 * PulseChain and a remembered Ethereum switched each other back and forth.
 */
export default function NetworkSyncBridge() {
  const { active, setActive, isHydrated } = useActiveNetwork();
  const walletChainId = useChainId();
  const { isConnected } = useAccount();
  const { switchChainAsync } = useSwitchChain();

  const lastActive = useRef<number | null>(null);
  const lastWallet = useRef<number | null>(null);

  useEffect(() => {
    if (!isHydrated || !isConnected || active.kind !== "evm") {
      lastActive.current = null;
      lastWallet.current = null;
      return;
    }
    const target = active.chainId;
    const wallet = walletChainId || null;
    const first = lastActive.current === null;
    const walletMoved = wallet !== lastWallet.current;
    const appMoved = target !== lastActive.current;
    lastActive.current = target;
    lastWallet.current = wallet;
    if (!wallet || wallet === target) return;

    if (first || walletMoved || !appMoved) {
      // The wallet is the source of truth on first sight and whenever it moved on its own.
      setActive({ kind: "evm", chainId: wallet });
      return;
    }

    // The user changed the network in the app: ask the wallet to follow.
    (async () => {
      try {
        await switchChainAsync({ chainId: target });
      } catch {
        // Rejected or chain not added: the wallet stayed put, so the app follows it back.
        setActive({ kind: "evm", chainId: wallet });
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, walletChainId, isConnected, isHydrated]);

  return null;
}
