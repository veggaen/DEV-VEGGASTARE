/** @fileOverview Validated display-only quote provenance. Never use for payment settlement. @stability stable */
export const DISPLAY_RATE_CACHE_KEY = 'veggastare_currency_rates';
export const FIAT_RATE_TTL = 60 * 60 * 1000;
export const CRYPTO_RATE_TTL = 5 * 60 * 1000;
export const MAX_DISPLAY_RATE_AGE = 7 * 24 * 60 * 60 * 1000;
type RateBlock = { values: Record<string, number>; timestamp: number; fresh: boolean };
export type DisplayRateSnapshot = { version: 2; fiat: RateBlock | null; crypto: RateBlock | null };
export const emptyDisplayRates = (): DisplayRateSnapshot => ({ version: 2, fiat: null, crypto: null });
const record = (value: unknown): value is Record<string, unknown> => !!value && typeof value === 'object' && !Array.isArray(value);

function block(value: unknown, field: string, now: number, fiat: boolean): RateBlock | null {
  if (!record(value) || !record(value[field]) || typeof value.timestamp !== 'number' || !Number.isFinite(value.timestamp)
    || value.timestamp <= 0 || value.timestamp > now + 60_000 || now - value.timestamp > MAX_DISPLAY_RATE_AGE || typeof value.fresh !== 'boolean') return null;
  const values = Object.fromEntries(Object.entries(value[field]).filter(([key, amount]) =>
    (fiat ? /^[A-Z]{3}$/ : /^[A-Z][A-Z0-9]{1,11}$/).test(key) && typeof amount === 'number' && Number.isFinite(amount) && amount > 0));
  if (!Object.keys(values).length) return null;
  if (fiat) values.USD = 1;
  return { values: values as Record<string, number>, timestamp: value.timestamp, fresh: value.fresh };
}
export function readDisplayRateResponse(value: unknown, now = Date.now()): DisplayRateSnapshot | null {
  if (!record(value) || value.success !== true) return null;
  const fiat = block(value.fiat, 'rates', now, true), crypto = block(value.crypto, 'prices', now, false);
  return fiat || crypto ? { version: 2, fiat, crypto } : null;
}
export function readDisplayRateCache(value: unknown, now = Date.now()): DisplayRateSnapshot | null {
  if (!record(value) || value.version !== 2) return null;
  const fiat = block(value.fiat, 'values', now, true), crypto = block(value.crypto, 'values', now, false);
  return fiat || crypto ? { version: 2, fiat, crypto } : null;
}
export function markDisplayRatesStale(snapshot: DisplayRateSnapshot): DisplayRateSnapshot {
  return { version: 2, fiat: snapshot.fiat && { ...snapshot.fiat, fresh: false }, crypto: snapshot.crypto && { ...snapshot.crypto, fresh: false } };
}
export function mergeDisplayRates(previous: DisplayRateSnapshot, next: DisplayRateSnapshot): DisplayRateSnapshot {
  const stale = markDisplayRatesStale(previous);
  return { version: 2, fiat: next.fiat ?? stale.fiat, crypto: next.crypto ?? stale.crypto };
}
export function displayRateState(snapshot: DisplayRateSnapshot, now = Date.now()) {
  const fiat = snapshot.fiat && now - snapshot.fiat.timestamp <= MAX_DISPLAY_RATE_AGE ? snapshot.fiat : null;
  const crypto = snapshot.crypto && now - snapshot.crypto.timestamp <= MAX_DISPLAY_RATE_AGE ? snapshot.crypto : null;
  const timestamp = Math.max(fiat?.timestamp ?? 0, crypto?.timestamp ?? 0);
  return { fiatRates: fiat?.values ?? { USD: 1 }, cryptoPrices: crypto?.values ?? {}, lastUpdated: timestamp ? new Date(timestamp) : null,
    isFiatStale: !fiat || !fiat.fresh || now - fiat.timestamp >= FIAT_RATE_TTL,
    isCryptoStale: !crypto || !crypto.fresh || now - crypto.timestamp >= CRYPTO_RATE_TTL };
}
export function displayConversions(fiat: Record<string, number>, crypto: Record<string, number>) {
  const quote = (rates: Record<string, number>, symbol: string, isFiat = false) => {
    const key = symbol.toUpperCase(), value = isFiat && key === 'USD' ? 1 : rates[key];
    return Number.isFinite(value) && value > 0 ? value : Number.NaN;
  };
  const convertToUSD = (amount: number, from: string) => amount * quote(fiat, from, true);
  const convertFromUSD = (amount: number, to: string) => amount / quote(fiat, to, true);
  const convertUSDToCrypto = (amount: number, to: string) => amount / quote(crypto, to);
  return { convertToUSD, convertFromUSD, convertUSDToCrypto,
    convertCurrency: (amount: number, from: string, to: string) => from.toUpperCase() === to.toUpperCase() && /^[A-Z]{3}$/i.test(from) ? amount : convertFromUSD(convertToUSD(amount, from), to),
    convertCryptoToUSD: (amount: number, from: string) => amount * quote(crypto, from),
    convertFiatToCrypto: (amount: number, from: string, to: string) => convertUSDToCrypto(convertToUSD(amount, from), to) };
}
