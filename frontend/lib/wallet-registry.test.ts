/** @fileOverview Malformed wallet caches cannot break the shell or supply proof. @stability stable */
import { describe, expect, it } from 'vitest';
import { parseWalletRegistry } from './wallet-registry';

const entry = (key = 'saved') => ({ key, label: 'Saved wallet', customLabel: 'My wallet', family: 'EVM',
  address: '0x' + '1'.repeat(40), connectorName: 'Auth', connectorType: 'AUTH', connectorUid: key,
  connectorId: 'auth', addedAt: 1, authProvider: 'google' });

describe('wallet registry storage', () => {
  it.each([null, '', '{broken', '{}', 'null', 'true', '42', '"wallet"', '[null,42,"x",[],["x",null]]'])('ignores malformed or wrong-shaped storage: %s', raw => {
    expect(parseWalletRegistry(raw)).toEqual([]);
  });
  it('preserves valid display entries beside bad entries and deduplicates keys', () => {
    const result = parseWalletRegistry(JSON.stringify([null, ['bad', { key: 'bad' }], ['saved', entry()], ['saved', { ...entry(), label: 'Duplicate' }], ['other', entry('other')]]));
    expect(result).toEqual([['saved', entry()], ['other', entry('other')]]);
  });
  it('discards cached database identity, ownership proof, payout and credit fields', () => {
    const cached = { ...entry(), dbWalletId: 'someone-elses-wallet', verified: true, isDefault: true, donationTotalUsd: 1_000_000, credits: 10_000 };
    expect(parseWalletRegistry(JSON.stringify([['saved', cached]]))).toEqual([['saved', entry()]]);
  });
  it.each([{ address: null }, { address: 12 }, { connectorUid: {} }, { addedAt: -1 }, { family: 'UNKNOWN' }, { label: 'x'.repeat(513) }, { connectorIcon: 'x'.repeat(32_769) }])('rejects invalid field types and bounds: %j', changed => {
    expect(parseWalletRegistry(JSON.stringify([['saved', { ...entry(), ...changed }]]))).toEqual([]);
  });
  it('rejects mismatched tuple keys', () => {
    expect(parseWalletRegistry(JSON.stringify([['different', entry()]]))).toEqual([]);
  });
  it('bounds raw payload size and parsed entry count', () => {
    expect(parseWalletRegistry(' '.repeat(262_145))).toEqual([]);
    const rows = Array.from({ length: 110 }, (_, n) => [`wallet-${n}`, entry(`wallet-${n}`)]);
    expect(parseWalletRegistry(JSON.stringify(rows))).toHaveLength(100);
  });
  it('preserves case-sensitive addresses', () => {
    expect(parseWalletRegistry(JSON.stringify([['saved', { ...entry(), family: 'SOLANA', address: 'AbCdef' }]]))[0][1].address).toBe('AbCdef');
  });
});
