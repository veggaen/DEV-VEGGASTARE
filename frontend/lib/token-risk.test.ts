import { describe, expect, it } from 'vitest';
import { assessToken, valueCounts } from './token-risk';

describe('assessToken', () => {
  it('trusts native coins and well-known tokens with real markets', () => {
    expect(assessToken({ isNative: true }).level).toBe('ok');
    expect(assessToken({ isKnown: true, liquidityUsd: 3_700_000, volume24hUsd: 500_000, hasPrice: true }).level).toBe('ok');
    expect(assessToken({ goplus: { trust_list: '1', is_honeypot: '0' }, liquidityUsd: 250_000 }).level).toBe('ok');
  });
  it('calls a honeypot or a heavy sell tax a likely scam', () => {
    const honey = assessToken({ goplus: { is_honeypot: '1' }, liquidityUsd: 50_000 });
    expect(honey.level).toBe('danger');
    expect(honey.reasons[0]).toMatch(/Honeypot/);
    expect(assessToken({ goplus: { sell_tax: '0.25' }, liquidityUsd: 50_000 }).reasons[0]).toMatch(/Sell tax 25%/);
    expect(assessToken({ goplus: { sell_tax: '0.05' }, liquidityUsd: 50_000 }).level).toBe('caution');
  });
  it('lets Honeypot.is catch what GoPlus misses (ETHG-style: sale simulation fails, critical flags)', () => {
    const r = assessToken({ honeypot: { simulationFailed: true, flags: [{ flag: 'high_fail_rate', description: 'A very high amount of users cannot sell their tokens.', severity: 'critical' }] }, liquidityUsd: 40_000, volume24hUsd: 0, hasPrice: true });
    expect(r.level).toBe('danger');
    expect(r.reasons.join(' ')).toMatch(/cannot sell/);
    expect(r.sources).toContain('honeypot.is');
    expect(assessToken({ honeypot: { isHoneypot: false, sellTax: 0, risk: 'low', flags: [] }, liquidityUsd: 40_000, volume24hUsd: 500, hasPrice: true }).level).toBe('ok');
  });
  it('keeps a legitimate but thinly traded token (Hedron-style) countable, with a note', () => {
    const r = assessToken({ goplus: { is_honeypot: '0', is_mintable: '1', is_open_source: '1', is_in_dex: '1', buy_tax: '', sell_tax: '' }, honeypot: { isHoneypot: false, risk: 'low', flags: [] }, liquidityUsd: 9_040, volume24hUsd: 377, hasPrice: true });
    expect(r.level).toBe('ok');
    expect(r.notes.join(' ')).toMatch(/Thin liquidity/);
    expect(r.notes.join(' ')).toMatch(/minted/);
  });
  it('treats no liquidity as danger and a priced but untraded token as caution', () => {
    const airdrop = assessToken({ liquidityUsd: 12, volume24hUsd: 0, hasPrice: true });
    expect(airdrop.level).toBe('danger');
    expect(airdrop.reasons[0]).toMatch(/Almost no liquidity/);
    expect(assessToken({ liquidityUsd: 40_000, volume24hUsd: 0, hasPrice: true }).level).toBe('caution');
    expect(assessToken({ liquidityUsd: 40_000, volume24hUsd: 9_000, hasPrice: true }).level).toBe('ok');
  });
  it('honours the user: a manual flag is danger, and unknown stays unknown without data', () => {
    expect(assessToken({ flaggedByUser: true, liquidityUsd: 1_000_000 }).level).toBe('danger');
    expect(assessToken({ flaggedByUser: true }).reasons[0]).toMatch(/Flagged by you/);
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
