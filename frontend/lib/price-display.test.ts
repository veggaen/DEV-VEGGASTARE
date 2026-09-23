/** @fileOverview Display currency regression coverage; no payment conversions. @stability stable */
import { describe, expect, it } from 'vitest';
import { priceDisplay } from './price-display';

const fixture = { amount: 39, currency: 'NOK', fiat: 'USD', crypto: 'ETH', fiatRates: { USD: 1, NOK: 0.1, EUR: 1.2 }, cryptoPrices: { ETH: 2000, BTC: 100000, SOL: 150, PLS: 0.00002, USDC: 1 } };
describe('global fiat (crypto) display', () => {
  it('converts NOK to USD with ETH only in parentheses', () => {
    const result = priceDisplay(fixture);
    expect(result.primaryText).toMatch(/USD\s3\.90/);
    expect(result.secondaryText).toBe('(0.00195 ETH)');
    expect(result.secondaryText).not.toContain('NOK');
  });
  it('switches fiat without changing the crypto equivalent', () => {
    const result = priceDisplay({ ...fixture, fiat: 'NOK' });
    expect(result.primaryText).toMatch(/NOK\s39\.00/);
    expect(result.secondaryText).toBe('(0.00195 ETH)');
  });
  it.each(['ETH', 'BTC', 'SOL', 'PLS', 'USDC'])('supports the selected %s independently of payment methods', crypto => {
    expect(priceDisplay({ ...fixture, crypto }).secondaryText).toMatch(new RegExp(` ${crypto}\\)$`));
  });
  it('No Crypto means no parentheses', () => expect(priceDisplay({ ...fixture, crypto: 'NONE' }).secondaryText).toBe(''));
  it.each([0, -1, Number.NaN, Number.POSITIVE_INFINITY, undefined])('does not invent a missing or invalid crypto rate %s', rate => {
    const result = priceDisplay({ ...fixture, cryptoPrices: { ETH: rate! } });
    expect(result.secondaryText).toBe('(ETH unavailable)');
    expect(result.cryptoAmount).toBeUndefined();
  });
  it('does not assume an unknown fiat rate is one USD', () => {
    expect(priceDisplay({ ...fixture, fiatRates: {} }).primaryText).toBe('USD unavailable');
  });
  it('does not invent a currency for legacy orders', () => {
    expect(priceDisplay({ ...fixture, currency: null }).primaryText).toBe('Price unavailable');
  });
  it('keeps source price while rates load, without flashing a stale conversion', () => {
    expect(priceDisplay({ ...fixture, loading: true }).primaryText).toBe('USD …');
    expect(priceDisplay({ ...fixture, fiat: 'NOK', loading: true }).primaryText).toMatch(/NOK\s39\.00/);
  });
  it('zero is zero but tiny nonzero crypto is never displayed as zero', () => {
    expect(priceDisplay({ ...fixture, amount: 0 }).secondaryText).toBe('(0 ETH)');
    expect(priceDisplay({ ...fixture, amount: 0.00001, crypto: 'BTC' }).secondaryText).toBe('(<0.00000001 BTC)');
  });
  it('marks stale estimates and rejects invalid inputs', () => {
    expect(priceDisplay({ ...fixture, stale: true }).isStale).toBe(true);
    expect(priceDisplay({ ...fixture, amount: Number.NaN }).primaryText).toBe('Price unavailable');
    expect(priceDisplay({ ...fixture, currency: 'INVALID' }).primaryText).toBe('Price unavailable');
  });
});
