"use client";

import { useCallback, useRef } from "react";
import { signOut } from "next-auth/react";
import { useDisconnect } from "wagmi";
import { useWallet as useSolWallet } from "@solana/wallet-adapter-react";
import { toast } from "sonner";

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

      // 3. Clear wallet brand hints from localStorage
      try {
        localStorage.removeItem("veggastare:evm.brand");
        localStorage.removeItem("veggastare:sol.brand");
        localStorage.removeItem("fs.activeNetwork");
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
    }
  }, [evmDisconnect, solDisconnect, solConnected]);

  return cleanLogout;
}
