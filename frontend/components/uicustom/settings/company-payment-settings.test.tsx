// @vitest-environment jsdom
/** @fileOverview Company settings recover from failures and require removal confirmation. @stability stable */
import React, { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ status: vi.fn(), save: vi.fn(), remove: vi.fn(), picker: vi.fn() }));
vi.mock('@/actions/seller-payment', () => ({ getSellerPaymentStatus: m.status, savePaypalEmail: m.save, removePaypalEmail: m.remove }));
vi.mock('sonner', () => ({ toast: { success: vi.fn() } }));
vi.mock('./payout-wallet-picker', () => ({ PayoutWalletPicker: (props: unknown) => { m.picker(props); return <div>Shared receiving choices</div>; } }));
import { CompanyPaymentSettings } from './company-payment-settings';
let host: HTMLDivElement, root: Root;
const status = { paypalEmail: 'company@example.test', paypalEmailVerified: true, defaultReceivingWalletId: 'wallet-company', defaultReceivingWalletAddress: '0x' + '1'.repeat(40) };
beforeEach(() => {
  vi.resetAllMocks(); m.status.mockResolvedValue({ data: status }); m.save.mockResolvedValue({ success: 'Saved.' }); m.remove.mockResolvedValue({ success: 'Removed.' });
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  host = document.createElement('div'); document.body.append(host); root = createRoot(host);
});
afterEach(async () => { await act(async () => root.unmount()); host.remove(); vi.restoreAllMocks(); });
const render = () => act(async () => root.render(<CompanyPaymentSettings companyId="company-qa" />));
it('shows a bounded error state after loading fails and offers retry', async () => {
  m.status.mockRejectedValueOnce(new Error('offline')); await render();
  expect(host.querySelector('[role="alert"]')?.textContent).toContain('could not load');
  expect(host.textContent).not.toContain('Loading payment settings');
  await act(async () => host.querySelector('button')!.click());
  expect(host.querySelector('[role="alert"]')).toBeNull(); expect(m.picker).toHaveBeenCalled();
});
it('renders owner-safe action errors instead of an empty edit form', async () => {
  m.status.mockResolvedValue({ error: 'Only the owner can view these settings.' }); await render();
  expect(host.querySelector('[role="alert"]')?.textContent).toContain('Only the owner');
  expect(host.querySelector('form')).toBeNull(); expect(m.picker).not.toHaveBeenCalled();
});
it('passes the current company and actual receiving pointer to the shared picker', async () => {
  await render(); expect(m.picker).toHaveBeenLastCalledWith(expect.objectContaining({ target: { target: 'company', companyId: 'company-qa' }, selectedId: 'wallet-company', selectedAddress: status.defaultReceivingWalletAddress }));
  const input = host.querySelector('input')!; expect(host.querySelector('label')?.htmlFor).toBe(input.id);
  expect(input.type).toBe('email'); expect(input.required).toBe(true);
});
it('cancelling PayPal removal sends nothing', async () => {
  vi.spyOn(window, 'confirm').mockReturnValue(false); await render();
  await act(async () => (host.querySelector('[aria-label="Remove company PayPal receiving email"]') as HTMLButtonElement).click());
  expect(m.remove).not.toHaveBeenCalled();
});
it('a failed save retains the draft and displays actionable feedback', async () => {
  await render(); m.save.mockRejectedValue(new Error('private provider error'));
  const input = host.querySelector('input')!;
  await act(async () => { Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, 'new@example.test'); input.dispatchEvent(new Event('input', { bubbles: true })); });
  await act(async () => host.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })));
  expect(m.save).toHaveBeenCalledWith({ target: 'company', companyId: 'company-qa', paypalEmail: 'new@example.test', expectedEmail: status.paypalEmail });
  expect(input.value).toBe('new@example.test'); expect(host.querySelector('[role="alert"]')?.textContent).toContain('could not be saved');
  expect(host.textContent).not.toContain('private provider error');
});
