import { describe, expect, it } from 'vitest';
import { GECKO_BATCH, chunk, normaliseAddresses, parseGeckoPrices } from './token-prices';

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
