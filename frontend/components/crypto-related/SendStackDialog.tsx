"use client";

/**
 * @fileOverview  Send a stack from the inventory to any address or to another
 *                connected wallet. The wallet extension that holds the sending
 *                account signs; the dialog shows the prompt, the pending hash
 *                and the confirmation, and records the move in the app's
 *                history once the chain has confirmed it.
 * @stability     evolving
 */

import { useEffect, useMemo, useState } from "react";
import { useChains, useConfig, useConnections } from "wagmi";
import { getGasPrice } from "wagmi/actions";
import { formatUnits } from "viem";
import { toast } from "sonner";
import { FiAlertTriangle, FiCheckCircle, FiChevronDown, FiClipboard, FiExternalLink, FiSend } from "react-icons/fi";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { TokenIcon } from "@/components/ui/token-icon";
import { useSendStacks } from "@/hooks/use-send-stacks";
import { useWalletAddressBook } from "@/hooks/use-wallet-address-book";
import { formatUsd, stackUsd } from "@/lib/stack-value";
import { getExplorerTxUrl } from "@/lib/token-icons";
import { formatTokenAmount, looksLikeAddress, parseSendAmount, sameAddress, shortAddress, type SendToken } from "@/lib/send-stacks";
import { SendProgress } from "./SendProgress";
import { cn } from "@/lib/utils";

export type SendStackTarget = { token: SendToken; rawAmount: string | bigint };

const field = "h-10 w-full rounded-lg border border-border/60 bg-foreground/[0.04] px-3 text-sm text-foreground placeholder:text-muted-foreground/70 focus-visible:border-brand-accent/60 focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_hsl(var(--brand-accent)/0.14)]";
const chip = "inline-flex min-h-8 items-center gap-1 rounded-md border border-border/60 px-2 text-[11px] font-medium text-muted-foreground transition-[background-color,color,border-color] duration-150 hover:border-border hover:bg-foreground/[0.06] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

export function SendStackDialog({ open, onOpenChange, target, from, warning }: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  target: SendStackTarget | null;
  /** The wallet that holds the stack (the active inventory wallet). */
  from?: string;
  /** Risk note for this token, shown above the form (see the token risk model). */
  warning?: string | null;
}) {
  const config = useConfig();
  const chains = useChains();
  const connections = useConnections();
  const { getDisplayName } = useWalletAddressBook();
  const { steps, running, send, reset, connectionFor } = useSendStacks();
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [done, setDone] = useState<{ hashes: string[] } | null>(null);
  const [gasReserve, setGasReserve] = useState<bigint>(BigInt(0));

  const token = target?.token;
  const chainId = token?.chainId ?? 1;
  const decimals = token?.decimals ?? 18;
  const max = useMemo(() => { try { return BigInt(target?.rawAmount ?? 0); } catch { return BigInt(0); } }, [target?.rawAmount]);

  useEffect(() => {
    if (!open) return;
    setTo(""); setAmount(""); setDone(null); reset();
  }, [open, token?.address, reset]);

  // Native coin: keep enough for the transfer's own gas so "Max" cannot fail.
  useEffect(() => {
    if (!open || !token?.isNative) { setGasReserve(BigInt(0)); return; }
    let cancelled = false;
    getGasPrice(config, { chainId }).then((gp) => { if (!cancelled) setGasReserve(gp * BigInt(21_000) * BigInt(3)); }).catch(() => { if (!cancelled) setGasReserve(BigInt(0)); });
    return () => { cancelled = true; };
  }, [open, token?.isNative, chainId, config]);

  const maxSendable = token?.isNative ? (max > gasReserve ? max - gasReserve : BigInt(0)) : max;
  const parsed = token ? parseSendAmount(amount, decimals, max) : null;
  const tooCloseToGas = Boolean(token?.isNative && parsed && parsed > maxSendable);
  const usd = token && parsed ? stackUsd(token, parsed) : null;
  const chainName = chains.find((c) => c.id === chainId)?.name ?? `Chain ${chainId}`;
  const sender = from ? connectionFor(from) : undefined;
  const otherWallets = useMemo(() => {
    const seen = new Set<string>();
    return connections.flatMap((c) => c.accounts.map((a) => ({ address: a as string, wallet: c.connector.name })))
      .filter((w) => !sameAddress(w.address, from) && !seen.has(w.address.toLowerCase()) && seen.add(w.address.toLowerCase()));
  }, [connections, from]);

  const recipientOk = looksLikeAddress(to) && !sameAddress(to, from);
  const canSend = Boolean(token && from && sender && parsed && recipientOk && !tooCloseToGas && !running && !done);

  const paste = async () => {
    try { const text = (await navigator.clipboard.readText()).trim(); if (text) setTo(text); }
    catch { toast.error("Clipboard access was blocked. Paste into the field instead."); }
  };

  const submit = async () => {
    if (!token || !from || !parsed) return;
    const display = formatUnits(parsed, decimals);
    const result = await send({ chainId, from, to: to.trim(), items: [{ token, rawAmount: parsed }] });
    if (!result.ok) { if (result.error) toast.error(result.error); return; }
    setDone({ hashes: result.hashes });
    toast.success(`Sent ${display} ${token.symbol}`);
    // The app's own history entry; the chain remains the source of truth.
    void fetch("/api/trades/record", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode: "SELF",
        sellToken: token.symbol, sellTokenAddress: token.address, sellAmount: parsed.toString(), sellDisplayAmt: display, sellDecimals: Math.min(18, decimals), sellChainId: chainId,
        buyToken: token.symbol, buyTokenAddress: token.address, buyAmount: parsed.toString(), buyDisplayAmt: display, buyDecimals: Math.min(18, decimals), buyChainId: chainId,
        ...(usd ? { priceUsd: usd, priceSource: "inventory" } : {}),
        txHash: result.hashes[0], walletAddress: from,
        metadata: { kind: "send", to: to.trim() },
      }),
    }).catch(() => undefined);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { if (!running) onOpenChange(next); }}>
      <DialogContent className="max-w-md gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b border-border/60 px-5 py-4 text-left">
          <DialogTitle className="flex items-center gap-2.5 text-base">
            {token && <TokenIcon address={token.address} chainId={chainId} symbol={token.symbol} logo={token.logo} size={28} />}
            <span>Send {token?.symbol ?? ""}</span>
            <span className="ml-auto rounded-md border border-border/60 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{chainName}</span>
          </DialogTitle>
          <DialogDescription className="text-xs">
            {token ? <>Balance <span className="font-semibold tabular-nums text-foreground">{formatTokenAmount(max, decimals)} {token.symbol}</span>{from && <> · from <span className="font-mono text-foreground">{shortAddress(from)}</span>{sender ? ` (${sender.connector.name})` : ""}</>}</> : "Pick a stack in your inventory first."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 px-5 py-4">
          {warning && (
            <p role="alert" className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
              <FiAlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />{warning}
            </p>
          )}
          {from && !sender && !done && (
            <p role="alert" className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
              The wallet holding {shortAddress(from)} is not connected in this browser, so nothing can sign. Activate it from the account menu first.
            </p>
          )}

          {done ? (
            <div className="space-y-3 text-center">
              <FiCheckCircle className="mx-auto h-10 w-10 text-brand-accent-hover dark:text-brand-accent-light" aria-hidden="true" />
              <p className="text-sm font-semibold text-foreground">Sent and confirmed</p>
              <p className="text-xs text-muted-foreground">{amount} {token?.symbol} is now in <span className="font-mono text-foreground">{shortAddress(to.trim())}</span>.</p>
              {done.hashes[0] && (
                <a href={getExplorerTxUrl(chainId, done.hashes[0])} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-brand-accent-hover underline-offset-2 hover:underline dark:text-brand-accent-light">
                  View on explorer <FiExternalLink className="h-3 w-3" aria-hidden="true" />
                </a>
              )}
              <button type="button" onClick={() => onOpenChange(false)} className="mt-1 inline-flex min-h-10 w-full items-center justify-center rounded-full border border-border/60 text-sm font-medium text-foreground transition-[background-color] duration-150 hover:bg-foreground/[0.06] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Done</button>
            </div>
          ) : (
            <>
              <label className="block space-y-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">To</span>
                <input value={to} onChange={(e) => setTo(e.target.value)} placeholder="0x… any address" spellCheck={false} autoComplete="off" disabled={running} className={cn(field, "font-mono text-xs")} aria-invalid={Boolean(to) && !recipientOk} />
                <span className="flex flex-wrap items-center gap-1.5">
                  <button type="button" onClick={() => void paste()} disabled={running} className={chip}><FiClipboard className="h-3 w-3" aria-hidden="true" /> Paste</button>
                  {otherWallets.length > 0 && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button type="button" disabled={running} className={chip}>Your wallets <FiChevronDown className="h-3 w-3" aria-hidden="true" /></button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="start" className="z-[130] min-w-60 rounded-xl border-border/70 bg-popover/95 p-1 shadow-e3 backdrop-blur-xl">
                        {otherWallets.map((w) => (
                          <DropdownMenuItem key={w.address} onSelect={() => setTo(w.address)} className="min-h-10 gap-2 rounded-lg px-2.5 text-xs">
                            <span className="font-mono">{shortAddress(w.address)}</span>
                            <span className="min-w-0 flex-1 truncate text-muted-foreground">{getDisplayName(w.address) !== shortAddress(w.address) ? getDisplayName(w.address) : w.wallet}</span>
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                  {to && !looksLikeAddress(to) && <span className="text-[11px] text-red-600 dark:text-red-400">Not a valid address.</span>}
                  {to && sameAddress(to, from) && <span className="text-[11px] text-red-600 dark:text-red-400">That is the sending wallet.</span>}
                </span>
              </label>

              <label className="block space-y-1.5">
                <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Amount</span>
                <span className="relative block">
                  <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="0.0" disabled={running} className={cn(field, "pr-28 tabular-nums")} aria-invalid={Boolean(amount) && !parsed} />
                  <span className="absolute inset-y-0 right-2 flex items-center gap-1.5">
                    <span className="text-xs text-muted-foreground">{token?.symbol}</span>
                    <button type="button" disabled={running} onClick={() => setAmount(formatUnits(maxSendable, decimals))} className={cn(chip, "min-h-7")}>Max</button>
                  </span>
                </span>
                <span className="flex items-center justify-between text-[11px] text-muted-foreground">
                  <span>{usd != null ? `≈ ${formatUsd(usd)}` : amount && !parsed ? "Enter an amount up to your balance." : token?.isNative ? "Max keeps a little back for gas." : " "}</span>
                  {tooCloseToGas && <span className="text-amber-700 dark:text-amber-300">Leave some {token?.symbol} for gas.</span>}
                </span>
              </label>

              <SendProgress steps={steps} />

              <button type="button" onClick={() => void submit()} disabled={!canSend}
                className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-brand-accent px-5 text-sm font-semibold text-brand-accent-foreground shadow-e2 transition-[background-color,transform,opacity] duration-200 hover:bg-brand-accent-hover motion-safe:hover:-translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 disabled:shadow-none disabled:hover:translate-y-0">
                <FiSend className="h-4 w-4" aria-hidden="true" />
                {running ? "Confirm in your wallet…" : sender ? `Send with ${sender.connector.name}` : "Send"}
              </button>
              <p className="text-center text-[11px] leading-relaxed text-muted-foreground">Your wallet shows the gas fee and asks you to confirm. Nothing moves until you approve it there.</p>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
