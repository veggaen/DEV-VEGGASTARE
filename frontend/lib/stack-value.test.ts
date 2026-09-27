import { describe, expect, it } from 'vitest';
import { formatUsd, formatUsdCompact, stackUsd, sumStacksUsd } from './stack-value';

const usdc = { symbol: 'USDC', decimals: 6, isNative: false, usdPrice: 1 };
const eth = { symbol: 'ETH', decimals: 18, isNative: true };
const junk = { symbol: 'JUNK', decimals: 18, isNative: false };

describe('stackUsd', () => {
  it('prices ERC-20s from the token and native coins from the display rates', () => {
    expect(stackUsd(usdc, '2500000')).toBe(2.5);
    expect(stackUsd(eth, BigInt('1500000000000000000'), { ETH: 2000 })).toBe(3000);
  });
  it('returns null without a price or with a malformed amount', () => {
    expect(stackUsd(junk, '1')).toBeNull();
    expect(stackUsd(eth, '1', {})).toBeNull();
    expect(stackUsd(usdc, 'nope')).toBeNull();
  });
});

describe('sumStacksUsd', () => {
  it('adds what it can and reports how many stacks contributed', () => {
    const r = sumStacksUsd([{ token: usdc, rawAmount: '1000000' }, { token: eth, rawAmount: '1000000000000000000' }, { token: junk, rawAmount: '5' }], { ETH: 100 });
    expect(r).toEqual({ usd: 101, priced: 2, total: 3 });
  });
});

describe('formatting', () => {
  it('keeps cell labels short', () => {
    expect(formatUsdCompact(0.004)).toBe('<$0.01');
    expect(formatUsdCompact(0.42)).toBe('$0.42');
    expect(formatUsdCompact(12.3)).toBe('$12.30');
    expect(formatUsdCompact(250)).toBe('$250');
    expect(formatUsdCompact(1200)).toBe('$1.2K');
    expect(formatUsdCompact(636811)).toBe('$637K');
    expect(formatUsdCompact(4_100_000)).toBe('$4.1M');
  });
  it('formats totals with grouping', () => {
    expect(formatUsd(636811.4)).toBe('$636,811');
    expect(formatUsd(12.3)).toBe('$12.30');
  });
});
