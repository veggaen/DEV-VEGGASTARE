/**
 * @fileOverview  Uniswap-V2-style liquidity: the routers and factories we
 *                talk to (Uniswap V2 on Ethereum, PulseX V2/V1 on PulseChain,
 *                and the same Uniswap addresses on a mainnet fork running as
 *                a local chain), the minimal ABIs, and the pure maths for
 *                quotes, slippage floors, pool share and withdrawals.
 * @stability     experimental
 */
import type { Address } from 'viem';

export type V2Protocol = {
  id: string;
  name: string;
  chainId: number;
  router: Address;
  factory: Address;
  wrappedNative: Address;
  nativeSymbol: string;
  lpSymbol: string;
};

const UNISWAP_V2 = {
  router: '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D' as Address,
  factory: '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f' as Address,
  wrappedNative: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2' as Address,
};
const WPLS = '0xA1077a294dDE1B09bB078844df40758a5D0f9a27' as Address;

export const V2_PROTOCOLS: Record<number, V2Protocol[]> = {
  1: [{ id: 'uniswap-v2', name: 'Uniswap V2', chainId: 1, ...UNISWAP_V2, nativeSymbol: 'ETH', lpSymbol: 'UNI-V2' }],
  369: [
    { id: 'pulsex-v2', name: 'PulseX V2', chainId: 369, router: '0x98bf93ebf5c380C0e6Ae8e192A7e2AE08edAcc02', factory: '0x1715a3E4A142d8b698131108995174F37aEBA10D', wrappedNative: WPLS, nativeSymbol: 'PLS', lpSymbol: 'PLP' },
    { id: 'pulsex-v1', name: 'PulseX V1', chainId: 369, router: '0x165C3410fC91EF562C50559f7d2289fEbed552d9', factory: '0x29eA7545DEf87022BAdc76323F373EA1e707C523', wrappedNative: WPLS, nativeSymbol: 'PLS', lpSymbol: 'PLP' },
  ],
  // Local forks of mainnet (Ganache/Anvil --fork) carry the real Uniswap contracts.
  1337: [{ id: 'uniswap-v2-fork', name: 'Uniswap V2 (fork)', chainId: 1337, ...UNISWAP_V2, nativeSymbol: 'ETH', lpSymbol: 'UNI-V2' }],
  31337: [{ id: 'uniswap-v2-fork', name: 'Uniswap V2 (fork)', chainId: 31337, ...UNISWAP_V2, nativeSymbol: 'ETH', lpSymbol: 'UNI-V2' }],
};

export const routerAbi = [
  { type: 'function', name: 'addLiquidity', stateMutability: 'nonpayable', inputs: [{ name: 'tokenA', type: 'address' }, { name: 'tokenB', type: 'address' }, { name: 'amountADesired', type: 'uint256' }, { name: 'amountBDesired', type: 'uint256' }, { name: 'amountAMin', type: 'uint256' }, { name: 'amountBMin', type: 'uint256' }, { name: 'to', type: 'address' }, { name: 'deadline', type: 'uint256' }], outputs: [{ name: 'amountA', type: 'uint256' }, { name: 'amountB', type: 'uint256' }, { name: 'liquidity', type: 'uint256' }] },
  { type: 'function', name: 'addLiquidityETH', stateMutability: 'payable', inputs: [{ name: 'token', type: 'address' }, { name: 'amountTokenDesired', type: 'uint256' }, { name: 'amountTokenMin', type: 'uint256' }, { name: 'amountETHMin', type: 'uint256' }, { name: 'to', type: 'address' }, { name: 'deadline', type: 'uint256' }], outputs: [{ name: 'amountToken', type: 'uint256' }, { name: 'amountETH', type: 'uint256' }, { name: 'liquidity', type: 'uint256' }] },
  { type: 'function', name: 'removeLiquidity', stateMutability: 'nonpayable', inputs: [{ name: 'tokenA', type: 'address' }, { name: 'tokenB', type: 'address' }, { name: 'liquidity', type: 'uint256' }, { name: 'amountAMin', type: 'uint256' }, { name: 'amountBMin', type: 'uint256' }, { name: 'to', type: 'address' }, { name: 'deadline', type: 'uint256' }], outputs: [{ name: 'amountA', type: 'uint256' }, { name: 'amountB', type: 'uint256' }] },
  { type: 'function', name: 'removeLiquidityETH', stateMutability: 'nonpayable', inputs: [{ name: 'token', type: 'address' }, { name: 'liquidity', type: 'uint256' }, { name: 'amountTokenMin', type: 'uint256' }, { name: 'amountETHMin', type: 'uint256' }, { name: 'to', type: 'address' }, { name: 'deadline', type: 'uint256' }], outputs: [{ name: 'amountToken', type: 'uint256' }, { name: 'amountETH', type: 'uint256' }] },
] as const;

export const factoryAbi = [
  { type: 'function', name: 'getPair', stateMutability: 'view', inputs: [{ name: 'tokenA', type: 'address' }, { name: 'tokenB', type: 'address' }], outputs: [{ name: 'pair', type: 'address' }] },
] as const;

export const pairAbi = [
  { type: 'function', name: 'getReserves', stateMutability: 'view', inputs: [], outputs: [{ name: 'reserve0', type: 'uint112' }, { name: 'reserve1', type: 'uint112' }, { name: 'blockTimestampLast', type: 'uint32' }] },
  { type: 'function', name: 'token0', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'token1', stateMutability: 'view', inputs: [], outputs: [{ type: 'address' }] },
  { type: 'function', name: 'totalSupply', stateMutability: 'view', inputs: [], outputs: [{ type: 'uint256' }] },
  { type: 'function', name: 'balanceOf', stateMutability: 'view', inputs: [{ name: 'owner', type: 'address' }], outputs: [{ type: 'uint256' }] },
] as const;

export const ZERO_ADDRESS = '0x0000000000000000000000000000000000000000' as Address;
export const isNativeAddress = (a: string): boolean => a === '0x0' || a.toLowerCase() === ZERO_ADDRESS;

/** Uniswap orders a pair's tokens by address; the lower one is token0. */
export function sortTokens(a: string, b: string): [string, string] {
  return a.toLowerCase() < b.toLowerCase() ? [a, b] : [b, a];
}

/** How much of B matches `amountA` at the pool's current ratio (the router's `quote`). Zero when the pool is empty. */
export function quoteOther(amountA: bigint, reserveA: bigint, reserveB: bigint): bigint {
  if (amountA <= BigInt(0) || reserveA <= BigInt(0) || reserveB <= BigInt(0)) return BigInt(0);
  return (amountA * reserveB) / reserveA;
}

/** `amount` minus `bps` basis points: the minimum the router may settle at. */
export function withSlippage(amount: bigint, bps: number): bigint {
  const b = BigInt(Math.max(0, Math.min(10_000, Math.round(bps))));
  return (amount * (BigInt(10_000) - b)) / BigInt(10_000);
}

/** What burning `lp` LP tokens returns from a pool. */
export function lpRemoveAmounts(lp: bigint, totalSupply: bigint, reserve0: bigint, reserve1: bigint): { amount0: bigint; amount1: bigint } {
  if (lp <= BigInt(0) || totalSupply <= BigInt(0)) return { amount0: BigInt(0), amount1: BigInt(0) };
  return { amount0: (lp * reserve0) / totalSupply, amount1: (lp * reserve1) / totalSupply };
}

export function poolSharePct(lp: bigint, totalSupply: bigint): number {
  if (lp <= BigInt(0) || totalSupply <= BigInt(0)) return 0;
  return Number((lp * BigInt(1_000_000)) / totalSupply) / 10_000;
}

export const deadlineFrom = (nowSeconds: number, minutes = 20): bigint => BigInt(Math.floor(nowSeconds) + minutes * 60);

/** LP token symbols the inventory can recognise as pool positions. */
export const isLpSymbol = (symbol: string): boolean => /^(UNI-V2|PLP|SLP|CAKE-LP|SUSHI-LP)$/i.test(symbol.trim());
