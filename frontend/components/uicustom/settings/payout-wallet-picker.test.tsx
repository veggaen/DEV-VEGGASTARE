// @vitest-environment jsdom
/** @fileOverview Receiving choice confirmation, cancellation and uncertain outcomes. @stability stable */
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ set: vi.fn(), clear: vi.fn(), refresh: vi.fn() }));
vi.mock('@/actions/seller-payment', () => ({ setDefaultReceivingWallet: m.set, removeDefaultReceivingWallet: m.clear }));
vi.mock('next/link', () => ({ default: ({ children, ...props }: React.AnchorHTMLAttributes<HTMLAnchorElement>) => <a {...props}>{children}</a> }));
import { PayoutWalletPicker } from './payout-wallet-picker';
let host: HTMLDivElement, root: Root;
const wallets = [1,2,3].map(n => ({ id: `wallet-${n}`, label: `Wallet ${n}`, address: '0x' + String(n).repeat(40), verifiedAt: n === 3 ? null : '2026-09-25' }));
const props = { target: { target: 'user' as const }, wallets, selectedId: 'wallet-1', selectedAddress: wallets[0].address, onChanged: m.refresh };
beforeEach(async () => {
  vi.resetAllMocks(); m.set.mockResolvedValue({ twoFactor: true }); m.clear.mockResolvedValue({ twoFactor: true }); m.refresh.mockResolvedValue(undefined);
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
  await act(async () => root.render(<PayoutWalletPicker {...props} />));
});
afterEach(async () => { vi.useRealTimers(); await act(async () => root.unmount()); host.remove(); });
function button(name: string) { const result = [...host.querySelectorAll('button')].find(b => (b.getAttribute('aria-label') ?? b.textContent) === name); if (!result) throw new Error(`Missing button: ${name}`); return result; }
const click = async (name: string) => { await act(async () => button(name).click()); };
async function enterCode(value: string) {
  const input = host.querySelector('input')!;
  await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value); input.dispatchEvent(new Event('input', { bubbles: true })); });
  await act(async () => host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
}
it('lists only verified choices and disables the already-selected choice', () => {
  expect(host.querySelectorAll('[aria-pressed]')).toHaveLength(2);
  expect(button('Use Wallet 1 for receiving payments').disabled).toBe(true);
  expect(m.set).not.toHaveBeenCalled();
});
it('a loading failure offers retry instead of claiming there are no wallets', async () => {
  const retry = vi.fn();
  await act(async () => root.render(<PayoutWalletPicker {...props} loadError onRetry={retry} />));
  expect(host.querySelector('[role="alert"]')?.textContent).toContain('could not load');
  expect(host.textContent).not.toContain('No verified wallets available');
  expect(button('Clear selection').disabled).toBe(true);
  await click('Retry wallets'); expect(retry).toHaveBeenCalledTimes(1);
});
it('Web3-disabled state blocks mutations and links to the real wallet section', async () => {
  await act(async () => root.render(<PayoutWalletPicker {...props} web3Disabled />));
  expect(host.querySelector('a')?.getAttribute('href')).toBe('/settings?section=wallet');
  expect(button('Clear selection').disabled).toBe(true);
  expect(host.querySelectorAll('[aria-pressed]')).toHaveLength(0);
  expect(m.set).not.toHaveBeenCalled();
});
it('distinguishes personal and company choices and blocks clearing while refreshing', async () => {
  await act(async () => root.render(<PayoutWalletPicker {...props} wallets={wallets.map((w,i) => ({ ...w, family: 'EVM', scope: i ? 'personal' : 'company' }))} />));
  expect(host.textContent).toContain('Company wallet · EVM'); expect(host.textContent).toContain('Your wallet · EVM');
  await act(async () => root.render(<PayoutWalletPicker {...props} loading />));
  expect(button('Clear selection').disabled).toBe(true);
});
it('keeps the existing choice until approval succeeds and Cancel sends no mutation', async () => {
  await click('Use Wallet 2 for receiving payments');
  expect(host.querySelector('[aria-pressed="true"]')?.getAttribute('aria-label')).toContain('Wallet 1');
  expect(button('Use Wallet 2 for receiving payments').disabled).toBe(true);
  await click('Cancel'); expect(host.querySelector('input')).toBeNull();
  expect(m.set).toHaveBeenCalledTimes(1); expect(m.refresh).not.toHaveBeenCalled();
});
it('clear requires explicit confirmation and keeps the link', async () => {
  await click('Clear selection'); expect(m.clear).not.toHaveBeenCalled();
  await click('Keep selection'); expect(m.clear).not.toHaveBeenCalled();
  await click('Clear selection'); await click('Confirm clear selection');
  expect(m.clear).toHaveBeenLastCalledWith({ target: 'user', expectedWalletId: 'wallet-1', code: undefined });
  m.clear.mockResolvedValue({ success: 'Receiving choice cleared. The wallet stays linked.' });
  await enterCode('654321');
  expect(m.clear).toHaveBeenLastCalledWith({ target: 'user', expectedWalletId: 'wallet-1', code: '654321' });
  expect(m.refresh).toHaveBeenCalledTimes(1);
});
it('retains a rejected code for correction and refreshes only after success', async () => {
  await click('Use Wallet 2 for receiving payments');
  m.set.mockResolvedValueOnce({ error: 'Incorrect code.' }); await enterCode('123456');
  expect(host.querySelector('[role="alert"]')?.textContent).toBe('Incorrect code.');
  expect(host.querySelector('input')?.value).toBe('123456'); expect(m.refresh).not.toHaveBeenCalled();
  m.set.mockResolvedValue({ success: 'Receiving wallet updated.' }); await enterCode('654321');
  expect(m.set).toHaveBeenLastCalledWith({ target: 'user', walletId: 'wallet-2', expectedWalletId: 'wallet-1', code: '654321' });
  expect(m.refresh).toHaveBeenCalledTimes(1); expect(host.querySelector('input')).toBeNull();
});
it('does not submit malformed codes', async () => {
  await click('Use Wallet 2 for receiving payments'); await enterCode('123'); expect(m.set).toHaveBeenCalledTimes(1);
});
it('forwards company scope without changing the personal target', async () => {
  await act(async () => root.render(<PayoutWalletPicker {...props} target={{ target: 'company', companyId: 'company-qa' }} />));
  await click('Use Wallet 2 for receiving payments');
  expect(m.set).toHaveBeenCalledWith({ target: 'company', companyId: 'company-qa', walletId: 'wallet-2', expectedWalletId: 'wallet-1', code: undefined });
});
it('blocks double submission while the action is pending', async () => {
  let resolve!: (value: { success: string }) => void;
  m.set.mockReturnValue(new Promise(r => { resolve = r; }));
  await act(async () => { button('Use Wallet 2 for receiving payments').click(); button('Use Wallet 2 for receiving payments').click(); });
  expect(m.set).toHaveBeenCalledTimes(1);
  await act(async () => resolve({ success: 'Saved.' })); expect(m.refresh).toHaveBeenCalledTimes(1);
});
it('an uncertain timeout locks mutations until reload and ignores late success', async () => {
  vi.useFakeTimers(); let resolve!: (value: { success: string }) => void;
  m.set.mockReturnValue(new Promise(r => { resolve = r; }));
  await click('Use Wallet 2 for receiving payments');
  await act(async () => vi.advanceTimersByTimeAsync(20_001));
  expect(host.querySelector('[role="alert"]')?.textContent).toContain('Refresh payment settings');
  expect(button('Use Wallet 2 for receiving payments').disabled).toBe(true);
  expect(button('Refresh payment settings')).toBeTruthy();
  await act(async () => resolve({ success: 'Saved.' })); expect(m.refresh).not.toHaveBeenCalled();
});
it('reports a refresh failure without pretending the successful write failed', async () => {
  m.set.mockResolvedValue({ success: 'Receiving wallet updated.' }); m.refresh.mockRejectedValue(new Error('offline'));
  await click('Use Wallet 2 for receiving payments');
  expect(host.querySelector('[role="alert"]')?.textContent).toBe('Saved. Refresh payment settings to see the latest choice.');
});
