"use client";

/**
 * AppKitSignInBridge — invisible. Watches the wagmi account and, when a wallet
 * connects via the AppKit (Reown) modal WHILE THE USER IS LOGGED OUT, runs the
 * shared SIWE sign-in so the AppKit path authenticates into the app too (not
 * just a browser connection).
 *
 * Guards:
 *  - Only fires when the NextAuth session is `unauthenticated` (a logged-in user
 *    connecting a wallet is LINKING, handled elsewhere — we must not hijack it).
 *  - One attempt per fresh connection (tracks the last address we tried).
 *  - Mounted only on auth surfaces (login/register) so it never interferes with
 *    in-app wallet usage.
 */

import * as React from "react";
import { useAccount } from "wagmi";
import { useSession } from "next-auth/react";
import { useWalletSignIn } from "@/hooks/use-wallet-sign-in";

export default function AppKitSignInBridge({ callbackUrl = "/products" }: { callbackUrl?: string }) {
  const { address, isConnected } = useAccount();
  const { status } = useSession();
  const { signInWithAddress } = useWalletSignIn(callbackUrl);
  const triedRef = React.useRef<string | null>(null);
  // Snapshot whether a wallet was ALREADY connected on mount — we must only
  // auto-sign on a FRESH connection (disconnected → connected this session),
  // never silently prompt a signature for a wallet left connected from before.
  const wasConnectedOnMount = React.useRef<boolean | null>(null);

  React.useEffect(() => {
    if (wasConnectedOnMount.current === null) {
      wasConnectedOnMount.current = isConnected;
      if (isConnected && address) triedRef.current = address; // don't fire for pre-existing
    }
  }, [isConnected, address]);

  React.useEffect(() => {
    if (status !== "unauthenticated") return; // never hijack a logged-in (linking) flow
    if (!isConnected || !address) return;
    if (wasConnectedOnMount.current) return; // was already connected before this page — ignore
    if (triedRef.current === address) return; // one attempt per fresh address
    triedRef.current = address;
    void signInWithAddress(address);
  }, [isConnected, address, status, signInWithAddress]);

  return null;
}
