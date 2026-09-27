"use client";

/**
 * @fileOverview  Send one or more stacks from a connected wallet, through that
 *                wallet's own extension: one prompt per stack, then a wait for
 *                the receipt. Used by the inventory Send dialog, the internal
 *                transfer and P2P settlement, so every path that moves real
 *                tokens is the same code. Nothing here ever fakes a result: a
 *                step is "confirmed" only after a successful receipt.
 * @stability     evolving
 */

import { useCallback, useRef, useState } from "react";
import { useConfig, useConnections } from "wagmi";
import { sendTransaction, switchChain, waitForTransactionReceipt, writeContract } from "wagmi/actions";
import { erc20Abi, isAddress, type Address, type Hex } from "viem";
import { getExplorerTxUrl } from "@/lib/token-icons";
import { describeSendError, formatTokenAmount, sameAddress, shortAddress, type SendItem, type SendStep } from "@/lib/send-stacks";

export type SendRequest = {
  chainId: number;
  /** Sending wallet: must be one of the connected accounts. */
  from: string;
  to: string;
  items: SendItem[];
};

export type SendOutcome = { ok: boolean; steps: SendStep[]; hashes: Hex[]; error?: string };

export function useSendStacks() {
  const config = useConfig();
  const connections = useConnections();
  const [steps, setSteps] = useState<SendStep[]>([]);
  const [running, setRunning] = useState(false);
  const stepsRef = useRef<SendStep[]>([]);

  const publish = useCallback((next: SendStep[]) => { stepsRef.current = next; setSteps(next); }, []);
  const patch = useCallback((key: string, partial: Partial<SendStep>) => publish(stepsRef.current.map((s) => (s.key === key ? { ...s, ...partial } : s))), [publish]);

  /** The wallet connection that can sign for `address`, if any. */
  const connectionFor = useCallback(
    (address: string) => connections.find((c) => c.accounts.some((a) => sameAddress(a, address))),
    [connections],
  );

  const send = useCallback(async (req: SendRequest): Promise<SendOutcome> => {
    const { chainId, from, to, items } = req;
    const fail = (error: string, hashes: Hex[] = []): SendOutcome => ({ ok: false, steps: stepsRef.current, hashes, error });
    if (!isAddress(to)) return fail("Enter a valid recipient address.");
    if (sameAddress(from, to)) return fail("The recipient is the sending wallet itself.");
    if (!items.length) return fail("Nothing to send.");
    const connection = connectionFor(from);
    if (!connection) return fail(`Connect the wallet that holds ${shortAddress(from)} first.`);

    const initial: SendStep[] = items.map((item, i) => ({
      key: `${i}:${item.token.address.toLowerCase()}`,
      symbol: item.token.symbol,
      amount: formatTokenAmount(item.rawAmount, item.token.decimals),
      status: "queued",
    }));
    publish(initial);
    setRunning(true);
    const hashes: Hex[] = [];
    try {
      if (connection.chainId !== chainId) await switchChain(config, { chainId, connector: connection.connector });
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const key = initial[i].key;
        const amount = BigInt(item.rawAmount);
        patch(key, { status: "wallet" });
        const hash = item.token.isNative
          ? await sendTransaction(config, { connector: connection.connector, account: from as Address, chainId, to: to as Address, value: amount })
          : await writeContract(config, {
              connector: connection.connector,
              account: from as Address,
              chainId,
              address: item.token.address as Address,
              abi: erc20Abi,
              functionName: "transfer",
              args: [to as Address, amount],
            });
        hashes.push(hash);
        patch(key, { status: "pending", hash, explorerUrl: getExplorerTxUrl(chainId, hash) || undefined });
        const receipt = await waitForTransactionReceipt(config, { chainId, hash, confirmations: 1, timeout: 240_000 });
        if (receipt.status !== "success") {
          patch(key, { status: "failed", error: "The transaction reverted on-chain. Nothing moved for this stack." });
          return fail(`${item.token.symbol} transfer reverted.`, hashes);
        }
        patch(key, { status: "confirmed" });
      }
      return { ok: true, steps: stepsRef.current, hashes };
    } catch (error) {
      const message = describeSendError(error);
      const current = stepsRef.current.find((s) => s.status === "wallet" || s.status === "pending");
      if (current) patch(current.key, { status: "failed", error: message });
      return fail(message, hashes);
    } finally {
      setRunning(false);
      window.dispatchEvent(new Event("veggat:balanceInvalidate"));
    }
  }, [config, connectionFor, publish, patch]);

  const reset = useCallback(() => publish([]), [publish]);

  return { steps, running, send, reset, connectionFor };
}
