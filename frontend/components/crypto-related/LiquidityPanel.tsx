"use client";

/**
 * @fileOverview  Add or remove liquidity on Uniswap-V2-style pools (Uniswap V2
 *                on Ethereum, PulseX on PulseChain): pick two tokens from the
 *                inventory or by address, the pool's ratio fills the other
 *                side, approvals and the router call run through the wallet
 *                one prompt at a time, every call is simulated first. A pair
 *                that does not exist yet is created by the same call, with
 *                the amounts you enter setting its starting price.
 * @stability     experimental
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAccount, useChainId, useChains, useConfig } from "wagmi";
import { readContracts, simulateContract, switchChain, waitForTransactionReceipt, writeContract } from "wagmi/actions";
import { erc20Abi, formatUnits, isAddress, type Address, type Hex } from "viem";
import { toast } from "sonner";
import { FiAlertTriangle, FiChevronDown, FiRefreshCw } from "react-icons/fi";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { TokenIcon } from "@/components/ui/token-icon";
import { useActiveWalletOverride } from "@/contexts/active-wallet-context";
import { useSendStacks } from "@/hooks/use-send-stacks";
import { useTokenBalances, type InventoryToken } from "@/hooks/use-token-balances";
import { V2_PROTOCOLS, ZERO_ADDRESS, deadlineFrom, factoryAbi, isLpSymbol, isNativeAddress, lpRemoveAmounts, pairAbi, poolSharePct, quoteOther, routerAbi, sortTokens, withSlippage, type V2Protocol } from "@/lib/dex/v2";
import { describeSendError, formatTokenAmount, parseSendAmount, shortAddress, type SendStep } from "@/lib/send-stacks";
import { getExplorerTxUrl } from "@/lib/token-icons";
import { SendProgress } from "./SendProgress";
import { cn } from "@/lib/utils";

type PoolToken = { address: string; symbol: string; decimals: number; isNative: boolean; logo?: string; balance: bigint };
type Pair = { address: Address; token0: Address; token1: Address; reserve0: bigint; reserve1: bigint; totalSupply: bigint };
type LpPosition = { lp: PoolToken; pair: Pair; symbols: [string, string]; decimals: [number, number]; balanceLp: bigint };

const field = "h-10 w-full rounded-lg border border-border/60 bg-foreground/[0.04] px-3 text-sm tabular-nums text-foreground placeholder:text-muted-foreground/70 focus-visible:border-brand-accent/60 focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_hsl(var(--brand-accent)/0.14)] disabled:opacity-50";
const chip = "min-h-8 rounded-full border border-border/60 px-3 text-[11px] font-medium text-muted-foreground transition-[background-color,border-color,color] duration-150 hover:border-border hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const chipOn = "border-brand-accent/40 bg-brand-accent/12 text-foreground";
const primary = "inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-brand-accent px-5 text-sm font-semibold text-brand-accent-foreground shadow-e2 transition-[background-color,transform,opacity] duration-200 hover:bg-brand-accent-hover motion-safe:hover:-translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 disabled:shadow-none disabled:hover:translate-y-0";
const menuContent = "z-[130] max-h-80 min-w-64 overflow-y-auto rounded-xl border-border/70 bg-popover/95 p-1 shadow-e3 backdrop-blur-xl";

const toPoolToken = (t: InventoryToken): PoolToken => ({ address: t.address, symbol: t.symbol, decimals: t.decimals, isNative: t.isNative, logo: t.logo, balance: t.rawBalance });
const poolAddress = (t: PoolToken, p: V2Protocol): Address => (t.isNative || isNativeAddress(t.address) ? p.wrappedNative : (t.address as Address));

export function LiquidityPanel({ className }: { className?: string }) {
  const config = useConfig();
  const chainId = useChainId();
  const chains = useChains();
  const { address: connected } = useAccount();
  const { override } = useActiveWalletOverride();
  const address = (override?.address ?? connected) as Address | undefined;
  const { connectionFor } = useSendStacks();
  const { tokens } = useTokenBalances();
  const protocols = V2_PROTOCOLS[chainId] ?? [];
  const [protocolId, setProtocolId] = useState<string | null>(null);
  const protocol = protocols.find((p) => p.id === protocolId) ?? protocols[0];
  const chainName = chains.find((c) => c.id === chainId)?.name ?? `Chain ${chainId}`;
  const signer = address ? connectionFor(address) : undefined;

  const [view, setView] = useState<"add" | "remove">("add");
  const [tokenA, setTokenA] = useState<PoolToken | null>(null);
  const [tokenB, setTokenB] = useState<PoolToken | null>(null);
  const [amountA, setAmountA] = useState("");
  const [amountB, setAmountB] = useState("");
  const [lastEdited, setLastEdited] = useState<"a" | "b">("a");
  const [slippageBps, setSlippageBps] = useState(50);
  const [customAddress, setCustomAddress] = useState("");
  const [pair, setPair] = useState<Pair | null | "none">(null);
  const [pairLoading, setPairLoading] = useState(false);
  const [steps, setSteps] = useState<SendStep[]>([]);
  const [busy, setBusy] = useState(false);
  const [positions, setPositions] = useState<LpPosition[]>([]);
  const [positionsLoading, setPositionsLoading] = useState(false);
  const [selectedLp, setSelectedLp] = useState<string | null>(null);
  const [removePct, setRemovePct] = useState(100);
  /** LP tokens added by address (pools the inventory has not discovered). */
  const [extraLps, setExtraLps] = useState<PoolToken[]>([]);
  const [lpAddress, setLpAddress] = useState("");

  const candidates = useMemo(() => tokens.filter((t) => !isLpSymbol(t.symbol)).map(toPoolToken), [tokens]);
  useEffect(() => { if (!tokenA && candidates.length) setTokenA(candidates[0]); }, [candidates, tokenA]);

  // ── Pair lookup ──────────────────────────────────────────────────────────
  const loadPair = useCallback(async () => {
    if (!protocol || !tokenA || !tokenB) { setPair(null); return; }
    const a = poolAddress(tokenA, protocol), b = poolAddress(tokenB, protocol);
    if (a.toLowerCase() === b.toLowerCase()) { setPair(null); return; }
    setPairLoading(true);
    try {
      const [pairAddr] = await readContracts(config, { contracts: [{ address: protocol.factory, abi: factoryAbi, functionName: "getPair", args: [a, b], chainId }], allowFailure: false });
      if (!pairAddr || pairAddr.toLowerCase() === ZERO_ADDRESS) { setPair("none"); return; }
      const [reserves, token0, token1, totalSupply] = await readContracts(config, {
        contracts: [
          { address: pairAddr, abi: pairAbi, functionName: "getReserves", chainId },
          { address: pairAddr, abi: pairAbi, functionName: "token0", chainId },
          { address: pairAddr, abi: pairAbi, functionName: "token1", chainId },
          { address: pairAddr, abi: pairAbi, functionName: "totalSupply", chainId },
        ],
        allowFailure: false,
      });
      setPair({ address: pairAddr, token0, token1, reserve0: BigInt(reserves[0]), reserve1: BigInt(reserves[1]), totalSupply });
    } catch (err) {
      toast.error(describeSendError(err)); setPair(null);
    } finally { setPairLoading(false); }
  }, [protocol, tokenA, tokenB, config, chainId]);
  useEffect(() => { void loadPair(); }, [loadPair]);

  const reservesFor = (t: PoolToken): { mine: bigint; other: bigint } | null => {
    if (!pair || pair === "none" || !protocol) return null;
    const addr = poolAddress(t, protocol).toLowerCase();
    return addr === pair.token0.toLowerCase() ? { mine: pair.reserve0, other: pair.reserve1 } : { mine: pair.reserve1, other: pair.reserve0 };
  };
  const rawA = tokenA ? parseSendAmount(amountA, tokenA.decimals, tokenA.balance) : null;
  const rawB = tokenB ? parseSendAmount(amountB, tokenB.decimals, tokenB.balance) : null;

  // The pool's ratio fills the side you did not type.
  useEffect(() => {
    if (!tokenA || !tokenB || !pair || pair === "none") return;
    const ra = reservesFor(tokenA), rb = reservesFor(tokenB);
    if (!ra || !rb || ra.mine === BigInt(0)) return;
    if (lastEdited === "a") { const raw = parseSendAmount(amountA, tokenA.decimals, BigInt(2) ** BigInt(255)); setAmountB(raw ? formatUnits(quoteOther(raw, ra.mine, ra.other), tokenB.decimals) : ""); }
    else { const raw = parseSendAmount(amountB, tokenB.decimals, BigInt(2) ** BigInt(255)); setAmountA(raw ? formatUnits(quoteOther(raw, rb.mine, rb.other), tokenA.decimals) : ""); }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only the typed side drives the fill
  }, [amountA, amountB, lastEdited, pair, tokenA?.address, tokenB?.address]);

  const newPool = pair === "none";
  const priceLabel = (() => {
    if (!tokenA || !tokenB) return null;
    if (pair && pair !== "none") { const r = reservesFor(tokenA); if (r && r.mine > BigInt(0)) return `1 ${tokenA.symbol} = ${formatTokenAmount((r.other * BigInt(10) ** BigInt(tokenA.decimals)) / r.mine, tokenB.decimals)} ${tokenB.symbol}`; }
    if (newPool && rawA && rawB) return `Starting price 1 ${tokenA.symbol} = ${formatTokenAmount((rawB * BigInt(10) ** BigInt(tokenA.decimals)) / rawA, tokenB.decimals)} ${tokenB.symbol}`;
    return null;
  })();
  const shareAfter = (() => {
    if (!pair || pair === "none" || !tokenA || !rawA || !rawB) return newPool && rawA && rawB ? 100 : null;
    const r = reservesFor(tokenA); if (!r || r.mine === BigInt(0)) return null;
    const minted = (rawA * pair.totalSupply) / r.mine;
    return poolSharePct(minted, pair.totalSupply + minted);
  })();

  // ── Custom token by address ──────────────────────────────────────────────
  const addCustom = async (side: "a" | "b") => {
    const addr = customAddress.trim();
    if (!isAddress(addr) || !address) { toast.error("Enter a valid token contract address."); return; }
    try {
      const [symbol, decimals, balance] = await readContracts(config, { contracts: [
        { address: addr, abi: erc20Abi, functionName: "symbol", chainId },
        { address: addr, abi: erc20Abi, functionName: "decimals", chainId },
        { address: addr, abi: erc20Abi, functionName: "balanceOf", args: [address], chainId },
      ], allowFailure: false });
      const t: PoolToken = { address: addr, symbol, decimals: Number(decimals), isNative: false, balance };
      if (side === "a") setTokenA(t); else setTokenB(t);
      setCustomAddress("");
    } catch { toast.error("That address does not answer like an ERC-20 token on this chain."); }
  };

  // ── Transaction runner (approve → router), simulated before each prompt ──
  const run = async (plan: Array<{ key: string; label: string; amount: string; exec: () => Promise<Hex> }>) => {
    if (!address || !signer) { toast.error(`Connect the wallet that holds ${address ? shortAddress(address) : "this account"} first.`); return false; }
    setBusy(true);
    const list: SendStep[] = plan.map((p) => ({ key: p.key, symbol: p.label, amount: p.amount, status: "queued" }));
    const patch = (key: string, partial: Partial<SendStep>) => setSteps((prev) => prev.map((s) => (s.key === key ? { ...s, ...partial } : s)));
    setSteps(list);
    try {
      if (signer.chainId !== chainId) await switchChain(config, { chainId, connector: signer.connector });
      for (const p of plan) {
        patch(p.key, { status: "wallet" });
        const hash = await p.exec();
        patch(p.key, { status: "pending", hash, explorerUrl: getExplorerTxUrl(chainId, hash) });
        const receipt = await waitForTransactionReceipt(config, { chainId, hash, confirmations: 1, timeout: 240_000 });
        if (receipt.status !== "success") { patch(p.key, { status: "failed", error: "The transaction reverted on-chain." }); return false; }
        patch(p.key, { status: "confirmed" });
      }
      window.dispatchEvent(new Event("veggat:balanceInvalidate"));
      return true;
    } catch (err) {
      const message = describeSendError(err);
      console.warn("[liquidity] transaction failed:", err);
      setSteps((prev) => { const cur = prev.find((s) => s.status === "wallet" || s.status === "pending"); return cur ? prev.map((s) => (s.key === cur.key ? { ...s, status: "failed", error: message } : s)) : prev; });
      toast.error(message);
      return false;
    } finally { setBusy(false); }
  };

  const approvalStep = async (token: PoolToken, amount: bigint, spender: Address, key: string) => {
    if (!address || !signer || token.isNative || isNativeAddress(token.address)) return null;
    const [allowance] = await readContracts(config, { contracts: [{ address: token.address as Address, abi: erc20Abi, functionName: "allowance", args: [address, spender], chainId }], allowFailure: false });
    if (allowance >= amount) return null;
    return {
      key, label: `Approve ${token.symbol}`, amount: formatTokenAmount(amount, token.decimals),
      exec: async () => {
        const { request } = await simulateContract(config, { connector: signer.connector, account: address, chainId, address: token.address as Address, abi: erc20Abi, functionName: "approve", args: [spender, amount] });
        return writeContract(config, request);
      },
    };
  };

  const addLiquidity = async () => {
    if (!protocol || !tokenA || !tokenB || !rawA || !rawB || !address || !signer) return;
    const deadline = deadlineFrom(Date.now() / 1000);
    const minA = withSlippage(rawA, newPool ? 0 : slippageBps), minB = withSlippage(rawB, newPool ? 0 : slippageBps);
    const nativeSide = tokenA.isNative || isNativeAddress(tokenA.address) ? "a" : tokenB.isNative || isNativeAddress(tokenB.address) ? "b" : null;
    const plan: Array<{ key: string; label: string; amount: string; exec: () => Promise<Hex> }> = [];
    try {
      const apA = await approvalStep(tokenA, rawA, protocol.router, "approve-a"); if (apA) plan.push(apA);
      const apB = await approvalStep(tokenB, rawB, protocol.router, "approve-b"); if (apB) plan.push(apB);
    } catch (err) { toast.error(describeSendError(err)); return; }
    plan.push({
      key: "add", label: newPool ? `Create pool ${tokenA.symbol}/${tokenB.symbol}` : `Add ${tokenA.symbol}/${tokenB.symbol} liquidity`, amount: `${formatTokenAmount(rawA, tokenA.decimals)} + ${formatTokenAmount(rawB, tokenB.decimals)}`,
      exec: async () => {
        if (nativeSide) {
          const token = nativeSide === "a" ? tokenB : tokenA; const tokenAmt = nativeSide === "a" ? rawB : rawA; const tokenMin = nativeSide === "a" ? minB : minA;
          const ethAmt = nativeSide === "a" ? rawA : rawB; const ethMin = nativeSide === "a" ? minA : minB;
          const { request } = await simulateContract(config, { connector: signer.connector, account: address, chainId, address: protocol.router, abi: routerAbi, functionName: "addLiquidityETH", args: [token.address as Address, tokenAmt, tokenMin, ethMin, address, deadline], value: ethAmt });
          return writeContract(config, request);
        }
        const { request } = await simulateContract(config, { connector: signer.connector, account: address, chainId, address: protocol.router, abi: routerAbi, functionName: "addLiquidity", args: [tokenA.address as Address, tokenB.address as Address, rawA, rawB, minA, minB, address, deadline] });
        return writeContract(config, request);
      },
    });
    const ok = await run(plan);
    if (ok) { toast.success(newPool ? "Pool created and liquidity added" : "Liquidity added"); setAmountA(""); setAmountB(""); void loadPair(); void loadPositions(); }
  };

  // ── Positions (LP tokens in the wallet) ──────────────────────────────────
  const loadPositions = useCallback(async () => {
    if (!protocol || !address) { setPositions([]); return; }
    const seen = new Set<string>();
    const lps = [...tokens.filter((t) => isLpSymbol(t.symbol) && t.rawBalance > BigInt(0)).map(toPoolToken), ...extraLps].filter((t) => !seen.has(t.address.toLowerCase()) && seen.add(t.address.toLowerCase()));
    if (!lps.length) { setPositions([]); return; }
    setPositionsLoading(true);
    try {
      const meta = await readContracts(config, { contracts: lps.flatMap((lp) => [
        { address: lp.address as Address, abi: pairAbi, functionName: "token0" as const, chainId },
        { address: lp.address as Address, abi: pairAbi, functionName: "token1" as const, chainId },
        { address: lp.address as Address, abi: pairAbi, functionName: "getReserves" as const, chainId },
        { address: lp.address as Address, abi: pairAbi, functionName: "totalSupply" as const, chainId },
      ]), allowFailure: true });
      const found: LpPosition[] = [];
      for (let i = 0; i < lps.length; i++) {
        const [t0, t1, rs, ts] = meta.slice(i * 4, i * 4 + 4);
        if (t0.status !== "success" || t1.status !== "success" || rs.status !== "success" || ts.status !== "success") continue;
        const token0 = t0.result as Address, token1 = t1.result as Address;
        const reserves = rs.result as readonly [bigint, bigint, number];
        const syms = await readContracts(config, { contracts: [
          { address: token0, abi: erc20Abi, functionName: "symbol" as const, chainId }, { address: token0, abi: erc20Abi, functionName: "decimals" as const, chainId },
          { address: token1, abi: erc20Abi, functionName: "symbol" as const, chainId }, { address: token1, abi: erc20Abi, functionName: "decimals" as const, chainId },
        ], allowFailure: true });
        const sym = (i2: number, fallback: string) => (syms[i2].status === "success" ? String(syms[i2].result) : fallback);
        found.push({ lp: lps[i], pair: { address: lp0(lps[i]), token0, token1, reserve0: BigInt(reserves[0]), reserve1: BigInt(reserves[1]), totalSupply: ts.result as bigint }, symbols: [sym(0, shortAddress(token0)), sym(2, shortAddress(token1))], decimals: [Number(syms[1].status === "success" ? syms[1].result : 18), Number(syms[3].status === "success" ? syms[3].result : 18)], balanceLp: lps[i].balance });
      }
      setPositions(found);
    } finally { setPositionsLoading(false); }
  }, [protocol, address, tokens, extraLps, config, chainId]);
  const lp0 = (t: PoolToken): Address => t.address as Address;

  const addLpByAddress = async () => {
    const addr = lpAddress.trim();
    if (!isAddress(addr) || !address) { toast.error("Enter a valid pool (LP token) address."); return; }
    try {
      const [symbol, decimals, balance] = await readContracts(config, { contracts: [
        { address: addr, abi: erc20Abi, functionName: "symbol", chainId },
        { address: addr, abi: erc20Abi, functionName: "decimals", chainId },
        { address: addr, abi: erc20Abi, functionName: "balanceOf", args: [address], chainId },
      ], allowFailure: false });
      if (balance <= BigInt(0)) { toast.info("This wallet holds none of that pool token."); return; }
      setExtraLps((prev) => [...prev.filter((t) => t.address.toLowerCase() !== addr.toLowerCase()), { address: addr, symbol, decimals: Number(decimals), isNative: false, balance }]);
      setLpAddress("");
    } catch { toast.error("That address does not answer like a pool token on this chain."); }
  };
  useEffect(() => { if (view === "remove") void loadPositions(); }, [view, loadPositions]);

  const removeLiquidity = async (pos: LpPosition) => {
    if (!protocol || !address || !signer) return;
    const lpAmount = (pos.balanceLp * BigInt(removePct)) / BigInt(100);
    if (lpAmount <= BigInt(0)) return;
    const { amount0, amount1 } = lpRemoveAmounts(lpAmount, pos.pair.totalSupply, pos.pair.reserve0, pos.pair.reserve1);
    const min0 = withSlippage(amount0, slippageBps), min1 = withSlippage(amount1, slippageBps);
    const deadline = deadlineFrom(Date.now() / 1000);
    const wrapped = protocol.wrappedNative.toLowerCase();
    const nativeIdx = pos.pair.token0.toLowerCase() === wrapped ? 0 : pos.pair.token1.toLowerCase() === wrapped ? 1 : -1;
    const plan: Array<{ key: string; label: string; amount: string; exec: () => Promise<Hex> }> = [];
    try { const ap = await approvalStep(pos.lp, lpAmount, protocol.router, "approve-lp"); if (ap) plan.push(ap); } catch (err) { toast.error(describeSendError(err)); return; }
    plan.push({
      key: "remove", label: `Remove ${removePct}% of ${pos.symbols[0]}/${pos.symbols[1]}`, amount: `${formatTokenAmount(amount0, pos.decimals[0])} ${pos.symbols[0]} + ${formatTokenAmount(amount1, pos.decimals[1])} ${pos.symbols[1]}`,
      exec: async () => {
        if (nativeIdx >= 0) {
          const token = nativeIdx === 0 ? pos.pair.token1 : pos.pair.token0; const tokenMin = nativeIdx === 0 ? min1 : min0; const ethMin = nativeIdx === 0 ? min0 : min1;
          const { request } = await simulateContract(config, { connector: signer.connector, account: address, chainId, address: protocol.router, abi: routerAbi, functionName: "removeLiquidityETH", args: [token, lpAmount, tokenMin, ethMin, address, deadline] });
          return writeContract(config, request);
        }
        const { request } = await simulateContract(config, { connector: signer.connector, account: address, chainId, address: protocol.router, abi: routerAbi, functionName: "removeLiquidity", args: [pos.pair.token0, pos.pair.token1, lpAmount, min0, min1, address, deadline] });
        return writeContract(config, request);
      },
    });
    const ok = await run(plan);
    if (ok) { toast.success("Liquidity removed"); setSelectedLp(null); void loadPositions(); }
  };

  const TokenPicker = ({ label, value, onPick }: { label: string; value: PoolToken | null; onPick: (t: PoolToken) => void }) => (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" aria-label={label} className="flex min-h-10 w-full items-center gap-2 rounded-lg border border-border/60 bg-foreground/[0.05] px-3 text-left text-xs text-foreground transition-[background-color,border-color] duration-200 hover:border-border hover:bg-foreground/[0.08] focus-visible:border-brand-accent/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-accent/40">
          {value ? (<><TokenIcon address={value.address} chainId={chainId} symbol={value.symbol} logo={value.logo} size={18} /><span className="font-semibold">{value.symbol}</span><span className="min-w-0 truncate text-muted-foreground">{formatTokenAmount(value.balance, value.decimals)}</span></>) : <span className="text-muted-foreground">{label}</span>}
          <FiChevronDown className="ml-auto h-3 w-3 shrink-0 text-muted-foreground" aria-hidden="true" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className={menuContent}>
        {candidates.map((t) => (
          <DropdownMenuItem key={t.address} onSelect={() => onPick(t)} className="min-h-9 gap-2 rounded-lg px-2.5 text-xs">
            <TokenIcon address={t.address} chainId={chainId} symbol={t.symbol} logo={t.logo} size={16} /><span className="font-semibold">{t.symbol}</span><span className="min-w-0 flex-1 truncate text-muted-foreground">{formatTokenAmount(t.balance, t.decimals)}</span>
          </DropdownMenuItem>
        ))}
        {!candidates.length && <p className="px-2.5 py-2 text-[11px] text-muted-foreground">No tokens in this wallet yet; enter one by address below.</p>}
      </DropdownMenuContent>
    </DropdownMenu>
  );

  if (!protocols.length) {
    return <p className={cn("rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-800 dark:text-amber-200", className)}>Liquidity pools are available on Ethereum (Uniswap V2) and PulseChain (PulseX). Switch your wallet to one of them.</p>;
  }

  return (
    <section className={cn("space-y-3", className)} aria-label="Liquidity">
      <header className="flex flex-wrap items-center gap-2">
        <div role="tablist" aria-label="Liquidity action" className="flex items-center gap-0.5 rounded-full border border-border/60 bg-foreground/[0.04] p-0.5">
          {(["add", "remove"] as const).map((v) => (
            <button key={v} type="button" role="tab" aria-selected={view === v} onClick={() => setView(v)} className={cn("min-h-7 rounded-full px-3 text-[11px] font-semibold uppercase tracking-wider transition-[background-color,color] duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring", view === v ? "bg-brand-accent/15 text-brand-accent-hover dark:text-brand-accent-light" : "text-muted-foreground hover:text-foreground")}>{v === "add" ? "Add / create" : "Remove"}</button>
          ))}
        </div>
        {protocols.length > 1 && (
          <div role="group" aria-label="Protocol" className="flex items-center gap-1">
            {protocols.map((p) => <button key={p.id} type="button" onClick={() => setProtocolId(p.id)} aria-pressed={protocol?.id === p.id} className={cn(chip, protocol?.id === p.id && chipOn)}>{p.name}</button>)}
          </div>
        )}
        <span className="ml-auto text-[11px] text-muted-foreground">{protocol?.name} · {chainName}</span>
      </header>

      {address && !signer && <p className="rounded-xl border border-border/60 bg-foreground/[0.03] p-3 text-xs text-muted-foreground">Read-only: the wallet holding {shortAddress(address)} is not connected in this browser.</p>}

      {view === "add" ? (
        <div className="space-y-3 rounded-xl border border-border/60 bg-foreground/[0.03] p-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="space-y-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Token A</span>
              <TokenPicker label="Pick token A" value={tokenA} onPick={(t) => { setTokenA(t); setAmountA(""); setAmountB(""); }} />
              <input value={amountA} onChange={(e) => { setLastEdited("a"); setAmountA(e.target.value); }} inputMode="decimal" placeholder="0.0" className={field} disabled={!tokenA} aria-invalid={Boolean(amountA) && !rawA} />
              <button type="button" disabled={!tokenA} onClick={() => tokenA && (setLastEdited("a"), setAmountA(formatUnits(tokenA.balance, tokenA.decimals)))} className={cn(chip, "min-h-7")}>Max</button>
            </label>
            <label className="space-y-1.5">
              <span className="text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">Token B</span>
              <TokenPicker label="Pick token B" value={tokenB} onPick={(t) => { setTokenB(t); setAmountB(""); }} />
              <input value={amountB} onChange={(e) => { setLastEdited("b"); setAmountB(e.target.value); }} inputMode="decimal" placeholder="0.0" className={field} disabled={!tokenB} aria-invalid={Boolean(amountB) && !rawB} />
              <button type="button" disabled={!tokenB} onClick={() => tokenB && (setLastEdited("b"), setAmountB(formatUnits(tokenB.balance, tokenB.decimals)))} className={cn(chip, "min-h-7")}>Max</button>
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <input value={customAddress} onChange={(e) => setCustomAddress(e.target.value)} placeholder="Any token by contract address 0x…" aria-label="Token contract address" className={cn(field, "h-9 min-w-[16rem] flex-1 font-mono text-[11px]")} />
            <button type="button" onClick={() => void addCustom("a")} className={cn(chip, "min-h-9")}>Use as A</button>
            <button type="button" onClick={() => void addCustom("b")} className={cn(chip, "min-h-9")}>Use as B</button>
          </div>
          {tokenA && tokenB && (
            <div className="space-y-1 text-[11px] text-muted-foreground">
              {pairLoading ? <p>Looking up the pool…</p> : newPool ? (
                <p role="note" className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-amber-800 dark:text-amber-200"><FiAlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />No {tokenA.symbol}/{tokenB.symbol} pool on {protocol?.name} yet. Your amounts create it and set its starting price; anyone can then trade against it.</p>
              ) : pair ? (
                <p>Pool <a href={getExplorerTxUrl(chainId, "").replace("/tx/", "/address/") + pair.address} target="_blank" rel="noopener noreferrer" className="font-mono underline-offset-2 hover:underline">{shortAddress(pair.address)}</a> · reserves {formatTokenAmount(reservesFor(tokenA)?.mine ?? BigInt(0), tokenA.decimals)} {tokenA.symbol} / {formatTokenAmount(reservesFor(tokenB)?.mine ?? BigInt(0), tokenB.decimals)} {tokenB.symbol}</p>
              ) : null}
              {priceLabel && <p className="text-foreground">{priceLabel}</p>}
              {shareAfter !== null && <p>Your share after this: <span className="tabular-nums text-foreground">{shareAfter.toFixed(shareAfter < 1 ? 4 : 2)}%</span></p>}
            </div>
          )}
          <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
            <span>Slippage</span>
            {[10, 50, 100, 300].map((bps) => <button key={bps} type="button" onClick={() => setSlippageBps(bps)} aria-pressed={slippageBps === bps} className={cn(chip, "min-h-7", slippageBps === bps && chipOn)}>{bps / 100}%</button>)}
            <span className="ml-auto">Deadline 20 min</span>
          </div>
          <SendProgress steps={steps} />
          <button type="button" onClick={() => void addLiquidity()} disabled={busy || !signer || !tokenA || !tokenB || !rawA || !rawB || pairLoading || pair === null} className={primary}>
            {busy ? "Confirm in your wallet…" : newPool ? "Create pool with wallet" : "Add liquidity with wallet"}
          </button>
          <p className="text-[10px] leading-relaxed text-muted-foreground">Approvals come first when the router needs them, then one router call; each is simulated before your wallet is asked. Slippage sets the minimum the router may settle at.</p>
        </div>
      ) : (
        <div className="space-y-3 rounded-xl border border-border/60 bg-foreground/[0.03] p-3">
          <div className="flex items-center justify-between">
            <p className="text-[11px] text-muted-foreground">Pool tokens ({protocol?.lpSymbol}) found in this wallet on {chainName}.</p>
            <button type="button" onClick={() => void loadPositions()} disabled={positionsLoading} aria-label="Refresh positions" className="grid size-8 place-items-center rounded-lg border border-border/60 text-muted-foreground hover:bg-foreground/[0.06] hover:text-foreground disabled:opacity-50"><FiRefreshCw className={cn("h-3.5 w-3.5", positionsLoading && "motion-safe:animate-spin")} /></button>
          </div>
          <div className="flex items-center gap-1.5">
            <input value={lpAddress} onChange={(e) => setLpAddress(e.target.value)} placeholder="Pool (LP token) address 0x… for a position not listed" aria-label="Pool token address" className={cn(field, "h-9 font-mono text-[11px]")} />
            <button type="button" onClick={() => void addLpByAddress()} className={cn(chip, "min-h-9 shrink-0")}>Load</button>
          </div>
          {positionsLoading && !positions.length && <div role="status" aria-label="Loading positions" className="h-20 rounded-xl bg-foreground/[0.04] motion-safe:animate-pulse" />}
          {!positionsLoading && !positions.length && <p className="rounded-xl border border-border/60 bg-card/60 p-3 text-xs text-muted-foreground">No pool tokens in this wallet. Positions show up here once the inventory has discovered their LP tokens.</p>}
          {positions.map((pos) => {
            const share = poolSharePct(pos.balanceLp, pos.pair.totalSupply);
            const { amount0, amount1 } = lpRemoveAmounts(pos.balanceLp, pos.pair.totalSupply, pos.pair.reserve0, pos.pair.reserve1);
            const open = selectedLp === pos.lp.address;
            return (
              <article key={pos.lp.address} className="rounded-xl border border-border/60 bg-card/60 p-3 text-xs">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-semibold text-foreground">{pos.symbols[0]}/{pos.symbols[1]}</span>
                  <span className="text-muted-foreground">{formatTokenAmount(pos.balanceLp, pos.lp.decimals)} {pos.lp.symbol} · {share.toFixed(share < 1 ? 4 : 2)}% of the pool</span>
                  <button type="button" onClick={() => setSelectedLp(open ? null : pos.lp.address)} className={cn(chip, "ml-auto min-h-7", open && chipOn)}>{open ? "Close" : "Remove…"}</button>
                </div>
                <p className="mt-1 text-muted-foreground">Worth {formatTokenAmount(amount0, pos.decimals[0])} {pos.symbols[0]} + {formatTokenAmount(amount1, pos.decimals[1])} {pos.symbols[1]}</p>
                {open && (
                  <div className="mt-2 space-y-2 border-t border-border/50 pt-2">
                    <div className="flex flex-wrap items-center gap-1.5"><span className="text-muted-foreground">Remove</span>{[25, 50, 75, 100].map((p) => <button key={p} type="button" onClick={() => setRemovePct(p)} aria-pressed={removePct === p} className={cn(chip, "min-h-7", removePct === p && chipOn)}>{p}%</button>)}</div>
                    <SendProgress steps={steps} />
                    <button type="button" onClick={() => void removeLiquidity(pos)} disabled={busy || !signer} className={primary}>{busy ? "Confirm in your wallet…" : `Remove ${removePct}% with wallet`}</button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
