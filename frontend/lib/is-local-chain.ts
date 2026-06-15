/**
 * @fileOverview  Utility for detecting local/test blockchain chains.
 *                Used to show ">_RPC" indicators throughout the UI.
 * @stability     stable
 */

/** Chain IDs that are local RPC (Ganache, Anvil, Hardhat) */
export const LOCAL_CHAIN_IDS = new Set([31337, 1337]);

/** Returns true if the given chain ID is a local dev RPC */
export function isLocalChain(chainId: number | undefined): boolean {
  return chainId != null && LOCAL_CHAIN_IDS.has(chainId);
}
