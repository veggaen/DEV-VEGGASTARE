/**
 * @fileOverview  useDexSwap — hook for executing DEX swaps via KyberSwap Aggregator.
 *
 *  Two modes:
 *      1. **Quote mode** — get a price estimate (no wallet needed)
 *      2. **Execute mode** — sign and send via the connected wallet
 *
 *  Flow: idle → quoting → quoted → approving → sending → confirming → success | error
 *
 * @stability experimental
 */
"use client";

import { useCallback, useRef, useState } from "react";
import { usePublicClient, useWalletClient, useAccount } from "wagmi";
import {
  parseUnits,
  encodeFunctionData,
  type Hash,
  type Address,
  erc20Abi,
  maxUint256,
} from "viem";

// ── Types ───────────────────────────────────────────────────────────────────

export type DexSwapStep =
  | "idle"
  | "quoting"
  | "quoted"
  | "approving"
  | "sending"
  | "confirming"
  | "success"
  | "error";

export interface DexSwapQuoteInput {
  chainId: number;
  sellToken: string;  // address
  buyToken: string;   // address
  sellAmount: string; // raw units (wei)
  taker?: string;     // optional for price-only
  slippageBps?: number;
}

export interface DexSwapExecuteInput extends DexSwapQuoteInput {
  taker: string; // required for execution
}

export interface DexQuoteResult {
  buyAmount: string;
  sellAmount: string;
  price: string;
  estimatedGas: string;
  sources: Array<{ name: string; proportion: string }>;
  estimatedPriceImpact: string | null;
}

export interface DexSwapResult {
  txHash: string;
  buyAmount: string;
  sellAmount: string;
}

// ── Hook ────────────────────────────────────────────────────────────────────

export function useDexSwap() {
  const [step, setStep] = useState<DexSwapStep>("idle");
  const [error, setError] = useState<string | null>(null);
  const [quote, setQuote] = useState<DexQuoteResult | null>(null);
  const [result, setResult] = useState<DexSwapResult | null>(null);
  const busyRef = useRef(false);

  const { address } = useAccount();
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();

  // ── 1. Get quote (no wallet needed) ─────────────────────────────────────
  const getQuote = useCallback(
    async (input: DexSwapQuoteInput): Promise<DexQuoteResult | null> => {
      if (busyRef.current) return null;
      busyRef.current = true;
      setError(null);
      setQuote(null);
      setResult(null);
      setStep("quoting");

      try {
        const res = await fetch("/api/dex/quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...input,
            mode: "price",
          }),
        });

        if (!res.ok) {
          const body = await res.json().catch(() => null) as { error?: string } | null;
          const msg = body?.error ?? `HTTP ${res.status}`;
          if (res.status === 401) throw new Error("Session expired — please refresh the page");
          throw new Error(msg);
        }

        const data = (await res.json()) as DexQuoteResult;
        setQuote(data);
        setStep("quoted");
        return data;
      } catch (err) {
        console.error("[useDexSwap] Quote error:", err);
        setStep("error");
        setError(err instanceof Error ? err.message : "Quote failed");
        return null;
      } finally {
        busyRef.current = false;
      }
    },
    [],
  );

  // ── 2. Execute swap (wallet required) ────────────────────────────────────
  const executeSwap = useCallback(
    async (input: DexSwapExecuteInput) => {
      if (busyRef.current) return;
      busyRef.current = true;
      setError(null);
      setResult(null);

      try {
        if (!walletClient || !publicClient) {
          throw new Error("Connect your wallet first");
        }

        if (!address) {
          throw new Error("No wallet address");
        }

        // Step 1: Get a firm quote with transaction data
        setStep("quoting");
        const quoteRes = await fetch("/api/dex/quote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...input,
            taker: address,
            mode: "quote",
          }),
        });

        if (!quoteRes.ok) {
          const body = await quoteRes.json().catch(() => null) as { error?: string } | null;
          const msg = body?.error ?? `HTTP ${quoteRes.status}`;
          if (quoteRes.status === 401) throw new Error("Session expired — please refresh the page");
          throw new Error(msg);
        }

        const quoteData = await quoteRes.json() as {
          buyAmount: string;
          sellAmount: string;
          price: string;
          estimatedGas: string;
          sources: Array<{ name: string; proportion: string }>;
          estimatedPriceImpact: string | null;
          sellAmountUsd?: string;
          buyAmountUsd?: string;
          provider?: string;
          transaction: {
            to: string;
            data: string;
            value: string;
            gas: string;
          };
          /** KyberSwap router address — used as approval target */
          allowanceTarget?: string;
        };

        setQuote({
          buyAmount: quoteData.buyAmount,
          sellAmount: quoteData.sellAmount,
          price: quoteData.price,
          estimatedGas: quoteData.estimatedGas,
          sources: quoteData.sources,
          estimatedPriceImpact: quoteData.estimatedPriceImpact,
        });

        // Step 2: Handle token approval if needed
        const NATIVE = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE".toLowerCase();
        const isNativeSell = input.sellToken.toLowerCase() === NATIVE;

        if (!isNativeSell && quoteData.allowanceTarget) {
          const spender = quoteData.allowanceTarget as Address;

          // Check current on-chain allowance
          const currentAllowance = await publicClient.readContract({
            address: input.sellToken as Address,
            abi: erc20Abi,
            functionName: "allowance",
            args: [address as Address, spender],
          });

          if (currentAllowance < BigInt(input.sellAmount)) {
            setStep("approving");

            try {
              const approveHash = await walletClient.writeContract({
                address: input.sellToken as Address,
                abi: erc20Abi,
                functionName: "approve",
                args: [spender, maxUint256],
              });

              await publicClient.waitForTransactionReceipt({
                hash: approveHash,
                confirmations: 1,
                timeout: 60_000,
              });
            } catch (approveErr: unknown) {
              if (
                approveErr instanceof Error &&
                approveErr.message.includes("User rejected")
              ) {
                throw new Error("Approval rejected in wallet");
              }
              throw approveErr;
            }
          }
        }

        // Step 3: Send the swap transaction
        setStep("sending");
        let hash: Hash;
        try {
          hash = await walletClient.sendTransaction({
            to: quoteData.transaction.to as Address,
            data: quoteData.transaction.data as `0x${string}`,
            value: BigInt(quoteData.transaction.value || "0"),
            gas: quoteData.transaction.gas
              ? BigInt(quoteData.transaction.gas)
              : undefined,
          });
        } catch (sendErr: unknown) {
          if (
            sendErr instanceof Error &&
            (sendErr.message.includes("User rejected") ||
              sendErr.message.includes("User denied") ||
              sendErr.message.includes("rejected"))
          ) {
            throw new Error("Transaction rejected in wallet");
          }
          throw sendErr;
        }

        // Step 4: Wait for confirmation
        setStep("confirming");
        const receipt = await publicClient.waitForTransactionReceipt({
          hash,
          confirmations: 1,
          timeout: 120_000,
        });

        if (receipt.status === "reverted") {
          throw new Error("Transaction reverted on-chain");
        }

        setResult({
          txHash: hash,
          buyAmount: quoteData.buyAmount,
          sellAmount: quoteData.sellAmount,
        });
        setStep("success");
      } catch (err: unknown) {
        console.error("[useDexSwap] Swap error:", err);
        setStep("error");
        setError(err instanceof Error ? err.message : "Swap failed");
      } finally {
        busyRef.current = false;
      }
    },
    [address, walletClient, publicClient],
  );

  // ── Reset state ───────────────────────────────────────────────────────────
  const reset = useCallback(() => {
    setStep("idle");
    setError(null);
    setQuote(null);
    setResult(null);
    busyRef.current = false;
  }, []);

  return {
    step,
    error,
    quote,
    result,
    getQuote,
    executeSwap,
    reset,
    isLoading: step === "quoting" || step === "approving" || step === "sending" || step === "confirming",
  };
}
