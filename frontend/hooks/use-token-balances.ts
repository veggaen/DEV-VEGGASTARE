"use client";

import { useCallback, useEffect, useState, useRef } from "react";
import { useAccount, useChainId, useBalance } from "wagmi";
import { formatUnits } from "viem";
import { useActiveWalletOverride } from "@/contexts/active-wallet-context";
import { TOKEN_LOGO_FALLBACKS } from "@/lib/token-icons";
import { rpcUrlFor } from "@/lib/evm-rpc";
import { BLOCKSCOUT_HOSTS, mergeTokenCandidates, type DiscoveredToken, type TokenCandidate } from "@/lib/wallet-tokens";
import { GECKO_NETWORKS } from "@/lib/token-prices";
import { assessToken, valueCounts, type GoPlusSecurity, type HoneypotVerdict, type TokenRisk } from "@/lib/token-risk";
import { TRUSTED_TOKENS_EVENT, readFlaggedTokens, readTrustedTokens, trustedTokenKey } from "@/lib/trusted-tokens";

/** The verdict for one inventory token given the user's current flags. */
function assessInventoryToken(t: InventoryToken, flagged: Set<string>): TokenRisk {
  return assessToken({
    isNative: t.isNative,
    isKnown: t.known,
    flaggedByUser: flagged.has(trustedTokenKey(t.chainId, t.address)),
    goplus: t.security ?? null,
    honeypot: t.honeypot ?? null,
    liquidityUsd: t.liquidityUsd,
    volume24hUsd: t.volume24hUsd,
    hasPrice: t.usdPrice !== undefined,
  });
}
const HONEYPOT_CHAINS = new Set([1, 56, 8453]);
const HONEYPOT_TTL = 6 * 60 * 60_000;

/** Chain icon data URIs — simple coloured circles with chain abbreviation */
export const CHAIN_LOGOS: Record<number, string> = {
  1: TOKEN_LOGO_FALLBACKS.ETH,
  11155111: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Ccircle cx='16' cy='16' r='16' fill='%23627EEA' fill-opacity='0.5'/%3E%3Ctext x='16' y='20' text-anchor='middle' font-size='8' fill='white' font-family='Arial'%3ESEP%3C/text%3E%3C/svg%3E",
  8453: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Ccircle cx='16' cy='16' r='16' fill='%230052FF'/%3E%3Ctext x='16' y='20' text-anchor='middle' font-size='10' font-weight='bold' fill='white' font-family='Arial'%3EB%3C/text%3E%3C/svg%3E",
  84532: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Ccircle cx='16' cy='16' r='16' fill='%230052FF' fill-opacity='0.5'/%3E%3Ctext x='16' y='20' text-anchor='middle' font-size='7' fill='white' font-family='Arial'%3EBSep%3C/text%3E%3C/svg%3E",
  369: TOKEN_LOGO_FALLBACKS.PLS,
  137: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Ccircle cx='16' cy='16' r='16' fill='%238247E5'/%3E%3Ctext x='16' y='20' text-anchor='middle' font-size='8' font-weight='bold' fill='white' font-family='Arial'%3EMAT%3C/text%3E%3C/svg%3E",
  42161: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Ccircle cx='16' cy='16' r='16' fill='%2328A0F0'/%3E%3Ctext x='16' y='20' text-anchor='middle' font-size='8' font-weight='bold' fill='white' font-family='Arial'%3EARB%3C/text%3E%3C/svg%3E",
  10: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Ccircle cx='16' cy='16' r='16' fill='%23FF0420'/%3E%3Ctext x='16' y='20' text-anchor='middle' font-size='8' font-weight='bold' fill='white' font-family='Arial'%3EOP%3C/text%3E%3C/svg%3E",
  31337: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Ccircle cx='16' cy='16' r='16' fill='%23F97316'/%3E%3Ctext x='16' y='20' text-anchor='middle' font-size='7' font-weight='bold' fill='white' font-family='Arial'%3EANV%3C/text%3E%3C/svg%3E",
  1337: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'%3E%3Ccircle cx='16' cy='16' r='16' fill='%23E4A663'/%3E%3Ctext x='16' y='20' text-anchor='middle' font-size='7' font-weight='bold' fill='white' font-family='Arial'%3EGAN%3C/text%3E%3C/svg%3E",
};

/**
 * Resolve a token logo — returns only data-URI logos that are known
 * to be high-quality.  Returns undefined for everything else so that
 * TokenIcon can cascade to Trust Wallet CDN (real logos for 6000+ tokens)
 * before falling back to generated letter icons.
 */
function resolveTokenLogo(_symbol: string, providedLogo?: string): string | undefined {
  // Honour pre-resolved data URIs and the indexer's https logos (CoinGecko-backed)
  if (providedLogo?.startsWith("data:") || providedLogo?.startsWith("https://")) return providedLogo;
  // Return undefined — let TokenIcon cascade:
  //   Trust Wallet CDN → inline SVG fallback → generated letter
  return undefined;
}

// Well-known ERC-20 tokens per chain
export const KNOWN_TOKENS: Record<number, TokenMeta[]> = {
  // Ethereum Mainnet
  1: [
    { address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", symbol: "USDC", decimals: 6 },
    { address: "0xdAC17F958D2ee523a2206206994597C13D831ec7", symbol: "USDT", decimals: 6 },
    { address: "0x2b591e99afE9f32eAA6214f7B7629768c40Eeb39", symbol: "HEX", decimals: 8 },
    { address: "0x6B175474E89094C44Da98b954EedeAC495271d0F", symbol: "DAI", decimals: 18 },
    { address: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", symbol: "WBTC", decimals: 8 },
    { address: "0x514910771AF9Ca656af840dff83E8264EcF986CA", symbol: "LINK", decimals: 18 },
    { address: "0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984", symbol: "UNI", decimals: 18 },
  ],
  // PulseChain
  369: [
    { address: "0x2b591e99afE9f32eAA6214f7B7629768c40Eeb39", symbol: "HEX", decimals: 8 },
    { address: "0x0Cb6F5a34ad42ec934882A05265A7d5F59b51A2f", symbol: "USDT", decimals: 6 },
    { address: "0x15D38573d2feeb82e7ad5187aB8c1D52810B1f07", symbol: "USDC", decimals: 6 },
    { address: "0xefD766cCb38EaF1dfd701853BFCe31359239F305", symbol: "DAI", decimals: 18 },
  ],
  // Arbitrum One
  42161: [
    { address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", symbol: "USDC", decimals: 6 },
    { address: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9", symbol: "USDT", decimals: 6 },
    { address: "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1", symbol: "DAI", decimals: 18 },
    { address: "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f", symbol: "WBTC", decimals: 8 },
    { address: "0x912CE59144191C1204E64559FE8253a0e49E6548", symbol: "ARB", decimals: 18 },
  ],
  // Polygon
  137: [
    { address: "0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174", symbol: "USDC", decimals: 6 },
    { address: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F", symbol: "USDT", decimals: 6 },
    { address: "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063", symbol: "DAI", decimals: 18 },
    { address: "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619", symbol: "WETH", decimals: 18 },
  ],
  // Optimism
  10: [
    { address: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85", symbol: "USDC", decimals: 6 },
    { address: "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58", symbol: "USDT", decimals: 6 },
    { address: "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1", symbol: "DAI", decimals: 18 },
    { address: "0x4200000000000000000000000000000000000042", symbol: "OP", decimals: 18 },
  ],
  // Base
  8453: [
    { address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", symbol: "USDC", decimals: 6 },
    { address: "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb", symbol: "DAI", decimals: 18 },
  ],
  // Sepolia
  11155111: [
    { address: "0x1c7D4B196Cb0C7B01d743Fbc6116a902379C7238", symbol: "USDC", decimals: 6 },
  ],
  // Base Sepolia
  84532: [],
  // Local chains (Anvil / Ganache) — populate after deploying mock ERC-20s
  // Run `scripts/deploy-mock-tokens.ts` to deploy and get addresses, then add here.
  // Example after deployment:
  //   { address: "0x...", symbol: "USDC", decimals: 6 },
  //   { address: "0x...", symbol: "USDT", decimals: 6 },
  //   { address: "0x...", symbol: "DAI", decimals: 18 },
  31337: [],
  1337: [],
};

export interface TokenMeta {
  address: string;
  symbol: string;
  decimals: number;
  logo?: string;
}

export interface InventoryToken {
  /** Unique slot key — `${chainId}:${address}` or `${chainId}:native` */
  id: string;
  address: string; // "0x0" for native
  symbol: string;
  decimals: number;
  logo?: string;
  chainId: number;
  rawBalance: bigint;
  displayBalance: string;
  isNative: boolean;
  /** USD per whole token when a price is known (indexer); native coins are priced by the caller. */
  usdPrice?: number;
  /** DEX reserve and 24 h volume in USD (GeckoTerminal), when known. */
  liquidityUsd?: number;
  volume24hUsd?: number;
  /** Contract red flags from GoPlus, when the chain is covered. */
  security?: GoPlusSecurity;
  /** Honeypot.is sale simulation, when the chain is covered and the token was worth checking. */
  honeypot?: HoneypotVerdict;
  /** On the chain's known list (USDC, HEX, …). */
  known?: boolean;
  /** The risk verdict built from the above. */
  risk?: TokenRisk;
  /** False when the price must not count toward totals (risky token the user has not trusted). */
  valueVerified?: boolean;
}

/** What makes a published list "different": a new stack, a new balance, a new price, or a new verdict. */
const signatureOf = (list: InventoryToken[]) =>
  list.map((t) => `${t.id}:${t.rawBalance}:${t.usdPrice ?? ""}:${t.risk?.level ?? ""}:${t.valueVerified === false ? 0 : 1}`).join("|");

/**
 * Fetches native + ERC-20 token balances for the connected wallet.
 * Uses viem multicall under the hood via wagmi's useBalance.
 *
 * Supports ActiveWalletOverride — when a LOCAL_RPC wallet is active,
 * fetches balances via direct RPC instead of wagmi.
 *
 * Polls every 12 seconds for balance updates.
 */
const POLL_INTERVAL = 12_000;
const DISCOVERY_TTL = 60_000;
const SECURITY_TTL = 15 * 60_000;

export function useTokenBalances() {
  const { address: wagmiAddress, isConnected: wagmiConnected } = useAccount();
  const wagmiChainId = useChainId();
  const { override } = useActiveWalletOverride();
  const [tokens, setTokensState] = useState<InventoryToken[]>([]);
  /** True until the first read for this wallet/chain completes. */
  const [loading, setLoading] = useState(false);
  /** True while a background poll is in flight; the list stays as it is meanwhile. */
  const [refreshing, setRefreshing] = useState(false);
  // Same content → same array. A poll that finds nothing new must not rebuild
  // the inventory (split stacks, drags in progress and the trade grid all key
  // off the token array's identity).
  const signatureRef = useRef<string>("");
  // Stacks keep their positions: existing ids stay in their previous order and
  // only new ids are appended, so a price tick updates numbers in place instead
  // of re-sorting the grid (which remounts every cell that moved).
  const orderRef = useRef<Map<string, number>>(new Map());
  const setTokens = useCallback((next: InventoryToken[]) => {
    const order = orderRef.current;
    const stable = order.size === 0 ? next : [...next].sort((a, b) => {
      const ia = order.get(a.id), ib = order.get(b.id);
      if (ia !== undefined && ib !== undefined) return ia - ib;
      if (ia !== undefined) return -1;
      if (ib !== undefined) return 1;
      return 0;
    });
    const signature = signatureOf(stable);
    if (signature === signatureRef.current) return;
    signatureRef.current = signature;
    orderRef.current = new Map(stable.map((t, i) => [t.id, i]));
    setTokensState(stable);
  }, []);
  const [error, setError] = useState<string | null>(null);
  /** Flagged tokens the user chose to count anyway (localStorage); changes apply without a refetch. */
  const trustedRef = useRef<Set<string>>(new Set());
  const flaggedRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    const apply = () => {
      trustedRef.current = readTrustedTokens();
      flaggedRef.current = readFlaggedTokens();
      setTokensState((prev) => {
        const next = prev.map((t) => {
          const risk = assessInventoryToken(t, flaggedRef.current);
          return { ...t, risk, valueVerified: valueCounts(risk.level, trustedRef.current.has(trustedTokenKey(t.chainId, t.address))) };
        });
        signatureRef.current = signatureOf(next);
        return next;
      });
    };
    trustedRef.current = readTrustedTokens();
    flaggedRef.current = readFlaggedTokens();
    window.addEventListener(TRUSTED_TOKENS_EVENT, apply);
    return () => window.removeEventListener(TRUSTED_TOKENS_EVENT, apply);
  }, []);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Version counter to prevent stale async results from overwriting newer ones
  const fetchVersionRef = useRef(0);
  // Consecutive complete failures. One slow indexer + one RPC hiccup is "still
  // reading", not a failure the user has to act on.
  const failStreakRef = useRef(0);
  // Discovery is indexed data that lags anyway; ask the indexer at most once a
  // minute per wallet/chain and reuse the list between the 12 s balance polls.
  const discoveryRef = useRef<{ key: string; ts: number; tokens: DiscoveredToken[] } | null>(null);
  // DEX prices (GeckoTerminal via our route) for stacks the indexer left unpriced; a minute is plenty.
  const pricesRef = useRef<{ key: string; ts: number; asked: Set<string>; prices: Record<string, number>; liquidity: Record<string, number>; volume: Record<string, number>; native: number | null } | null>(null);
  // GoPlus contract flags; a quarter of an hour is plenty, they rarely change.
  const securityRef = useRef<{ key: string; ts: number; asked: Set<string>; tokens: Record<string, GoPlusSecurity> } | null>(null);
  // Honeypot.is sale simulations; six hours, only for tokens that could inflate the total.
  const honeypotRef = useRef<{ key: string; ts: number; asked: Set<string>; tokens: Record<string, HoneypotVerdict> } | null>(null);

  // Determine effective address / chain / connection status
  const isLocalOverride = Boolean(override?.address);
  const address = isLocalOverride ? (override!.address as `0x${string}`) : wagmiAddress;
  const chainId = isLocalOverride ? override!.chainId : wagmiChainId;
  const isConnected = isLocalOverride ? true : wagmiConnected;

  // Native balance (ETH / PLS etc) — only used when NOT overridden
  const { data: nativeBalance, refetch: refetchNative } = useBalance({
    address: isLocalOverride ? undefined : wagmiAddress,
    query: { enabled: !isLocalOverride && wagmiConnected },
  });

  const walletKeyRef = useRef("");
  const fetchBalances = useCallback(async () => {
    if (!address || !isConnected || !chainId) return;
    const walletKey = `${chainId}:${address.toLowerCase()}`;
    if (walletKeyRef.current !== walletKey) { walletKeyRef.current = walletKey; signatureRef.current = ""; orderRef.current = new Map(); }

    // Increment version — any older in-flight fetch becomes stale
    const version = ++fetchVersionRef.current;

    if (!signatureRef.current) setLoading(true);
    setRefreshing(true);
    setError(null);

    try {
      const knownTokens = KNOWN_TOKENS[chainId] ?? [];
      const results: InventoryToken[] = [];

      // ── Native balance ──────────────────────────────────
      if (isLocalOverride && override?.rpcUrl) {
        // Fetch via direct RPC for LOCAL_RPC wallets
        try {
          const resp = await fetch(override.rpcUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              jsonrpc: "2.0",
              id: 1,
              method: "eth_getBalance",
              params: [address, "latest"],
            }),
          });
          const data = await resp.json() as { result?: string };
          if (data.result) {
            const raw = BigInt(data.result);
            if (raw > BigInt(0)) {
              results.push({
                id: `${chainId}:native`,
                address: "0x0000000000000000000000000000000000000000",
                symbol: "ETH",
                decimals: 18,
                logo: resolveTokenLogo("ETH"),
                chainId,
                rawBalance: raw,
                displayBalance: formatBalance(formatUnits(raw, 18)),
                isNative: true,
              });
            }
          }
        } catch (err) {
          console.warn("[useTokenBalances] RPC balance fetch failed:", err);
        }
      } else if (nativeBalance) {
        // Use wagmi's cached balance
        const raw = nativeBalance.value;
        if (raw > BigInt(0)) {
          results.push({
            id: `${chainId}:native`,
            address: "0x0000000000000000000000000000000000000000",
            symbol: nativeBalance.symbol,
            decimals: nativeBalance.decimals,
            logo: resolveTokenLogo(nativeBalance.symbol),
            chainId,
            rawBalance: raw,
            displayBalance: formatBalance(formatUnits(raw, nativeBalance.decimals)),
            isNative: true,
          });
        }
      }

      // ── ERC-20s, two passes ──────────────────────────────
      // 1. The known list is read over RPC first: fast, so the common
      //    tokens show immediately.
      // 2. Blockscout (keyless) then reports everything else the wallet
      //    holds; those are confirmed over RPC too, with the indexed value
      //    as the per-token fallback. A failed read is reported, not "0".
      let rpcFailed = false;
      const readBalances = async (candidates: TokenCandidate[]) => {
        const confirmed = new Map<string, bigint>();
        if (candidates.length === 0) return confirmed;
        try {
          const { createPublicClient, http, erc20Abi } = await import("viem");
          const { mainnet, sepolia, base, baseSepolia, arbitrum, polygon, optimism, pulsechain } = await import("viem/chains");
          type ChainDef = Parameters<typeof createPublicClient>[0]["chain"];
          const local = (id: number, name: string, url: string) => ({
            id, name, nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 }, rpcUrls: { default: { http: [url] } },
          }) as ChainDef;
          const chainMap: Record<number, ChainDef> = {
            1: mainnet, 42161: arbitrum, 137: polygon, 10: optimism, 11155111: sepolia, 8453: base, 84532: baseSepolia,
            369: pulsechain,
            31337: local(31337, "Anvil Local", "http://127.0.0.1:8545"),
            1337: local(1337, "Ganache Local", "http://127.0.0.1:7545"),
          };
          const chain = chainMap[chainId];
          if (!chain) return confirmed;
          const client = createPublicClient({ chain, transport: http(rpcUrlFor(chainId)) });
          const contracts = candidates.map((t) => ({
            address: t.address as `0x${string}`,
            abi: erc20Abi,
            functionName: "balanceOf" as const,
            args: [address] as const,
          }));
          // Local dev chains have no Multicall3; read one by one there.
          const results = chain.contracts?.multicall3
            ? await client.multicall({ contracts })
            : await Promise.all(contracts.map((c) => client.readContract(c).then(
                (result) => ({ status: "success" as const, result }),
                (error: unknown) => ({ status: "failure" as const, error }),
              )));
          for (let i = 0; i < candidates.length; i++) {
            const result = results[i];
            if (result.status === "success" && typeof result.result === "bigint") {
              confirmed.set(candidates[i].address.toLowerCase(), result.result);
            }
          }
        } catch (erc20Err) {
          rpcFailed = true;
          console.warn("[useTokenBalances] ERC-20 multicall failed (indexed balances still shown):", erc20Err);
        }
        return confirmed;
      };
      const pushConfirmed = (candidates: TokenCandidate[], confirmed: Map<string, bigint>) => {
        for (const token of candidates) {
          const raw = confirmed.get(token.address.toLowerCase()) ?? token.indexedBalance ?? BigInt(0);
          if (raw <= BigInt(0)) continue;
          results.push({
            id: `${chainId}:${token.address}`,
            address: token.address,
            symbol: token.symbol,
            decimals: token.decimals,
            logo: resolveTokenLogo(token.symbol, token.logo),
            chainId,
            rawBalance: raw,
            displayBalance: formatBalance(formatUnits(raw, token.decimals)),
            isNative: false,
            usdPrice: token.indexedUsdRate,
          });
        }
      };
      // Native first, then by USD value (priced stacks before unpriced), then by raw amount.
      const usdOf = (t: InventoryToken) => (t.usdPrice ? Number(formatUnits(t.rawBalance, t.decimals)) * t.usdPrice : -1);
      const byValue = (a: InventoryToken, b: InventoryToken) => {
        if (a.isNative !== b.isNative) return a.isNative ? -1 : 1;
        const ua = usdOf(a), ub = usdOf(b);
        if (ua !== ub) return ub - ua;
        return b.rawBalance > a.rawBalance ? 1 : b.rawBalance < a.rawBalance ? -1 : 0;
      };

      // Pass 1: the known list, shown as soon as it is read. Only on the first
      // read for this wallet: on later polls the short list would replace the
      // full one for a moment and every cell would remount.
      const known = mergeTokenCandidates(knownTokens, []);
      pushConfirmed(known, await readBalances(known));
      if (version !== fetchVersionRef.current) return;
      if (!signatureRef.current) setTokens([...results].sort(byValue));

      // Pass 2: what the indexer knows beyond the list.
      let indexerFailed = false;
      if (!isLocalOverride && BLOCKSCOUT_HOSTS[chainId]) {
        try {
          const cacheKey = `${chainId}:${address.toLowerCase()}`;
          const cached = discoveryRef.current;
          let discovered: DiscoveredToken[];
          if (cached && cached.key === cacheKey && Date.now() - cached.ts < DISCOVERY_TTL) {
            discovered = cached.tokens;
          } else {
            const res = await fetch(`/api/wallets/evm/tokens?chainId=${chainId}&address=${address}`, { signal: AbortSignal.timeout(25_000) });
            if (!res.ok) throw new Error(`indexer ${res.status}`);
            const data = (await res.json()) as { tokens?: DiscoveredToken[] };
            discovered = data.tokens ?? [];
            discoveryRef.current = { key: cacheKey, ts: Date.now(), tokens: discovered };
          }
          const seen = new Set(known.map((t) => t.address.toLowerCase()));
          const merged = mergeTokenCandidates(knownTokens, discovered);
          // The known list was read before discovery: give those stacks the indexer's price now.
          const priceOf = new Map(merged.filter((t) => t.indexedUsdRate).map((t) => [t.address.toLowerCase(), t.indexedUsdRate as number]));
          for (const token of results) {
            if (!token.isNative && token.usdPrice === undefined) {
              const price = priceOf.get(token.address.toLowerCase());
              if (price) token.usdPrice = price;
            }
          }
          const extra = merged.filter((t) => !seen.has(t.address.toLowerCase()));
          if (version !== fetchVersionRef.current) return;
          pushConfirmed(extra, await readBalances(extra));
        } catch (indexErr) {
          indexerFailed = true;
          console.warn("[useTokenBalances] token discovery unavailable (known list only):", indexErr);
        }
      }
      // Pass 3: DEX prices for whatever is still unpriced, native coin included.
      // PulseChain and most long-tail tokens have no indexer rate, so without
      // this the inventory shows amounts but no values there.
      if (!isLocalOverride && GECKO_NETWORKS[chainId]) {
        try {
          const cacheKey = `${chainId}:${address.toLowerCase()}`;
          const unpriced = results.filter((t) => !t.isNative && t.usdPrice === undefined).map((t) => t.address.toLowerCase());
          const cached = pricesRef.current;
          let quotes = cached && cached.key === cacheKey && Date.now() - cached.ts < DISCOVERY_TTL ? cached : null;
          if (!quotes || unpriced.some((a) => !quotes!.asked.has(a))) {
            const res = await fetch(`/api/wallets/evm/prices?chainId=${chainId}&addresses=${unpriced.slice(0, 90).join(",")}`, { signal: AbortSignal.timeout(15_000) });
            if (!res.ok) throw new Error(`prices ${res.status}`);
            const data = (await res.json()) as { prices?: Record<string, number>; liquidity?: Record<string, number>; volume24h?: Record<string, number>; native?: number | null };
            quotes = {
              key: cacheKey,
              ts: Date.now(),
              asked: new Set([...(quotes?.asked ?? []), ...unpriced]),
              prices: { ...(quotes?.prices ?? {}), ...(data.prices ?? {}) },
              liquidity: { ...(quotes?.liquidity ?? {}), ...(data.liquidity ?? {}) },
              volume: { ...(quotes?.volume ?? {}), ...(data.volume24h ?? {}) },
              native: data.native ?? quotes?.native ?? null,
            };
            pricesRef.current = quotes;
          }
          if (version !== fetchVersionRef.current) return;
          for (const token of results) {
            if (token.isNative) { if (quotes.native) token.usdPrice = quotes.native; continue; }
            const key = token.address.toLowerCase();
            if (token.usdPrice === undefined) { const p = quotes.prices[key]; if (p) token.usdPrice = p; }
            if (key in quotes.liquidity) token.liquidityUsd = quotes.liquidity[key];
            if (key in quotes.volume) token.volume24hUsd = quotes.volume[key];
          }
        } catch (priceErr) {
          console.warn("[useTokenBalances] DEX prices unavailable:", priceErr);
        }
      }

      // Pass 4: contract red flags (GoPlus) on the chains it covers.
      if (!isLocalOverride) {
        try {
          const cacheKey = `${chainId}:${address.toLowerCase()}`;
          const erc20s = results.filter((t) => !t.isNative).map((t) => t.address.toLowerCase());
          const cached = securityRef.current;
          let sec = cached && cached.key === cacheKey && Date.now() - cached.ts < SECURITY_TTL ? cached : null;
          if (erc20s.length && (!sec || erc20s.some((a) => !sec!.asked.has(a)))) {
            const res = await fetch(`/api/wallets/evm/security?chainId=${chainId}&addresses=${erc20s.slice(0, 120).join(",")}`, { signal: AbortSignal.timeout(15_000) });
            if (!res.ok) throw new Error(`security ${res.status}`);
            const data = (await res.json()) as { tokens?: Record<string, GoPlusSecurity> };
            sec = { key: cacheKey, ts: Date.now(), asked: new Set([...(sec?.asked ?? []), ...erc20s]), tokens: { ...(sec?.tokens ?? {}), ...(data.tokens ?? {}) } };
            securityRef.current = sec;
          }
          if (version !== fetchVersionRef.current) return;
          for (const token of results) if (!token.isNative) token.security = sec?.tokens[token.address.toLowerCase()] ?? token.security;
        } catch (secErr) {
          console.warn("[useTokenBalances] token security unavailable:", secErr);
        }
      }

      const knownAddrs = new Set(knownTokens.map((t) => t.address.toLowerCase()));
      for (const token of results) token.known = knownAddrs.has(token.address.toLowerCase());

      // Pass 5: Honeypot.is sale simulation for priced, unknown tokens (the ones that could inflate the total).
      if (!isLocalOverride && HONEYPOT_CHAINS.has(chainId)) {
        try {
          const cacheKey = `${chainId}:${address.toLowerCase()}`;
          const suspects = results.filter((t) => !t.isNative && !t.known && (t.usdPrice ?? 0) > 0 && t.security?.trust_list !== "1").map((t) => t.address.toLowerCase());
          const cached = honeypotRef.current;
          let hp = cached && cached.key === cacheKey && Date.now() - cached.ts < HONEYPOT_TTL ? cached : null;
          const fresh = suspects.filter((a) => !hp?.asked.has(a));
          if (fresh.length) {
            const res = await fetch(`/api/wallets/evm/honeypot?chainId=${chainId}&addresses=${fresh.slice(0, 40).join(",")}`, { signal: AbortSignal.timeout(30_000) });
            if (!res.ok) throw new Error(`honeypot ${res.status}`);
            const data = (await res.json()) as { tokens?: Record<string, HoneypotVerdict>; pending?: string[] };
            const pending = new Set((data.pending ?? []).map((a) => a.toLowerCase()));
            hp = { key: cacheKey, ts: hp?.ts ?? Date.now(), asked: new Set([...(hp?.asked ?? []), ...fresh.filter((a) => !pending.has(a))]), tokens: { ...(hp?.tokens ?? {}), ...(data.tokens ?? {}) } };
            honeypotRef.current = hp;
          }
          if (version !== fetchVersionRef.current) return;
          for (const token of results) if (!token.isNative) token.honeypot = hp?.tokens[token.address.toLowerCase()] ?? token.honeypot;
        } catch (hpErr) {
          console.warn("[useTokenBalances] honeypot check unavailable:", hpErr);
        }
      }

      // The verdict, and whether the price counts: "ok" always, anything else only when the user trusted it.
      for (const token of results) {
        token.risk = assessInventoryToken(token, flaggedRef.current);
        token.valueVerified = valueCounts(token.risk.level, trustedRef.current.has(trustedTokenKey(token.chainId, token.address)));
      }

      const totalFailure = rpcFailed && (indexerFailed || !BLOCKSCOUT_HOSTS[chainId]) && !isLocalOverride;
      failStreakRef.current = totalFailure ? failStreakRef.current + 1 : 0;
      if (totalFailure && failStreakRef.current >= 2) {
        setError("Balances could not load. Check your connection and retry.");
      }

      // Bail if a newer fetch was started while we were awaiting
      if (version !== fetchVersionRef.current) return;

      // Sort: native first, then stacks whose value counts, then by value, then by amount.
      results.sort((a, b) => {
        if (a.isNative !== b.isNative) return a.isNative ? -1 : 1;
        const va = a.valueVerified === false ? 1 : 0, vb = b.valueVerified === false ? 1 : 0;
        if (va !== vb) return va - vb;
        const ua = usdOf(a), ub = usdOf(b);
        if (ua !== ub) return ub - ua;
        return b.rawBalance > a.rawBalance ? 1 : b.rawBalance < a.rawBalance ? -1 : 0;
      });

      setTokens(results);
    } catch (err) {
      console.error("[useTokenBalances] Failed:", err);
      setError("Failed to fetch token balances");
    } finally {
      if (version === fetchVersionRef.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [address, isConnected, chainId, nativeBalance, isLocalOverride, override?.rpcUrl, setTokens]);

  // Initial fetch + poll for balance changes
  useEffect(() => {
    fetchBalances();
    // Also refetch wagmi native balance whenever we poll
    if (!isLocalOverride) {
      refetchNative?.();
    }
  }, [fetchBalances, isLocalOverride, refetchNative]);

  // Polling interval for real-time updates
  useEffect(() => {
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(() => {
      fetchBalances();
      if (!isLocalOverride) refetchNative?.();
    }, POLL_INTERVAL);
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, [fetchBalances, isLocalOverride, refetchNative]);

  // Listen for custom wallet-change events (e.g., after RPC transfers)
  useEffect(() => {
    const handler = () => {
      fetchBalances();
      if (!isLocalOverride) refetchNative?.();
    };
    window.addEventListener("veggat:activeWalletChange", handler);
    window.addEventListener("veggat:balanceInvalidate", handler);
    return () => {
      window.removeEventListener("veggat:activeWalletChange", handler);
      window.removeEventListener("veggat:balanceInvalidate", handler);
    };
  }, [fetchBalances, isLocalOverride, refetchNative]);

  return { tokens, loading, refreshing, error, refetch: fetchBalances, chainId };
}

/** Format large numbers in compact form: 1.5M, 255.5K, etc. */
function formatBalance(value: string): string {
  const num = parseFloat(value);
  if (isNaN(num)) return "0";
  // Airdropped junk comes in stacks of 1e50; toFixed would print the whole exponent form.
  if (num >= 1e15) return num.toExponential(1).replace("e+", "e");
  if (num >= 1e12) return `${(num / 1e12).toFixed(1)}T`;
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(1)}B`;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(1)}K`;
  if (num >= 1) return num.toFixed(2);
  if (num >= 0.0001) return num.toFixed(4);
  return num.toExponential(2);
}
