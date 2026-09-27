import { describe, expect, it } from 'vitest';
import { describeEvent, mergeChainHistory } from './onchain-history';

const ME = '0xd8dA6BF26964aF9D7eEd9e03E53415D37aA96045';
const OTHER = '0x7a8DA01D241C3cFcF7803cdB007EcE5663749193';
const addr = (hash: string, extra = {}) => ({ hash, ...extra });

describe('mergeChainHistory', () => {
  it('folds token transfers into their transaction and classifies from the wallet side', () => {
    const txs = [
      { hash: '0xaaa', from: addr(ME), to: addr(OTHER), value: '1000000000000000000', method: null, timestamp: '2026-09-27T10:00:00Z', status: 'ok', fee: { value: '21000' }, block_number: 10 },
      { hash: '0xbbb', from: addr(ME), to: addr('0xrouter', { is_contract: true, name: 'Router' }), value: '0', method: 'swap', timestamp: '2026-09-27T11:00:00Z', status: 'ok', block_number: 11 },
    ];
    const transfers = [
      { transaction_hash: '0xbbb', from: addr(ME), to: addr('0xpool'), timestamp: '2026-09-27T11:00:00Z', token: { address_hash: '0xusdc', symbol: 'USDC', decimals: '6' }, total: { value: '5000000', decimals: '6' }, block_number: 11 },
      { transaction_hash: '0xbbb', from: addr('0xpool'), to: addr(ME), timestamp: '2026-09-27T11:00:00Z', token: { address_hash: '0xhex', symbol: 'HEX', decimals: '8' }, total: { value: '100000000', decimals: '8' }, block_number: 11 },
      { transaction_hash: '0xccc', from: addr(OTHER), to: addr(ME), timestamp: '2026-09-27T12:00:00Z', token: { address_hash: '0xzc', symbol: 'ZC', decimals: '18', is_scam: true }, total: { value: '39402000000000000000000000', decimals: '18' }, block_number: 12 },
    ];
    const events = mergeChainHistory(1, ME, txs, transfers);
    expect(events.map((e) => e.hash)).toEqual(['0xccc', '0xbbb', '0xaaa']);
    expect(events[2].kind).toBe('send');
    expect(events[2].nativeOut).toBe('1000000000000000000');
    expect(events[2].feeWei).toBe('21000');
    expect(events[1].kind).toBe('swap');
    expect(events[1].tokens).toHaveLength(2);
    expect(events[1].counterpartyName).toBe('Router');
    expect(events[0].kind).toBe('receive');
    expect(events[0].tokens[0].isScam).toBe(true);
    expect(events[0].feeWei).toBeNull();
  });
  it('ignores transfers that do not touch the wallet and marks failed transactions', () => {
    const events = mergeChainHistory(1, ME, [{ hash: '0xdead', from: addr(ME), to: addr(OTHER), value: '5', timestamp: '2026-01-01T00:00:00Z', status: 'error' }], [
      { transaction_hash: '0xzzz', from: addr(OTHER), to: addr('0xsomeone'), token: { symbol: 'X' }, total: { value: '1' } },
    ]);
    expect(events).toHaveLength(1);
    expect(events[0].status).toBe('error');
  });
});

describe('describeEvent', () => {
  it('reads like an explorer row', () => {
    const [e] = mergeChainHistory(1, ME, [{ hash: '0x1', from: addr(OTHER), to: addr(ME), value: '2500000000000000000', timestamp: '2026-01-01T00:00:00Z', status: 'ok' }], []);
    expect(describeEvent(e, 'ETH', (raw, d) => (Number(raw) / 10 ** d).toString())).toBe('Received 2.5 ETH');
  });
});
