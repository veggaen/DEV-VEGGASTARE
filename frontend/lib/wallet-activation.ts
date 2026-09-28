/** @fileOverview Verify extension access on explicit activation, without signing or payments. @stability evolving */
type Provider = { request: (args: { method: string; params?: unknown[] }) => Promise<unknown> };
type WalletConnector = { getProvider: () => Promise<unknown> };
export class WalletActivationError extends Error {}
const codeOf = (error: unknown) => error && typeof error === 'object' && 'code' in error ? Number(error.code) : undefined;
const activeAddress = (accounts: unknown) => Array.isArray(accounts) && typeof accounts[0] === 'string' ? accounts[0].toLowerCase() : undefined;

export async function ensureWalletAccount(connector: WalletConnector, address: string) {
  const provider = await connector.getProvider() as Provider | undefined;
  if (!provider?.request) throw new WalletActivationError('Open or install this wallet extension, then try Set active again.');
  let accounts: unknown;
  try { accounts = await provider.request({ method: 'eth_accounts' }); }
  catch (error) { if (codeOf(error) !== 4100) throw error; }
  const expected = address.toLowerCase();
  if (activeAddress(accounts) === expected) return;
  // A different selected account needs the wallet's own account chooser. Do
  // not silently mark the saved address active just because wagmi remembered it.
  if (activeAddress(accounts)) {
    try { await provider.request({ method: 'wallet_requestPermissions', params: [{ eth_accounts: {} }] }); }
    catch (error) { if (![4200, -32601].includes(codeOf(error) ?? 0)) throw error; }
  }
  accounts = await provider.request({ method: 'eth_requestAccounts' });
  if (activeAddress(accounts) !== expected) throw new WalletActivationError(`Select ${address.slice(0, 6)}…${address.slice(-4)} in your wallet, then try Set active again.`);
}

export function walletActivationMessage(error: unknown) {
  if (error instanceof WalletActivationError) return error.message;
  if (codeOf(error) === 4001 || (error instanceof Error && /reject|cancel|denied/i.test(error.message))) return 'Wallet activation cancelled. Your app sign-in is unchanged.';
  if (codeOf(error) === -32002) return 'A request is already open in your wallet. Complete or cancel it there first.';
  return 'Could not activate this wallet. Open and unlock the extension, select the matching account, then try again.';
}
