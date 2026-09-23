/** @fileOverview Pure display-only conversions. Never use these amounts to create or settle payments. @stability stable */
export interface PriceDisplayParts {
  primaryText: string;
  secondaryText: string;
  fiatAmount: number;
  fiatCurrency: string;
  cryptoAmount?: number;
  cryptoSymbol?: string;
  originalAmount?: number;
  originalCurrency?: string;
  isStale: boolean;
  isEstimate: boolean;
}

const positiveRate = (value: number | undefined) => typeof value === 'number' && Number.isFinite(value) && value > 0;
const cryptoFormat = new Intl.NumberFormat('en-US', { maximumFractionDigits: 8 });
const fiatFormats = new Map<string, Intl.NumberFormat>();

export function priceDisplay({ amount, currency, fiat, crypto, fiatRates, cryptoPrices, loading = false, stale = false }: {
  amount: number; currency?: string | null; fiat: string; crypto: string;
  /** USD value of one fiat unit; not units per USD. */
  fiatRates: Record<string, number>; cryptoPrices: Record<string, number>;
  loading?: boolean; stale?: boolean;
}): PriceDisplayParts {
  const source = currency?.toUpperCase();
  const target = fiat.toUpperCase();
  const token = crypto.toUpperCase();
  const parts: PriceDisplayParts = { primaryText: 'Price unavailable', secondaryText: '', fiatAmount: Number.NaN, fiatCurrency: target, originalAmount: amount, originalCurrency: source, isStale: stale, isEstimate: source !== target || token !== 'NONE' };
  if (!Number.isFinite(amount) || !source || !/^[A-Z]{3}$/.test(source) || !/^[A-Z]{3}$/.test(target)) return parts;
  const sourceRate = source === 'USD' ? 1 : fiatRates[source];
  const targetRate = target === 'USD' ? 1 : fiatRates[target];
  const usd = positiveRate(sourceRate) && !loading ? amount * sourceRate : Number.NaN;
  parts.fiatAmount = source === target ? amount : positiveRate(targetRate) ? usd / targetRate : Number.NaN;
  if (Number.isFinite(parts.fiatAmount)) {
    let formatter = fiatFormats.get(target);
    if (!formatter) {
      formatter = new Intl.NumberFormat('en-US', { style: 'currency', currency: target, currencyDisplay: 'code' });
      fiatFormats.set(target, formatter);
    }
    parts.primaryText = formatter.format(parts.fiatAmount);
  } else parts.primaryText = loading ? `${target} …` : `${target} unavailable`;
  if (token !== 'NONE') {
    const rate = cryptoPrices[token];
    const converted = positiveRate(rate) ? usd / rate : Number.NaN;
    if (Number.isFinite(converted)) {
      parts.cryptoAmount = converted;
      parts.cryptoSymbol = token;
      const text = converted !== 0 && Math.abs(converted) < 0.00000001 ? `${converted < 0 ? '−' : ''}<0.00000001` : cryptoFormat.format(converted);
      parts.secondaryText = `(${text} ${token})`;
    } else parts.secondaryText = `(${token} ${loading ? '…' : 'unavailable'})`;
  }
  return parts;
}
