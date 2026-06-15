/**
 * @fileOverview useDonate — hook for sending on-chain donations to the VeggaSystem wallet.
 *
 * Drives the flow:
 *   idle → sending (wallet prompt) → confirming (on-chain) → recording (API) → success | error
 *
 * Supports EVM (ETH, PLS) via wagmi + viem.
 * Solana support is scaffolded but disabled until tested.
 *
 * After a successful donation, the backend increments
 * `Wallet.donationTotalUsd` and recalculates the user's verification tier.
 *
 * @stability experimental
 */
"use client";

import { useCallback, useRef, useState } from "react";
import { useWalletClient, usePublicClient, useConnections } from "wagmi";
import { parseUnits, type Hash } from "viem";
import { VEGGA_SYSTEM } from "@/lib/vegga-system-constants";
import {
  WALLET_BUFF_TIERS,
  resolveWalletTier,
  getNextTier,
  type WalletBuffTier,
} from "@/lib/wallet-buff-tiers";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export type DonateStep =
  | "idle"
  /** Wallet prompt is open — user is confirming the transaction */
  | "sending"
  /** Transaction submitted, waiting for on-chain confirmation */
  | "confirming"
  /** Recording donation on the backend */
  | "recording"
  /** Donation succeeded */
  | "success"
  /** Something went wrong */
  | "error";

export interface UseDonateReturn {
  step: DonateStep;
  error: string | null;
  txHash: string | null;
  /** Start a donation of `amountUsd` worth of native token */
  donate: (opts: DonateOpts) => Promise<void>;
  /** Reset to idle */
  reset: () => void;
}

export interface DonateOpts {
  /** The DB wallet ID */
  walletId: string;
  /** Wallet address (checksummed) */
  address: string;
  /** Chain ID (1=Ethereum, 369=PulseChain, etc.) */
  chainId: number;
  /** USD amount to donate */
  amountUsd: number;
  /** Price of 1 native token in USD (from PricingContext) */
  nativeUsdPrice: number;
  /** Native token symbol */
  tokenSymbol: string;
  /** wagmi connector UID to ensure the right wallet signs */
  connectorUid?: string;
}

/* ------------------------------------------------------------------ */
/*  Hook                                                               */
/* ------------------------------------------------------------------ */

export function useDonate({
  onSuccess,
}: {
  onSuccess?: () => void;
} = {}): UseDonateReturn {
  const [step, setStep] = useState<DonateStep>("idle");
  const [error, setError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const busyRef = useRef(false);

  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  const connections = useConnections();
  const connectionsRef = useRef(connections);
  connectionsRef.current = connections;

  const donate = useCallback(
    async (opts: DonateOpts) => {
      if (busyRef.current) return;
      busyRef.current = true;
      setError(null);
      setTxHash(null);

      const {
        walletId,
        address,
        chainId,
        amountUsd,
        nativeUsdPrice,
        tokenSymbol,
        connectorUid,
      } = opts;

      try {
        // Validate
        if (!walletClient || !publicClient) {
          throw new Error("Wallet not connected — reconnect and try again");
        }
        if (nativeUsdPrice <= 0) {
          throw new Error("Unable to fetch token price — try again");
        }

        // Calculate native amount from USD
        const nativeAmount = amountUsd / nativeUsdPrice;
        // ETH & PLS use 18 decimals
        const value = parseUnits(nativeAmount.toFixed(18), 18);
        const receiverAddress = VEGGA_SYSTEM.wallets.evm as `0x${string}`;

        // ── 1. Send transaction ──────────────────────────────────
        setStep("sending");

        let hash: Hash;
        try {
          hash = await walletClient.sendTransaction({
            to: receiverAddress,
            value,
            // Let the wallet estimate gas automatically
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

        // ── 2. Wait for on-chain confirmation ────────────────────
        setStep("confirming");

        const receipt = await publicClient.waitForTransactionReceipt({
          hash,
          confirmations: 1,
          timeout: 120_000, // 2 min timeout
        });

        if (receipt.status === "reverted") {
          setStep("error");
          setError("Transaction reverted on-chain");
          return;
        }

        // ── 3. Record donation on backend ────────────────────────
        setStep("recording");

        const res = await fetch("/api/wallets/donate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            walletId,
            txHash: hash,
            nativeAmount: nativeAmount.toFixed(18),
            amountUsd,
            chainFamily: "EVM",
            chainId,
            tokenSymbol,
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          // 409 = duplicate tx — user already recorded this donation
          if (res.status === 409) {
            setStep("success");
            onSuccess?.();
            return;
          }
          throw new Error(data.error ?? `Failed (${res.status})`);
        }

        // ── 4. Done! ────────────────────────────────────────────
        setStep("success");
        onSuccess?.();
      } catch (err: unknown) {
        console.error("[use-donate] Error:", err);
        setStep("error");
        setError(err instanceof Error ? err.message : "Something went wrong");
      } finally {
        busyRef.current = false;
      }
    },
    [walletClient, publicClient, onSuccess],
  );

  const reset = useCallback(() => {
    setStep("idle");
    setError(null);
    setTxHash(null);
    busyRef.current = false;
  }, []);

  return { step, error, txHash, donate, reset };
}

/* ------------------------------------------------------------------ */
/*  Helpers — compute next-tier donation info for UI                    */
/* ------------------------------------------------------------------ */

/** Given current wallet state, compute the next donation tier info */
export function getNextDonationInfo(
  verified: boolean,
  donationTotalUsd: number,
): {
  currentTier: WalletBuffTier;
  nextTier: WalletBuffTier | null;
  nextLabel: string | null;
  nextMinUsd: number;
  remainingUsd: number;
} | null {
  const currentTier = resolveWalletTier(verified, donationTotalUsd);
  const next = getNextTier(currentTier);

  if (!next || next.nextCta === "Max tier reached") return null;

  return {
    currentTier,
    nextTier: next.tier,
    nextLabel: next.label,
    nextMinUsd: next.minDonationUsd,
    remainingUsd: Math.max(0, next.minDonationUsd - donationTotalUsd),
  };
}
