"use client";

import * as React from "react";
import { useSignMessage } from "wagmi";
import { signIn } from "next-auth/react";
import { toast } from "sonner";

/**
 * Shared Sign-In-With-Ethereum → NextAuth flow, used by BOTH the direct-connect
 * buttons and the AppKit (Reown) connect path so there's exactly one
 * implementation:
 *
 *   fetch nonce → wallet signs it → signIn('wallet') → land logged in.
 *
 * On success the user logs into the wallet's linked account, or a low-reach
 * WALLET_ONLY account is created server-side (auth.config.ts).
 */
// MODULE-LEVEL guard — shared across ALL hook instances. Critical because
// DirectWalletConnect and AppKitSignInBridge each call this hook separately; a
// per-instance ref wouldn't stop a direct-button click AND the AppKit bridge
// (reacting to the same wagmi connection) from both firing the flow.
let globalInFlight = false;

export function useWalletSignIn(callbackUrl = "/products") {
  const { signMessageAsync } = useSignMessage();
  const [signingIn, setSigningIn] = React.useState(false);

  const signInWithAddress = React.useCallback(
    async (address: string): Promise<boolean> => {
      if (globalInFlight) return false;
      globalInFlight = true;
      setSigningIn(true);
      try {
        const res = await fetch("/api/auth/wallet/nonce", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ address }),
        });
        if (!res.ok) throw new Error("Could not start wallet sign-in");
        const { message } = (await res.json()) as { message: string };

        toast.loading("Sign the message in your wallet…", { id: "wallet-auth" });
        const signature = await signMessageAsync({ message });

        const result = await signIn("wallet", {
          address,
          signature,
          redirect: false,
          callbackUrl,
        });
        if (result?.error) throw new Error("Wallet sign-in failed");

        toast.success("Signed in with your wallet", { id: "wallet-auth" });
        window.location.href = callbackUrl;
        return true;
      } catch (e) {
        const msg = (e as Error)?.message ?? "";
        // User rejecting the signature is not an error worth shouting about.
        const rejected = /reject|denied|cancel/i.test(msg);
        toast.error(rejected ? "Signature cancelled" : msg.slice(0, 120) || "Wallet sign-in failed", {
          id: "wallet-auth",
        });
        return false;
      } finally {
        globalInFlight = false;
        setSigningIn(false);
      }
    },
    [signMessageAsync, callbackUrl]
  );

  return { signInWithAddress, signingIn };
}
