/** @fileOverview Explicit wallet activation respects access, cancellation and account identity. @stability stable */
import { expect, it, vi } from 'vitest';
import { ensureWalletAccount, walletActivationMessage } from './wallet-activation';
const target = '0x0000000000000000000000000000000000000001', other = '0x0000000000000000000000000000000000000002';
const fixture = (request = vi.fn()) => ({ request, connector: { getProvider: async () => ({ request }) } });
it('does not prompt an already authorized selected account', async () => {
  const { request, connector } = fixture(); request.mockResolvedValue([target]);
  await ensureWalletAccount(connector, target); expect(request.mock.calls).toEqual([[{ method: 'eth_accounts' }]]);
});
it('requests extension access when a saved wallet is locked or disconnected', async () => {
  const { request, connector } = fixture(); request.mockResolvedValueOnce([]).mockResolvedValueOnce([target]);
  await ensureWalletAccount(connector, target); expect(request.mock.calls.map(call => call[0].method)).toEqual(['eth_accounts', 'eth_requestAccounts']);
});
it('asks the wallet to select the requested account, never signs or pays', async () => {
  const { request, connector } = fixture(); request.mockResolvedValueOnce([other]).mockResolvedValueOnce([]).mockResolvedValueOnce([target]);
  await ensureWalletAccount(connector, target);
  expect(request.mock.calls.map(call => call[0].method)).toEqual(['eth_accounts', 'wallet_requestPermissions', 'eth_requestAccounts']);
  expect(request.mock.calls[1][0].params).toEqual([{ eth_accounts: {} }]);
});
it('does not claim success if the extension returns a different account', async () => {
  const { request, connector } = fixture(); request.mockResolvedValue([other]);
  await expect(ensureWalletAccount(connector, target)).rejects.toThrow('Select 0x0000…0001');
});
it('propagates cancellation without another request', async () => {
  const { request, connector } = fixture(); request.mockResolvedValueOnce([]).mockRejectedValueOnce({ code: 4001 });
  await expect(ensureWalletAccount(connector, target)).rejects.toEqual({ code: 4001 }); expect(request).toHaveBeenCalledTimes(2);
  expect(walletActivationMessage({ code: 4001 })).toContain('cancelled');
});
it('falls back only for unsupported permission methods', async () => {
  const { request, connector } = fixture(); request.mockResolvedValueOnce([other]).mockRejectedValueOnce({ code: 4200 }).mockResolvedValueOnce([target]);
  await ensureWalletAccount(connector, target); expect(request).toHaveBeenCalledTimes(3);
});
it('handles unauthorized reads, missing providers and pending requests safely', async () => {
  const { request, connector } = fixture(); request.mockRejectedValueOnce({ code: 4100 }).mockResolvedValueOnce([target]);
  await ensureWalletAccount(connector, target);
  await expect(ensureWalletAccount({ getProvider: async () => undefined }, target)).rejects.toThrow('extension');
  expect(walletActivationMessage({ code: -32002 })).toContain('already open');
  expect(walletActivationMessage(new Error('sensitive provider payload'))).not.toContain('sensitive');
});
