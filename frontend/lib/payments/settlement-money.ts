/** @fileOverview Exact two-decimal settlement arithmetic. Reference FX never substitutes for a payment proof. @stability experimental */
import { z } from 'zod';

// All six currencies exposed by Veggat's fiat selector support two decimals in
// PayPal Orders v2. Do not extend this list to zero/three-decimal currencies.
export const SettlementCurrency = z.enum(['NOK', 'USD', 'EUR', 'GBP', 'SEK', 'DKK']);
export type SettlementCurrency = z.infer<typeof SettlementCurrency>;
export const MinorUnits = z.number().int().min(0).max(100_000_000);
export const SettlementMoney = z.object({ currency: SettlementCurrency, minor: MinorUnits }).strict();
export type SettlementMoney = z.infer<typeof SettlementMoney>;

export class SettlementError extends Error {
  constructor(public readonly code: string) { super(code); }
}

/** User-entered amount, not a client-specified price for an arbitrary product.
 * Deliberately rejects exponent notation, grouping separators and silent rounding. */
export function parseSpendMinor(input: unknown): number {
  if (typeof input !== 'string' || input.length > 32) throw new SettlementError('INVALID_SPEND_AMOUNT');
  const text = input.trim().replace(',', '.');
  if (!/^(0|[1-9]\d{0,6})(?:\.\d{1,2})?$/.test(text)) throw new SettlementError('INVALID_SPEND_AMOUNT');
  const [whole, fraction = ''] = text.split('.');
  const minor = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
  if (!MinorUnits.safeParse(minor).success || minor === 0) throw new SettlementError('INVALID_SPEND_AMOUNT');
  return minor;
}

/** Provider money is canonical: never normalize an invalid provider response. */
export function parseProviderMinor(input: unknown): number {
  if (typeof input !== 'string' || !/^(0|[1-9]\d{0,6})\.\d{2}$/.test(input)) throw new SettlementError('INVALID_PROVIDER_AMOUNT');
  const [whole, fraction] = input.split('.');
  const minor = Number(whole) * 100 + Number(fraction);
  if (!MinorUnits.safeParse(minor).success) throw new SettlementError('INVALID_PROVIDER_AMOUNT');
  return minor;
}

export function formatMinor(minor: number) {
  if (!MinorUnits.safeParse(minor).success) throw new SettlementError('INVALID_AMOUNT');
  return `${Math.floor(minor / 100)}.${String(minor % 100).padStart(2, '0')}`;
}

// Decimal reference rate: selected currency units per NOK. Persist the decimal
// string with the quote; do not reconstruct a paid order from tomorrow's rates.
export const DecimalRate = z.string().regex(/^(0|[1-9]\d{0,2})(?:\.\d{1,12})?$/)
  .refine(value => Number(value) >= 0.001 && Number(value) <= 100, 'Unsupported FX rate');

function fraction(rate: string) {
  if (!DecimalRate.safeParse(rate).success) throw new SettlementError('INVALID_SETTLEMENT_RATE');
  const [whole, decimal = ''] = rate.split('.');
  return { numerator: BigInt(whole + decimal), denominator: BigInt(10) ** BigInt(decimal.length) };
}

export function roundedRatio(value: number, numerator: bigint, denominator: bigint, round: 'up' | 'down') {
  if (!MinorUnits.safeParse(value).success || numerator < BigInt(0) || denominator <= BigInt(0)) throw new SettlementError('INVALID_AMOUNT');
  const product = BigInt(value) * numerator;
  const result = Number((product + (round === 'up' ? denominator - BigInt(1) : BigInt(0))) / denominator);
  if (!MinorUnits.safeParse(result).success) throw new SettlementError('INVALID_AMOUNT');
  return result;
}

export function nokToMinor(ore: number, rate: string, round: 'up' | 'down' = 'up') {
  const { numerator, denominator } = fraction(rate);
  return roundedRatio(ore, numerator, denominator, round);
}

export function minorToNok(minor: number, rate: string, round: 'up' | 'down') {
  const { numerator, denominator } = fraction(rate);
  return roundedRatio(minor, denominator, numerator, round);
}

export function addBasisPoints(minor: number, bps: number) {
  if (!Number.isSafeInteger(bps) || bps < 0 || bps > 10_000) throw new SettlementError('INVALID_AMOUNT');
  return roundedRatio(minor, BigInt(10_000 + bps), BigInt(10_000), 'up');
}
