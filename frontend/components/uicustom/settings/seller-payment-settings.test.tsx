// @vitest-environment jsdom
/** @fileOverview Personal payment reads use one authoritative, bounded snapshot. @stability stable */
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ status: vi.fn(), save: vi.fn(), remove: vi.fn(), picker: vi.fn(), user: vi.fn(), fetch: vi.fn() }));
vi.mock('@/actions/seller-payment', () => ({ getSellerPaymentStatus: m.status, savePaypalEmail: m.save, removePaypalEmail: m.remove }));
vi.mock('@/hooks/use-current-user', () => ({ useCurrentUser: m.user }));
vi.mock('sonner', () => ({ toast: { success: vi.fn() } }));
vi.mock('./payout-wallet-picker', () => ({ PayoutWalletPicker: (props: unknown) => { m.picker(props); return <div>Shared receiving choices</div>; } }));
import { SellerPaymentSettings } from './seller-payment-settings';
let host: HTMLDivElement, root: Root;
const status = { paypalEmail: 'seller@example.test', paypalEmailVerified: true, pendingPaypalEmail: null,
  defaultReceivingWalletId: 'wallet-personal', defaultReceivingWalletAddress: '0x' + '1'.repeat(40), walletChangesAllowed: true,
  receivingWallets: [
    { id: 'wallet-personal', label: 'Personal', address: '0x' + '1'.repeat(40), family: 'EVM', scope: 'personal', verifiedAt: '2026-09-25' },
    { id: 'wallet-solana', label: 'Solana savings', address: 'solana-test-only', family: 'SOLANA', scope: 'personal', verifiedAt: '2026-09-25' },
  ] };
beforeEach(() => {
  vi.resetAllMocks(); m.user.mockReturnValue({ id: 'qa-personal-owner' });
  m.status.mockResolvedValue({ data: status }); m.save.mockResolvedValue({ success: 'Saved.' }); m.remove.mockResolvedValue({ success: 'Removed.' });
  m.fetch.mockResolvedValue({ ok: true, json: async () => ({ wallets: [] }) }); vi.stubGlobal('fetch', m.fetch);
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.useRealTimers(); vi.restoreAllMocks(); vi.unstubAllGlobals(); });
const render = () => act(async () => root.render(<SellerPaymentSettings />));
const typeEmail = async (value: string) => act(async () => {
  const input = host.querySelector('input')!;
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
});
const submit = () => act(async () => host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
it('uses one personal status read including every eligible family, not an EVM-only fetch', async () => {
  await render(); expect(m.status).toHaveBeenCalledExactlyOnceWith({ target: 'user' }); expect(m.fetch).not.toHaveBeenCalled();
  expect(m.picker).toHaveBeenLastCalledWith(expect.objectContaining({ wallets: status.receivingWallets, selectedId: status.defaultReceivingWalletId, target: { target: 'user' } }));
});
it('keeps demo payout controls read-only without requesting private status', async () => {
  m.user.mockReturnValue({ id: 'demo_qa' }); await render();
  expect(m.status).not.toHaveBeenCalled(); expect(m.fetch).not.toHaveBeenCalled(); expect(m.picker).not.toHaveBeenCalled();
  expect(host.querySelector('input')?.disabled).toBe(true);
});
it('renders action denial instead of an editable empty form and can retry', async () => {
  m.status.mockResolvedValueOnce({ error: 'Sign in again to view payment settings.' }); await render();
  expect(host.querySelector('[role="alert"]')?.textContent).toContain('Sign in again'); expect(host.querySelector('form')).toBeNull();
  await act(async () => host.querySelector('button')!.click()); expect(host.querySelector('input')?.value).toBe(status.paypalEmail);
});
it('times out a hung read and ignores its response after a successful retry', async () => {
  vi.useFakeTimers(); let resolve!: (value: unknown) => void;
  m.status.mockReturnValueOnce(new Promise(r => { resolve = r; })); await render();
  await act(async () => vi.advanceTimersByTimeAsync(12_001));
  expect(host.querySelector('[role="alert"]')?.textContent).toContain('could not load');
  await act(async () => host.querySelector('button')!.click());
  await act(async () => resolve({ data: { ...status, paypalEmail: 'stale@example.test' } }));
  expect(host.querySelector('input')?.value).toBe(status.paypalEmail);
});
it('preserves an unsaved email while a wallet refresh succeeds', async () => {
  await render(); await typeEmail('draft@example.test'); await act(async () => m.picker.mock.lastCall![0].onChanged());
  expect(host.querySelector('input')?.value).toBe('draft@example.test');
});
it('blocks edits while refreshing and reports refresh failure to the picker', async () => {
  vi.useFakeTimers(); await render(); const onChanged = m.picker.mock.lastCall![0].onChanged;
  m.status.mockReturnValueOnce(new Promise(() => {})); let refresh: Promise<unknown>;
  await act(async () => { refresh = onChanged().catch((error: Error) => error.message); });
  expect(host.querySelector('input')?.disabled).toBe(true);
  expect(m.picker).toHaveBeenLastCalledWith(expect.objectContaining({ loading: true }));
  await act(async () => vi.advanceTimersByTimeAsync(12_001)); expect(await refresh!).toBe('Refresh failed');
});
it('respects server Web3-off status and still displays PayPal settings', async () => {
  m.status.mockResolvedValue({ data: { ...status, walletChangesAllowed: false, receivingWallets: [] } }); await render();
  expect(m.picker).toHaveBeenLastCalledWith(expect.objectContaining({ web3Disabled: true, wallets: [], selectedAddress: status.defaultReceivingWalletAddress }));
  expect(host.querySelector('input')?.disabled).toBe(false);
});
it('keeps failed-save drafts and conceals provider internals', async () => {
  await render(); await typeEmail('new@example.test'); m.save.mockRejectedValue(new Error('PRIVATE_PROVIDER_DETAIL')); await submit();
  expect(m.save).toHaveBeenCalledWith({ target: 'user', paypalEmail: 'new@example.test', expectedEmail: status.paypalEmail });
  expect(host.querySelector('input')?.value).toBe('new@example.test'); expect(host.querySelector('[role="alert"]')?.textContent).toContain('could not be saved');
  expect(host.textContent).not.toContain('PRIVATE_PROVIDER_DETAIL');
});
it('a successful save refreshes the pending address and preserves the verified address', async () => {
  await render(); await typeEmail('new@example.test'); m.status.mockResolvedValue({ data: { ...status, pendingPaypalEmail: 'new@example.test' } }); await submit();
  expect(host.querySelector('input')?.value).toBe('new@example.test'); expect(host.textContent).toContain(status.paypalEmail);
  expect(host.textContent).toContain('Resend verification');
});
it('cancelling removal sends nothing and confirmed removal binds both reviewed addresses', async () => {
  vi.spyOn(window, 'confirm').mockReturnValue(false); await render();
  const remove = () => (host.querySelector('[aria-label="Remove PayPal receiving email"]') as HTMLButtonElement).click();
  await act(async () => remove()); expect(m.remove).not.toHaveBeenCalled();
  vi.mocked(window.confirm).mockReturnValue(true); await act(async () => remove());
  expect(m.remove).toHaveBeenCalledWith({ target: 'user', expectedEmail: status.paypalEmail, expectedPendingEmail: null });
});
