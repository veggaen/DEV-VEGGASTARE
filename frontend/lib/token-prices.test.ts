import { describe, expect, it } from 'vitest';
import { GECKO_BATCH, chunk, normaliseAddresses, parseGeckoPrices, parseGeckoSimple } from './token-prices';

describe('parseGeckoSimple', () => {
  it('reads prices, reserves and volumes side by side, tolerating missing tables', () => {
    const out = parseGeckoSimple({ data: { attributes: { token_prices: { '0xA': '0.5' }, total_reserve_in_usd: { '0xA': '3722741.95', '0xB': '0.0' }, h24_volume_usd: { '0xA': 516405 } } } });
    expect(out.prices).toEqual({ '0xa': 0.5 });
    expect(out.reserves).toEqual({ '0xa': 3722741.95, '0xb': 0 });
    expect(out.volumes).toEqual({ '0xa': 516405 });
    expect(parseGeckoSimple({ data: { attributes: { token_prices: {} } } })).toEqual({ prices: {}, reserves: {}, volumes: {} });
  });
});

describe('parseGeckoPrices', () => {
  it('lower-cases addresses and keeps only finite positive numbers', () => {
    const out = parseGeckoPrices({ data: { attributes: { token_prices: { '0xABC': '0.0032', '0xdef': 12, '0x0': '0', '0x1': 'nope', '0x2': null } } } });
    expect(out).toEqual({ '0xabc': 0.0032, '0xdef': 12 });
  });
  it('is defensive about the shape', () => {
    expect(parseGeckoPrices(null)).toEqual({});
    expect(parseGeckoPrices({ data: {} })).toEqual({});
    expect(parseGeckoPrices('x')).toEqual({});
  });
});

describe('normaliseAddresses / chunk', () => {
  it('drops junk and duplicates, and batches to the API limit', () => {
    const many = Array.from({ length: 65 }, (_, i) => `0x${(i + 1).toString(16).padStart(40, '0')}`);
    const list = normaliseAddresses([...many, many[0].toUpperCase(), 'nope', ' 0x1 ']);
    expect(list).toHaveLength(65);
    const batches = chunk(list, GECKO_BATCH);
    expect(batches.map((b) => b.length)).toEqual([30, 30, 5]);
  });
});
