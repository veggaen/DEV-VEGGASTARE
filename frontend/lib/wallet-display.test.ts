/** @fileOverview Address-bound wallet cards never inherit another address's proof. @stability stable */
import { describe, expect, it } from 'vitest';
import { reconcileWalletDisplay, walletAddressKey, type WalletDisplayState } from './wallet-display';

const row = (address: string, extra: Partial<WalletDisplayState> & { socialEmail?: string } = {}) => ({
  address, family: 'EVM', isActive: false, isLive: false, isDefault: false,
  verified: false, donationTotalUsd: 0, ...extra,
});
describe('wallet presentation', () => {
  it('keeps distinct addresses separate even when their social email matches', () => {
    const saved = row('0x111', { dbWalletId: 'saved', verified: true, isDefault: true, donationTotalUsd: 500, socialEmail: 'same@example.test', connectorType: 'AUTH' });
    const live = row('0x222', { isLive: true, socialEmail: 'same@example.test', connectorType: 'AUTH' });
    const result = reconcileWalletDisplay([saved, live], '0x222');
    expect(result).toHaveLength(2);
    expect(result[1]).toMatchObject({ verified: false, isDefault: false, donationTotalUsd: 0, isActive: true });
    expect(result[1].dbWalletId).toBeUndefined();
    expect(result[0]).toMatchObject({ dbWalletId: 'saved', verified: true, isActive: false });
  });
  it('merges EVM casing duplicates and preserves only same-address saved proof', () => {
    const result = reconcileWalletDisplay([row('0xAbC', { verified: true, dbWalletId: 'saved', donationTotalUsd: 25 }), row('0xabc', { isLive: true, connectorType: 'injected' })], '0xABC');
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ verified: true, dbWalletId: 'saved', donationTotalUsd: 25, isLive: true, isActive: true, connectorType: 'injected' });
  });
  it('never merges different families or case-sensitive Solana addresses', () => {
    expect(reconcileWalletDisplay([row('AbC', { family: 'SOLANA' }), row('abc', { family: 'SOLANA' }), row('AbC')])).toHaveLength(3);
    expect(walletAddressKey('SOLANA', 'AbC')).not.toBe(walletAddressKey('SOLANA', 'abc'));
  });
  it('has at most one selected row and does not activate a Solana lookalike', () => {
    const result = reconcileWalletDisplay([row('0xabc', { family: 'SOLANA', isActive: true }), row('0xABC'), row('0xdef', { isActive: true })], '0xabc');
    expect(result.map(w => w.isActive)).toEqual([false, true, false]);
  });
  it('keeps order and inputs immutable', () => {
    const input = [Object.freeze(row('0x2', { isActive: true })), Object.freeze(row('0x1', { isActive: true }))];
    const result = reconcileWalletDisplay(Object.freeze(input));
    expect(result.map(w => w.address)).toEqual(['0x2', '0x1']);
    expect(result.map(w => w.isActive)).toEqual([true, false]);
    expect(input[1].isActive).toBe(true);
  });
  it('does not silently switch to another wallet when the active address is absent', () => {
    expect(reconcileWalletDisplay([row('0x1', { isActive: true })], '0x2')[0].isActive).toBe(false);
  });
});
