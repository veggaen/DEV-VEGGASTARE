/** @fileOverview Display quotes retain provenance and never invent unknown rates. @stability stable */
import { describe, expect, it } from 'vitest';
import { displayConversions, displayRateState, emptyDisplayRates, MAX_DISPLAY_RATE_AGE, markDisplayRatesStale, mergeDisplayRates, readDisplayRateCache, readDisplayRateResponse } from './display-rate-cache';
const now = Date.UTC(2026, 8, 24);
const response = (fresh = true, timestamp: number | null = now) => ({ success: true, fiat: { rates: { USD: 1, NOK: .1 }, fresh, timestamp }, crypto: { prices: { ETH: 2000 }, fresh, timestamp } });
describe('display reference-rate provenance', () => {
  it('preserves server timestamps and stale flags through JSON cache roundtrip', () => {
    const snapshot = readDisplayRateResponse(response(false, now - 1000), now)!;
    const restored = readDisplayRateCache(JSON.parse(JSON.stringify(snapshot)), now)!;
    expect(restored).toEqual(snapshot);
    expect(displayRateState(restored, now)).toMatchObject({ isFiatStale: true, isCryptoStale: true, lastUpdated: new Date(now - 1000) });
  });
  it('ages each quote independently, rather than restarting its clock on reload', () => {
    const snapshot = readDisplayRateResponse(response(), now)!;
    expect(displayRateState(snapshot, now + 5 * 60_000)).toMatchObject({ isFiatStale: false, isCryptoStale: true });
    expect(displayRateState(snapshot, now + 60 * 60_000)).toMatchObject({ isFiatStale: true, isCryptoStale: true });
  });
  it.each([null, -1, NaN, now + 120_000, now - MAX_DISPLAY_RATE_AGE - 1])('rejects untraceable or invalid timestamp %s', timestamp => {
    expect(readDisplayRateResponse(response(true, timestamp), now)).toBeNull();
  });
  it('ignores legacy caches that never preserved provider freshness', () => {
    expect(readDisplayRateCache({ fiatRates: { NOK: .1 }, cryptoPrices: { ETH: 2000 }, fiatTimestamp: now, cryptoTimestamp: now }, now)).toBeNull();
  });
  it('drops invalid numbers, unknown-shaped maps and prototype-like keys', () => {
    const input = response(); input.crypto.prices = { ETH: -2, BTC: Infinity, SOL: 150, USDC: '1', constructor: 4 } as never;
    expect(readDisplayRateResponse(input, now)?.crypto?.values).toEqual({ SOL: 150 });
    expect(readDisplayRateResponse({ success: true, fiat: [] }, now)).toBeNull();
  });
  it('never changes the USD identity rate and does not add missing currencies', () => {
    const input = response(); input.fiat.rates.USD = 2;
    expect(readDisplayRateResponse(input, now)?.fiat?.values).toEqual({ USD: 1, NOK: .1 });
  });
  it('retains usable old quotes on partial refresh, explicitly stale', () => {
    const previous = readDisplayRateResponse(response(), now)!;
    const next = readDisplayRateResponse({ ...response(), crypto: null }, now)!;
    expect(mergeDisplayRates(previous, next).crypto).toEqual({ ...previous.crypto, fresh: false });
    expect(markDisplayRatesStale(previous).fiat?.fresh).toBe(false);
  });
  it('provides only identity conversion without a quote and expires very old data', () => {
    expect(displayRateState(emptyDisplayRates(), now)).toMatchObject({ fiatRates: { USD: 1 }, cryptoPrices: {}, lastUpdated: null });
    expect(displayRateState(readDisplayRateResponse(response(), now)!, now + MAX_DISPLAY_RATE_AGE + 1).cryptoPrices).toEqual({});
    const convert = displayConversions({}, {});
    expect(convert.convertToUSD(39, 'NOK')).toBeNaN(); expect(convert.convertUSDToCrypto(39, 'PLS')).toBeNaN();
    expect(convert.convertCurrency(39, 'NOK', 'nok')).toBe(39); expect(convert.convertToUSD(39, 'USD')).toBe(39);
    expect(convert.convertFiatToCrypto(39, 'NOK', 'ETH')).toBeNaN();
  });
  it('converts only with finite positive quotes', () => {
    const convert = displayConversions({ NOK: .1 }, { ETH: 2000 });
    expect(convert.convertCurrency(39, 'NOK', 'USD')).toBeCloseTo(3.9);
    expect(convert.convertFiatToCrypto(39, 'NOK', 'ETH')).toBeCloseTo(.00195);
    expect(convert.convertCryptoToUSD(1, 'ETH')).toBe(2000);
  });
});
