/**
 * @fileOverview  One place for the HTTP RPC each EVM chain uses in the browser:
 *                the wagmi/AppKit transports and the balance reader both take
 *                it from here. Reown's default RPC only answers when the
 *                project's allowed origins include the page's host, which
 *                localhost never is (it answered 401 and every balance read
 *                failed), so reads go to an RPC we configure or a public one.
 *                Local dev chains stay on 127.0.0.1.
 * @stability     stable
 */

export const EVM_RPC_URLS: Record<number, string> = {
  1: process.env.NEXT_PUBLIC_ETHEREUM_RPC || 'https://eth.merkle.io',
  11155111: process.env.NEXT_PUBLIC_SEPOLIA_RPC || 'https://ethereum-sepolia-rpc.publicnode.com',
  8453: process.env.NEXT_PUBLIC_BASE_RPC || 'https://mainnet.base.org',
  84532: 'https://sepolia.base.org',
  369: 'https://rpc.pulsechain.com',
  42161: 'https://arb1.arbitrum.io/rpc',
  137: 'https://polygon-rpc.com',
  10: 'https://mainnet.optimism.io',
  31337: 'http://127.0.0.1:8545',
  1337: 'http://127.0.0.1:7545',
};

export function rpcUrlFor(chainId: number): string | undefined {
  return EVM_RPC_URLS[chainId];
}

/** Reown's `customRpcUrls` shape: CAIP network id → RPC list. */
export function customRpcUrlMap(): Record<string, { url: string }[]> {
  return Object.fromEntries(Object.entries(EVM_RPC_URLS).map(([id, url]) => [`eip155:${id}`, [{ url }]]));
}
