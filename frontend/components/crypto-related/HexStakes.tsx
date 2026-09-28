"use client";

/**
 * @fileOverview  Your HEX stakes on Ethereum or PulseChain, read straight from
 *                the contract: principal, T-shares, progress, accrued yield;
 *                start a new stake or end one through the wallet that holds
 *                the account. Ending early or late costs HEX by the contract's
 *                own rules, so those actions ask twice.
 * @stability     experimental
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAccount, useChainId, useChains, useConfig } from "wagmi";
import { readContract, readContracts, switchChain, waitForTransactionReceipt, writeContract } from "wagmi/actions";
import type { Address, Hex } from "viem";
import { toast } from "sonner";
import { FiAlertTriangle, FiCheckCircle, FiExternalLink, FiLoader, FiRefreshCw } from "react-icons/fi";
import { useActiveWalletOverride } from "@/contexts/active-wallet-context";
import { useSendStacks } from "@/hooks/use-send-stacks";
import { HEX_ADDRESS, HEX_CHAINS, HEX_MAX_STAKE_DAYS, accruedPayout, dayToDate, describeStake, estimateStakeShares, formatHex, hexAbi, parseHex, sharesToTShares, type HexStakeView } from "@/lib/hex";
import { describeSendError, shortAddress } from "@/lib/send-stacks";
import { getExplorerTxUrl } from "@/lib/token-icons";
import { cn } from "@/lib/utils";

type Loaded = { currentDay: number; shareRate: bigint; balance: bigint; stakes: HexStakeView[]; yields: Map<number, bigint> };
type TxState = { label: string; status: "wallet" | "pending" | "confirmed" | "failed"; hash?: Hex; error?: string } | null;

const STATUS_TONE: Record<HexStakeView["status"], string> = {
  pending: "bg-foreground/[0.06] text-muted-foreground",
  active: "bg-brand-accent/12 text-brand-accent-hover dark:text-brand-accent-light",
  matured: "bg-amber-500/15 text-amber-700 dark:text-amber-300",
  late: "bg-red-500/12 text-red-700 dark:text-red-300",
  accounted: "bg-brand-accent/12 text-brand-accent-hover dark:text-brand-accent-light",
};
const STATUS_LABEL: Record<HexStakeView["status"], string> = { pending: "Starts tomorrow", active: "Active", matured: "Matured · end it", late: "Late · penalties accrue", accounted: "Payout locked in · end it to collect" };
const field = "h-10 w-full rounded-lg border border-border/60 bg-foreground/[0.04] px-3 text-sm tabular-nums text-foreground placeholder:text-muted-foreground/70 focus-visible:border-brand-accent/60 focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_hsl(var(--brand-accent)/0.14)]";
const chip = "min-h-8 rounded-full border border-border/60 px-3 text-[11px] font-medium text-muted-foreground transition-[background-color,border-color,color] duration-150 hover:border-border hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const primary = "inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-brand-accent px-5 text-sm font-semibold text-brand-accent-foreground shadow-e2 transition-[background-color,transform,opacity] duration-200 hover:bg-brand-accent-hover motion-safe:hover:-translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 disabled:shadow-none disabled:hover:translate-y-0";

export function HexStakes({ className }: { className?: string }) {
  const config = useConfig();
  const chainId = useChainId();
  const chains = useChains();
  const { address: connected } = useAccount();
  const { override } = useActiveWalletOverride();
  const address = (override?.address ?? connected) as Address | undefined;
  const { connectionFor } = useSendStacks();
  const supported = (HEX_CHAINS as readonly number[]).includes(chainId);
  const chainName = chains.find((c) => c.id === chainId)?.name ?? `Chain ${chainId}`;
  const explorerToken = chainId === 369 ? `https://scan.pulsechain.com/address/${HEX_ADDRESS}` : `https://etherscan.io/address/${HEX_ADDRESS}`;

  const [data, setData] = useState<Loaded | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tx, setTx] = useState<TxState>(null);
  const [amount, setAmount] = useState("");
  const [days, setDays] = useState("365");
  const [confirmEnd, setConfirmEnd] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!address || !supported) { setData(null); return; }
    setLoading(true); setError(null);
    try {
      const base = await readContracts(config, {
        contracts: [
          { address: HEX_ADDRESS, abi: hexAbi, functionName: "stakeCount", args: [address], chainId },
          { address: HEX_ADDRESS, abi: hexAbi, functionName: "currentDay", chainId },
          { address: HEX_ADDRESS, abi: hexAbi, functionName: "globals", chainId },
          { address: HEX_ADDRESS, abi: hexAbi, functionName: "balanceOf", args: [address], chainId },
        ],
        allowFailure: false,
      });
      const count = Number(base[0]);
      const currentDay = Number(base[1]);
      const shareRate = BigInt(base[2][2]);
      // Daily data exists only up to the last stored day (it lags today until someone triggers the update).
      const dailyDataCount = Number(base[2][4]);
      const balance = base[3];
      const raw = count
        ? await readContracts(config, { contracts: Array.from({ length: count }, (_, i) => ({ address: HEX_ADDRESS, abi: hexAbi, functionName: "stakeLists" as const, args: [address, BigInt(i)] as const, chainId })), allowFailure: false })
        : [];
      const stakes = raw.map((r, index) => describeStake({ index, stakeId: BigInt(r[0]), stakedHearts: BigInt(r[1]), stakeShares: BigInt(r[2]), lockedDay: Number(r[3]), stakedDays: Number(r[4]), unlockedDay: Number(r[5]), isAutoStake: Boolean(r[6]) }, currentDay));
      setData({ currentDay, shareRate, balance, stakes, yields: new Map() });
      // Accrued yield: the contract's own daily payout loop. One call per year of
      // data per stake (a 2,000-day range in one multicall blows the call limit).
      const yields = new Map<number, bigint>();
      const started = stakes.filter((s) => s.status !== "pending").slice(0, 20);
      for (const s of started) {
        const end = Math.min(currentDay, s.endDay, dailyDataCount);
        let total = BigInt(0);
        try {
          for (let from = s.lockedDay; from < end; from += 365) {
            const to = Math.min(end, from + 365);
            const list = await readContract(config, { address: HEX_ADDRESS, abi: hexAbi, functionName: "dailyDataRange", args: [BigInt(from), BigInt(to)], chainId });
            total += accruedPayout(s.stakeShares, [...(list as readonly bigint[])]);
          }
          yields.set(s.index, total);
        } catch (yieldErr) {
          console.warn("[HexStakes] yield unavailable for stake", s.stakeId.toString(), yieldErr);
        }
      }
      setData({ currentDay, shareRate, balance, stakes, yields });
    } catch (err) {
      setError(describeSendError(err));
    } finally { setLoading(false); }
  }, [address, supported, chainId, config]);

  useEffect(() => { void load(); }, [load]);

  const totals = useMemo(() => {
    if (!data) return null;
    const live = data.stakes;
    return {
      count: live.length,
      hearts: live.reduce((a, s) => a + s.stakedHearts, BigInt(0)),
      tShares: live.reduce((a, s) => a + s.tShares, 0),
      yieldHearts: live.reduce((a, s) => a + (data.yields.get(s.index) ?? BigInt(0)), BigInt(0)),
    };
  }, [data]);

  const hearts = parseHex(amount);
  const dayCount = Math.floor(Number(days));
  const validDays = Number.isFinite(dayCount) && dayCount >= 1 && dayCount <= HEX_MAX_STAKE_DAYS;
  const overBalance = Boolean(hearts && data && hearts > data.balance);
  const previewShares = hearts && validDays && data ? estimateStakeShares(hearts, dayCount, data.shareRate) : null;
  const signer = address ? connectionFor(address) : undefined;

  const run = async (label: string, fn: () => Promise<Hex>) => {
    if (!address || !signer) { toast.error(`Connect the wallet that holds ${address ? shortAddress(address) : "this account"} first.`); return; }
    setTx({ label, status: "wallet" });
    try {
      if (signer.chainId !== chainId) await switchChain(config, { chainId, connector: signer.connector });
      const hash = await fn();
      setTx({ label, status: "pending", hash });
      const receipt = await waitForTransactionReceipt(config, { chainId, hash, confirmations: 1, timeout: 240_000 });
      if (receipt.status !== "success") { setTx({ label, status: "failed", hash, error: "The transaction reverted on-chain." }); return; }
      setTx({ label, status: "confirmed", hash });
      toast.success(`${label} confirmed`);
      window.dispatchEvent(new Event("veggat:balanceInvalidate"));
      await load();
    } catch (err) {
      setTx({ label, status: "failed", error: describeSendError(err) });
    }
  };

  const startStake = () => {
    if (!hearts || !validDays || !address || !signer) return;
    void run(`Stake ${formatHex(hearts)} HEX for ${dayCount} days`, () =>
      writeContract(config, { connector: signer.connector, account: address, chainId, address: HEX_ADDRESS, abi: hexAbi, functionName: "stakeStart", args: [hearts, BigInt(dayCount)] }));
  };
  const endStake = (s: HexStakeView) => {
    if (!address || !signer) return;
    setConfirmEnd(null);
    void run(`End stake #${s.stakeId.toString()}`, () =>
      writeContract(config, { connector: signer.connector, account: address, chainId, address: HEX_ADDRESS, abi: hexAbi, functionName: "stakeEnd", args: [BigInt(s.index), Number(s.stakeId)] }));
  };
  // Good accounting: after maturity, anyone can lock the payout in so late penalties stop growing; the stake still needs ending to collect.
  const goodAccounting = (s: HexStakeView) => {
    if (!address || !signer) return;
    void run(`Good accounting for stake #${s.stakeId.toString()}`, () =>
      writeContract(config, { connector: signer.connector, account: address, chainId, address: HEX_ADDRESS, abi: hexAbi, functionName: "stakeGoodAccounting", args: [address, BigInt(s.index), Number(s.stakeId)] }));
  };

  return (
    <section className={cn("space-y-3", className)} aria-label="HEX stakes">
      <header className="flex flex-wrap items-center gap-2">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-foreground">HEX stakes <span className="ml-1 rounded-md border border-border/60 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{chainName}</span></h2>
          <p className="text-[11px] text-muted-foreground">
            {address ? <>Wallet <span className="font-mono text-foreground">{shortAddress(address)}</span>{data ? <> · Balance <span className="tabular-nums text-foreground">{formatHex(data.balance)} HEX</span> · Day {data.currentDay}</> : null}</> : "Connect a wallet to see its stakes."}
          </p>
        </div>
        <span className="ml-auto flex items-center gap-2">
          <a href={explorerToken} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[11px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline">Contract <FiExternalLink className="h-3 w-3" aria-hidden="true" /></a>
          <button type="button" onClick={() => void load()} disabled={loading || !supported} aria-label="Refresh stakes" className="grid size-8 place-items-center rounded-lg border border-border/60 text-muted-foreground transition-[background-color,color] duration-150 hover:bg-foreground/[0.06] hover:text-foreground disabled:opacity-50">
            <FiRefreshCw className={cn("h-3.5 w-3.5", loading && "motion-safe:animate-spin")} />
          </button>
        </span>
      </header>

      {!supported && <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-200">HEX lives on Ethereum and PulseChain. Switch your wallet to one of them to see and manage stakes.</p>}
      {error && <p role="alert" className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-700 dark:text-red-300">{error}</p>}
      {address && !signer && supported && <p className="rounded-xl border border-border/60 bg-foreground/[0.03] p-3 text-xs text-muted-foreground">Read-only: the wallet holding {shortAddress(address)} is not connected in this browser, so stakes can be viewed but not changed.</p>}

      {totals && (
        <dl className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {[["Active stakes", String(totals.count)], ["Staked", `${formatHex(totals.hearts)} HEX`], ["T-shares", totals.tShares.toLocaleString("en-US", { maximumFractionDigits: 3 })], ["Accrued yield", `+${formatHex(totals.yieldHearts)} HEX`]].map(([k, v]) => (
            <div key={k} className="rounded-xl border border-border/60 bg-foreground/[0.03] px-3 py-2"><dt className="text-[10px] uppercase tracking-wider text-muted-foreground">{k}</dt><dd className="text-sm font-semibold tabular-nums text-foreground">{v}</dd></div>
          ))}
        </dl>
      )}

      {tx && (
        <p role="status" className={cn("flex items-start gap-2 rounded-xl border px-3 py-2 text-xs", tx.status === "failed" ? "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300" : tx.status === "confirmed" ? "border-brand-accent/30 bg-brand-accent/10 text-foreground" : "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-200")}>
          {tx.status === "confirmed" ? <FiCheckCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" /> : tx.status === "failed" ? <FiAlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" /> : <FiLoader className="mt-0.5 h-3.5 w-3.5 shrink-0 motion-safe:animate-spin" aria-hidden="true" />}
          <span className="min-w-0 flex-1">
            <span className="font-semibold">{tx.label}</span> · {tx.status === "wallet" ? "confirm in your wallet" : tx.status === "pending" ? "confirming on-chain…" : tx.status === "confirmed" ? "confirmed" : tx.error}
            {tx.hash && <> · <a href={getExplorerTxUrl(chainId, tx.hash)} target="_blank" rel="noopener noreferrer" className="font-mono underline-offset-2 hover:underline">{tx.hash.slice(0, 10)}…</a></>}
          </span>
        </p>
      )}

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-2">
          {loading && !data && <div role="status" aria-label="Loading stakes" className="h-32 rounded-xl bg-foreground/[0.04] motion-safe:animate-pulse" />}
          {data && data.stakes.length === 0 && <p className="rounded-xl border border-border/60 bg-foreground/[0.03] p-4 text-sm text-muted-foreground">No stakes on {chainName} for this wallet yet.</p>}
          {data?.stakes.map((s) => {
            const y = data.yields.get(s.index);
            const early = s.status === "active";
            return (
              <article key={s.stakeId.toString()} className="rounded-xl border border-border/60 bg-card/60 p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={cn("rounded-md px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider", STATUS_TONE[s.status])}>{STATUS_LABEL[s.status]}</span>
                  <span className="text-[11px] text-muted-foreground">#{s.stakeId.toString()}{s.isAutoStake ? " · auto" : ""}</span>
                  <span className="ml-auto text-[11px] tabular-nums text-muted-foreground">Day {s.daysServed} of {s.stakedDays}</span>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs sm:grid-cols-4">
                  <div><span className="block text-[10px] uppercase tracking-wider text-muted-foreground">Principal</span><span className="font-semibold tabular-nums text-foreground">{formatHex(s.stakedHearts)} HEX</span></div>
                  <div><span className="block text-[10px] uppercase tracking-wider text-muted-foreground">T-shares</span><span className="font-semibold tabular-nums text-foreground">{s.tShares.toLocaleString("en-US", { maximumFractionDigits: 3 })}</span></div>
                  <div><span className="block text-[10px] uppercase tracking-wider text-muted-foreground">Yield so far</span><span className="font-semibold tabular-nums text-brand-accent-hover dark:text-brand-accent-light">{y !== undefined ? `+${formatHex(y)} HEX` : "—"}</span></div>
                  <div><span className="block text-[10px] uppercase tracking-wider text-muted-foreground">{s.status === "accounted" ? "Matured" : "Matures"}</span><span className="font-semibold tabular-nums text-foreground">{s.endDate.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" })}</span></div>
                </div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-foreground/[0.06]" role="progressbar" aria-valuenow={Math.round(s.progress * 100)} aria-valuemin={0} aria-valuemax={100} aria-label="Stake progress">
                  <div className={cn("h-full rounded-full", s.status === "late" ? "bg-red-500/70" : s.status === "matured" ? "bg-amber-500/80" : "bg-brand-accent")} style={{ width: `${Math.round(s.progress * 100)}%` }} />
                </div>
                <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>Started {s.startDate.toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" })}</span>
                  {(s.status === "matured" || s.status === "late") && signer && confirmEnd !== s.index && (
                    <button type="button" onClick={() => goodAccounting(s)} title="Lock the payout in now so late penalties stop growing; the stake still needs ending to collect" className="mr-2 rounded-md border border-border/60 px-2 py-1 font-semibold text-muted-foreground transition-[background-color,color] duration-150 hover:bg-foreground/[0.06] hover:text-foreground">Good accounting</button>
                  )}
                  {s.status !== "pending" && signer && (
                    confirmEnd === s.index ? (
                      <span className="flex items-center gap-2">
                        <span className={cn(early ? "text-red-700 dark:text-red-300" : "text-amber-700 dark:text-amber-300")}>{early ? "Ending early forfeits yield and can burn principal." : s.status === "late" ? "Late-end penalties apply." : "Ready to end."}</span>
                        <button type="button" onClick={() => endStake(s)} className="rounded-md bg-red-500/15 px-2 py-1 font-semibold text-red-700 dark:text-red-300">Yes, end stake</button>
                        <button type="button" onClick={() => setConfirmEnd(null)} className="rounded-md border border-border/60 px-2 py-1">Keep</button>
                      </span>
                    ) : (
                      <button type="button" onClick={() => setConfirmEnd(s.index)} className={cn("rounded-md border px-2 py-1 font-semibold transition-[background-color] duration-150", early ? "border-border/60 text-muted-foreground hover:bg-red-500/10 hover:text-red-700 dark:hover:text-red-300" : "border-amber-500/40 bg-amber-500/10 text-amber-800 hover:bg-amber-500/20 dark:text-amber-200")}>
                        {early ? "End early…" : "End stake"}
                      </button>
                    )
                  )}
                </div>
              </article>
            );
          })}
        </div>

        <aside className="space-y-3 rounded-xl border border-border/60 bg-foreground/[0.03] p-3" aria-label="New stake">
          <h3 className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">New stake</h3>
          <label className="block space-y-1">
            <span className="text-[11px] text-muted-foreground">Amount (HEX)</span>
            <span className="relative block">
              <input value={amount} onChange={(e) => setAmount(e.target.value)} inputMode="decimal" placeholder="0.0" className={cn(field, "pr-16")} aria-invalid={Boolean(amount) && (!hearts || overBalance)} disabled={!supported || !signer} />
              <button type="button" disabled={!data} onClick={() => data && setAmount(formatHex(data.balance, 8).replace(/,/g, ""))} className={cn(chip, "absolute right-1.5 top-1/2 min-h-7 -translate-y-1/2")}>Max</button>
            </span>
            {overBalance && <span className="text-[11px] text-red-600 dark:text-red-400">More than the wallet holds.</span>}
          </label>
          <label className="block space-y-1">
            <span className="text-[11px] text-muted-foreground">Length (days, 1–{HEX_MAX_STAKE_DAYS})</span>
            <input value={days} onChange={(e) => setDays(e.target.value.replace(/[^0-9]/g, ""))} inputMode="numeric" className={field} aria-invalid={!validDays} disabled={!supported || !signer} />
            <span className="flex flex-wrap gap-1 pt-1">
              {[["30", "1 mo"], ["365", "1 yr"], ["1000", "1000 d"], ["3650", "10 yr"], [String(HEX_MAX_STAKE_DAYS), "Max"]].map(([d, l]) => (
                <button key={d} type="button" onClick={() => setDays(d)} aria-pressed={days === d} className={cn(chip, "min-h-7", days === d && "border-brand-accent/40 bg-brand-accent/12 text-foreground")}>{l}</button>
              ))}
            </span>
          </label>
          <p className="text-[11px] text-muted-foreground">
            {previewShares && data ? <>≈ <span className="font-semibold tabular-nums text-foreground">{sharesToTShares(previewShares).toLocaleString("en-US", { maximumFractionDigits: 3 })} T-shares</span> · matures {dayToDate(data.currentDay + 1 + dayCount).toLocaleDateString(undefined, { day: "2-digit", month: "short", year: "numeric" })}</> : "Longer and bigger stakes earn more shares. Principal is locked until the end day."}
          </p>
          <button type="button" onClick={startStake} disabled={!supported || !signer || !hearts || !validDays || overBalance || tx?.status === "wallet" || tx?.status === "pending"} className={primary}>
            {signer ? `Stake with ${signer.connector.name}` : "Stake"}
          </button>
          <p className="text-[10px] leading-relaxed text-muted-foreground">The contract locks the HEX until the end day; ending early or more than 14 days late costs yield and can cost principal. Your wallet shows the gas and asks you to confirm.</p>
        </aside>
      </div>
    </section>
  );
}
