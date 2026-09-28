import { describe, expect, it } from 'vitest';
import { V2_PROTOCOLS, deadlineFrom, isLpSymbol, lpRemoveAmounts, poolSharePct, quoteOther, sortTokens, withSlippage } from './v2';

describe('v2 maths', () => {
  it('quotes the other side at the pool ratio and zero for empty pools', () => {
    expect(quoteOther(BigInt(1000), BigInt(10_000), BigInt(20_000))).toBe(BigInt(2000));
    expect(quoteOther(BigInt(1000), BigInt(0), BigInt(20_000))).toBe(BigInt(0));
  });
  it('applies slippage in basis points and clamps silly values', () => {
    expect(withSlippage(BigInt(10_000), 50)).toBe(BigInt(9950));
    expect(withSlippage(BigInt(10_000), 0)).toBe(BigInt(10_000));
    expect(withSlippage(BigInt(10_000), 20_000)).toBe(BigInt(0));
  });
  it('splits a withdrawal pro rata and reports the pool share', () => {
    expect(lpRemoveAmounts(BigInt(10), BigInt(100), BigInt(5000), BigInt(700))).toEqual({ amount0: BigInt(500), amount1: BigInt(70) });
    expect(poolSharePct(BigInt(10), BigInt(100))).toBe(10);
    expect(poolSharePct(BigInt(0), BigInt(100))).toBe(0);
  });
  it('orders tokens like the factory and builds deadlines in seconds', () => {
    expect(sortTokens('0xB', '0xa')).toEqual(['0xa', '0xB']);
    expect(deadlineFrom(1_000, 20)).toBe(BigInt(2200));
    expect(isLpSymbol('UNI-V2')).toBe(true);
    expect(isLpSymbol('plp')).toBe(true);
    expect(isLpSymbol('HEX')).toBe(false);
  });
  it('lists a protocol per supported chain with distinct routers', () => {
    expect(V2_PROTOCOLS[1][0].name).toBe('Uniswap V2');
    expect(V2_PROTOCOLS[369].map((p) => p.id)).toEqual(['pulsex-v2', 'pulsex-v1']);
    expect(V2_PROTOCOLS[1337][0].router).toBe(V2_PROTOCOLS[1][0].router);
  });
});
