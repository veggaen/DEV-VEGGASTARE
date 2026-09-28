import { describe, expect, it } from 'vitest';
import type { ChainEvent } from './onchain-history';
import { DAY_MS, allocationOf, balanceAt, buildValueSeries, movementsFromEvents, priceAt } from './portfolio-history';

const W = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';
const HEX = '0x2b591e99afe9f32eaa6214f7b7629768c40eeb39';
const ev = (over: Partial<ChainEvent>): ChainEvent => ({ id: 'x', hash: '0x1', chainId: 1, wallet: W, timestamp: 0, block: 0, kind: 'send', status: 'ok', method: null, counterparty: null, counterpartyName: null, counterpartyIsContract: false, nativeIn: '0', nativeOut: '0', feeWei: null, tokens: [], ...over });

describe('movementsFromEvents', () => {
  it('turns native value, fees and token transfers into signed movements, oldest first', () => {
    const events = [
      ev({ timestamp: 3 * DAY_MS, nativeOut: '1000', feeWei: '10', tokens: [{ address: HEX, symbol: 'HEX', decimals: 8, value: '500', direction: 'out', counterparty: null }] }),
      ev({ timestamp: 1 * DAY_MS, nativeIn: '5000' }),
      ev({ timestamp: 2 * DAY_MS, wallet: '0xother', nativeIn: '999' }),
    ];
    expect(movementsFromEvents(events, W)).toEqual([
      { t: DAY_MS, key: 'native', delta: BigInt(5000) },
      { t: 3 * DAY_MS, key: 'native', delta: BigInt(-1010) },
      { t: 3 * DAY_MS, key: HEX, delta: BigInt(-500) },
    ]);
  });
});

describe('balanceAt / priceAt', () => {
  const moves = [{ t: DAY_MS, key: 'native', delta: BigInt(5000) }, { t: 3 * DAY_MS, key: 'native', delta: BigInt(-1010) }];
  it('walks today back through later movements and never goes negative', () => {
    expect(balanceAt(BigInt(3990), moves, 'native', 10 * DAY_MS)).toBe(BigInt(3990));
    expect(balanceAt(BigInt(3990), moves, 'native', 2 * DAY_MS)).toBe(BigInt(5000));
    expect(balanceAt(BigInt(3990), moves, 'native', 0)).toBe(BigInt(0));
  });
  it('takes the last close at or before the time', () => {
    const s = [{ t: DAY_MS, p: 10 }, { t: 2 * DAY_MS, p: 12 }];
    expect(priceAt(s, 0)).toBe(10);
    expect(priceAt(s, DAY_MS + 5)).toBe(10);
    expect(priceAt(s, 5 * DAY_MS)).toBe(12);
    expect(priceAt(undefined, 1)).toBeUndefined();
  });
});

describe('buildValueSeries / allocationOf', () => {
  it('values counted holdings per day from reconstructed balances and daily prices', () => {
    const holdings = [
      { key: 'native', symbol: 'ETH', decimals: 3, balance: BigInt(3990), counts: true },
      { key: HEX, symbol: 'HEX', decimals: 0, balance: BigInt(100), counts: true, usdPrice: 2 },
      { key: '0xscam', symbol: 'SCAM', decimals: 0, balance: BigInt(1_000_000), counts: false, usdPrice: 1 },
    ];
    const movements = [{ t: DAY_MS, key: 'native', delta: BigInt(5000) }, { t: 3 * DAY_MS, key: 'native', delta: BigInt(-1010) }, { t: 3 * DAY_MS, key: HEX, delta: BigInt(-500) }];
    const prices = new Map([['native', [{ t: 0, p: 1000 }, { t: 3 * DAY_MS, p: 2000 }]]]);
    const series = buildValueSeries({ holdings, movements, prices, fromT: DAY_MS, toT: 4 * DAY_MS });
    expect(series.map((p) => p.t / DAY_MS)).toEqual([1, 2, 3, 4]);
    // day 1: 5.000 ETH × $1000 + 600 HEX × $2 (flat, no series) = 6200
    expect(series[0].usd).toBe(6200);
    // day 3 onwards: 3.990 ETH × $2000 + 100 HEX × $2 = 8180; the scam never counts
    expect(series[2].usd).toBe(8180);
    expect(series[3].parts['0xscam']).toBeUndefined();
    const alloc = allocationOf(series[3], holdings);
    expect(alloc[0].symbol).toBe('ETH');
    expect(alloc.reduce((a, x) => a + x.share, 0)).toBeCloseTo(1, 6);
  });
});
