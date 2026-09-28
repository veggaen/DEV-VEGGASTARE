/** @fileOverview Display-only catalog ranges use a common USD basis; never use these for settlement. @stability stable */
import { z } from 'zod';
import type { Prisma } from '@/generated/prisma/client';

export const catalogCurrencies = ['USD', 'NOK', 'EUR', 'GBP', 'SEK', 'DKK', 'CHF', 'JPY', 'CAD', 'AUD'] as const;
// Listing currency is the existing Prisma enum, separate from display currencies.
const listingCurrencies = ['USD', 'NOK', 'EUR', 'GBP'] as const;
const bound = z.coerce.number().finite().nonnegative().max(1_000_000_000_000);

export function parseCatalogPriceFilter(params: URLSearchParams) {
  return z.object({ min: bound.default(0), max: bound.optional(), currency: z.enum(catalogCurrencies).default('USD') })
    .refine(value => value.max === undefined || value.max >= value.min, 'Maximum price must be at least minimum price')
    .safeParse({ min: params.get('minPrice') ?? undefined, max: params.get('maxPrice') ?? undefined, currency: params.get('priceCurrency') ?? undefined });
}

export function fiatRate(currency: string, rates: Record<string, number>): number | null {
  const rate = currency.toUpperCase() === 'USD' ? 1 : rates[currency.toUpperCase()];
  return Number.isFinite(rate) && rate > 0 ? rate : null;
}

/** Convert the bounds, not the rows: filtering stays in SQL before pagination. */
export function catalogPriceWhere(min: number, max: number | undefined, currency: string, rates: Record<string, number>): Prisma.ProductWhereInput {
  const targetRate = fiatRate(currency, rates);
  if (!targetRate) throw new Error('Display currency rate unavailable');
  return { OR: listingCurrencies.flatMap(source => {
    const sourceRate = fiatRate(source, rates);
    if (!sourceRate) return [];
    return [{ priceCurrency: source, price: {
      gte: source === currency ? min : min * targetRate / sourceRate,
      ...(max !== undefined && Number.isFinite(max) ? { lte: source === currency ? max : max * targetRate / sourceRate } : {}),
    } }];
  }) };
}

export function catalogRangeUsd(groups: { priceCurrency: string; _min: { price: unknown }; _max: { price: unknown } }[], rates: Record<string, number>) {
  const ranges = groups.flatMap(group => {
    const rate = fiatRate(group.priceCurrency, rates);
    const min = Number(group._min.price), max = Number(group._max.price);
    return rate && group._min.price != null && group._max.price != null && Number.isFinite(min) && Number.isFinite(max)
      ? [{ min: min * rate, max: max * rate }] : [];
  });
  return { min: ranges.length ? Math.min(...ranges.map(range => range.min)) : 0, max: ranges.length ? Math.max(...ranges.map(range => range.max)) : 0 };
}
