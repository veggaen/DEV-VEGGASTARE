/**
 * @fileOverview useWalletTransfer — send native token between linked wallets.
 *
 * Flow:
 *   idle → sending (wallet prompt) → confirming (on-chain) → success | error
 *
 * @stability experimental
 */
"use client";

import { useCallback, useRef, useState } from "react";
import { usePublicClient, useWalletClient } from "wagmi";
import { parseUnits, type Hash } from "viem";

export type WalletTransferStep = "idle" | "sending" | "confirming" | "success" | "error";

export interface StartWalletTransferInput {
  destinationAddress: `0x${string}`;
  amountNative: string;
}

export function useWalletTransfer() {
  const [step, setStep] = useState<WalletTransferStep>("idle");
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const busyRef = useRef(false);

  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();

  const transfer = useCallback(async (input: StartWalletTransferInput) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setError(null);
    setTxHash(null);

    try {
      if (!walletClient || !publicClient) {
        throw new Error("Wallet not connected — activate source wallet and try again");
      }

      const value = parseUnits(input.amountNative, 18);
      if (value <= BigInt(0)) {
        throw new Error("Enter an amount greater than 0");
      }

      setStep("sending");

      let hash: Hash;
      try {
        hash = await walletClient.sendTransaction({
          to: input.destinationAddress,
          value,
        });
      } catch (sendErr: unknown) {
        if (
          sendErr instanceof Error &&
          (sendErr.message.includes("User rejected") ||
            sendErr.message.includes("User denied") ||
            sendErr.message.includes("rejected"))
        ) {
          setStep("error");
          setError("Transaction rejected in wallet");
          return;
        }
        throw sendErr;
      }

      setTxHash(hash);
      setStep("confirming");

      const receipt = await publicClient.waitForTransactionReceipt({
        hash,
        confirmations: 1,
        timeout: 120_000,
      });

      if (receipt.status === "reverted") {
        setStep("error");
        setError("Transaction reverted on-chain");
        return;
      }

      setStep("success");
    } catch (err: unknown) {
      console.error("[use-wallet-transfer] Error:", err);
      setStep("error");
      setError(err instanceof Error ? err.message : "Transfer failed");
    } finally {
      busyRef.current = false;
    }
  }, [walletClient, publicClient]);

  const reset = useCallback(() => {
    setStep("idle");
    setError(null);
    setTxHash(null);
    busyRef.current = false;
  }, []);

  return { step, error, txHash, transfer, reset };
}
