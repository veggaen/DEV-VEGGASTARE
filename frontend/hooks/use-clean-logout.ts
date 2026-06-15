"use client";

import { useCallback, useRef } from "react";
import { signOut } from "next-auth/react";
import { useDisconnect } from "wagmi";
import { useWallet as useSolWallet } from "@solana/wallet-adapter-react";
import { toast } from "sonner";

/**
 * Module-level flag so WalletDisconnectWatcher (in Web3Providers) can
 * distinguish "our own logout flow disconnected the wallet" from
 * "user disconnected the wallet manually".
 */
export let cleanLogoutInProgress = false;

/**
 * useCleanLogout — Disconnects all wallets, clears local crypto state,
 * then signs out via NextAuth. Prevents double-fire.
 */
export function useCleanLogout() {
  const { disconnectAsync: evmDisconnect } = useDisconnect();
  const { disconnect: solDisconnect, connected: solConnected } = useSolWallet();
  const busyRef = useRef(false);

  const cleanLogout = useCallback(async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    cleanLogoutInProgress = true;

    try {
      // 1. Disconnect EVM wallet (wagmi + AppKit)
      try {
        await evmDisconnect();
      } catch {
        // swallow — user may not have an EVM wallet connected
      }

      // 2. Disconnect Solana wallet
      if (solConnected) {
        try {
          await solDisconnect();
        } catch {
          // swallow — user may not have a Solana wallet connected
        }
      }

      // 3. Clear wallet brand hints + AppKit state from localStorage
      try {
        localStorage.removeItem("veggastare:evm.brand");
        localStorage.removeItem("veggastare:sol.brand");
        localStorage.removeItem("fs.activeNetwork");
        // Clear wallet registry from sessionStorage (transient wallet cards)
        sessionStorage.removeItem("veggat_wallet_registry");
        // Clear any AppKit/Reown social login cached state
        const keysToRemove: string[] = [];
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i);
          if (
            key &&
            (key.startsWith("W3M_") ||
              key.startsWith("w3m") ||
              key.startsWith("@w3m") ||
              key.startsWith("wc@") ||
              key.startsWith("wagmi") ||
              key.startsWith("-walletlink"))
          ) {
            keysToRemove.push(key);
          }
        }
        keysToRemove.forEach((k) => localStorage.removeItem(k));
        // Clear bridge flags from sessionStorage
        for (let i = sessionStorage.length - 1; i >= 0; i--) {
          const key = sessionStorage.key(i);
          if (key?.startsWith("veggat_oauth_bridge_")) {
            sessionStorage.removeItem(key);
          }
        }
      } catch {
        // localStorage may be unavailable
      }

      // 4. Sign out via NextAuth (server redirect)
      await signOut({ callbackUrl: "/auth/login" });
    } catch (err) {
      console.error("[cleanLogout] Error during logout:", err);
      toast.error("Something went wrong during sign out");
      // Force signOut even if wallet disconnect failed
      try {
        await signOut({ callbackUrl: "/auth/login" });
      } catch {
        // last resort
        window.location.href = "/auth/login";
      }
    } finally {
      busyRef.current = false;
      cleanLogoutInProgress = false;
    }
  }, [evmDisconnect, solDisconnect, solConnected]);

  return cleanLogout;
}
