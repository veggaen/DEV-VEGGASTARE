import { describe, expect, it } from 'vitest';
import { fromBlockscout, mergeTokenCandidates } from './wallet-tokens';

const item = (over: Record<string, unknown> = {}, token: Record<string, unknown> = {}) => ({
  token: { address_hash: '0x2b591e99afE9f32eAA6214f7B7629768c40Eeb39', symbol: 'HEX', name: 'HEX', decimals: '8', type: 'ERC-20', reputation: 'ok', exchange_rate: '0.001', icon_url: 'https://assets.example/hex.png', ...token },
  value: '8714500000000',
  ...over,
});

describe('fromBlockscout', () => {
  it('keeps funded ERC-20s with their metadata and drops scams, zero balances and NFTs', () => {
    const out = fromBlockscout([
      item(),
      item({ value: '0' }, { address_hash: '0x1111111111111111111111111111111111111111', symbol: 'ZERO' }),
      item({}, { address_hash: '0x2222222222222222222222222222222222222222', symbol: 'SCAM', reputation: 'scam' }),
      item({}, { address_hash: '0x3333333333333333333333333333333333333333', symbol: 'NFT', type: 'ERC-721' }),
      item({}, { address_hash: 'not-an-address', symbol: 'BAD' }),
    ]);
    expect(out.map((t) => t.symbol)).toEqual(['HEX']);
    expect(out[0]).toMatchObject({ decimals: 8, balance: '8714500000000', usdRate: 0.001, logo: 'https://assets.example/hex.png', name: 'HEX' });
  });
  it('orders by USD value, then raw amount, and caps the list', () => {
    const out = fromBlockscout([
      item({ value: '1000000' }, { address_hash: '0x4444444444444444444444444444444444444444', symbol: 'USDC', decimals: '6', exchange_rate: '1' }),
      item({ value: '5000000000000000000' }, { address_hash: '0x5555555555555555555555555555555555555555', symbol: 'BIG', decimals: '18', exchange_rate: null }),
      item(),
    ], 2);
    expect(out.map((t) => t.symbol)).toEqual(['HEX', 'USDC']);
  });
  it('is defensive about garbage', () => {
    expect(fromBlockscout(null)).toEqual([]);
    expect(fromBlockscout([{ token: null }, 42, 'x'])).toEqual([]);
  });
});

describe('mergeTokenCandidates', () => {
  it('keeps the known order, borrows indexed balances and logos, and appends the rest once', () => {
    const known = [{ address: '0x2B591E99AFE9F32EAA6214F7B7629768C40EEB39', symbol: 'HEX', decimals: 8 }, { address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', symbol: 'USDC', decimals: 6 }];
    const discovered = fromBlockscout([item(), item({ value: '12' }, { address_hash: '0x9999999999999999999999999999999999999999', symbol: 'NEW', decimals: '18' })]);
    const merged = mergeTokenCandidates(known, discovered);
    expect(merged.map((t) => t.symbol)).toEqual(['HEX', 'USDC', 'NEW']);
    expect(merged[0].indexedBalance).toBe(BigInt('8714500000000'));
    expect(merged[0].logo).toBe('https://assets.example/hex.png');
    expect(merged[1].indexedBalance).toBeUndefined();
    expect(merged[2].indexedBalance).toBe(BigInt(12));
  });
});
