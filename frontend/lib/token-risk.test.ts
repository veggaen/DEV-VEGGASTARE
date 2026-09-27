import { describe, expect, it } from 'vitest';
import { assessToken, valueCounts } from './token-risk';

describe('assessToken', () => {
  it('trusts native coins and well-known tokens with real markets', () => {
    expect(assessToken({ isNative: true }).level).toBe('ok');
    expect(assessToken({ isKnown: true, liquidityUsd: 3_700_000, volume24hUsd: 500_000 }).level).toBe('ok');
    expect(assessToken({ goplus: { trust_list: '1', is_honeypot: '0' }, liquidityUsd: 250_000 }).level).toBe('ok');
  });
  it('calls a honeypot or a heavy sell tax a likely scam', () => {
    const honey = assessToken({ goplus: { is_honeypot: '1' }, liquidityUsd: 50_000 });
    expect(honey.level).toBe('danger');
    expect(honey.reasons[0]).toMatch(/Honeypot/);
    expect(assessToken({ goplus: { sell_tax: '0.25' }, liquidityUsd: 50_000 }).reasons[0]).toMatch(/Sell tax 25%/);
    expect(assessToken({ goplus: { sell_tax: '0.05' }, liquidityUsd: 50_000 }).level).toBe('caution');
  });
  it('treats no liquidity as danger and thin liquidity as caution, from DEX data alone', () => {
    const airdrop = assessToken({ liquidityUsd: 12, volume24hUsd: 0 });
    expect(airdrop.level).toBe('danger');
    expect(airdrop.reasons[0]).toMatch(/Almost no liquidity/);
    expect(assessToken({ liquidityUsd: 4_000, volume24hUsd: 900 }).level).toBe('caution');
    expect(assessToken({ liquidityUsd: 40_000, volume24hUsd: 9_000 }).level).toBe('ok');
  });
  it('uses GoPlus DEX liquidity when the price feed had none, and says unknown with no data', () => {
    expect(assessToken({ goplus: { is_honeypot: '0', dex: [{ liquidity: '600' }, { liquidity: '200' }] } }).level).toBe('danger');
    expect(assessToken({}).level).toBe('unknown');
  });
});

describe('valueCounts', () => {
  it('counts ok tokens, and others only when trusted', () => {
    expect(valueCounts('ok', false)).toBe(true);
    expect(valueCounts('danger', false)).toBe(false);
    expect(valueCounts('danger', true)).toBe(true);
    expect(valueCounts(undefined, false)).toBe(false);
  });
});
