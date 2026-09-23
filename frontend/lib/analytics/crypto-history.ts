/** @fileOverview Bounded price-history contracts and calendar-accurate UTC aggregation. @stability stable */
import { z } from 'zod';
import { validDay } from './growth';

export const coinSchema = z.enum(['ethereum', 'bitcoin', 'wrapped-pulse-wpls']);
export const currencySchema = z.enum(['usd', 'eur', 'nok']);
export const intervalSchema = z.enum(['daily', 'weekly', 'monthly']);
export type HistoryCoin = z.infer<typeof coinSchema>;
export type HistoryCurrency = z.infer<typeof currencySchema>;
export type HistoryInterval = z.infer<typeof intervalSchema>;
export type HistoryRange = '7' | '30' | '90' | '365' | 'custom';
export type PricePoint = { date: string; price: number };
export const coinNames: Record<HistoryCoin, string> = { ethereum: 'Ethereum', bitcoin: 'Bitcoin', 'wrapped-pulse-wpls': 'Wrapped Pulse (WPLS)' };
const daySchema = z.string().refine(validDay, 'Enter a valid UTC date (YYYY-MM-DD)');
const DAY = 86_400_000;

export const historyQuerySchema = z.object({
  crypto: coinSchema.default('ethereum'),
  vs_currency: currencySchema.default('usd'),
  interval: intervalSchema.default('daily'),
  days: z.union([z.literal('max').transform(() => 365), z.coerce.number().int().min(1).max(365)]).default(365),
  fromDate: daySchema.optional(), toDate: daySchema.optional(),
}).strict().refine(query => !query.fromDate || !query.toDate || query.fromDate <= query.toDate, 'End date must follow start date');

export const historyResponseSchema = z.object({
  coin: coinSchema, currency: currencySchema, fetchedAt: z.string().datetime(),
  data: z.array(z.object({ date: daySchema, price: z.number().finite().nonnegative() }).strict()).max(367),
}).strict();

export function normalizeProviderPrices(input: unknown): PricePoint[] {
  const parsed = z.object({ prices: z.array(z.tuple([
    z.number().int().min(0).max(8_640_000_000_000_000), z.number().finite().nonnegative(),
  ])).max(1000) }).parse(input);
  const days = new Map<string, { time: number; price: number }>();
  for (const [time, price] of parsed.prices) {
    const date = new Date(time).toISOString().slice(0, 10);
    if (!validDay(date)) throw new Error('Invalid provider date');
    if (!days.has(date) || time > days.get(date)!.time) days.set(date, { time, price });
  }
  if (days.size > 367) throw new Error('Unexpected daily history length');
  return [...days].sort(([a], [b]) => a.localeCompare(b)).map(([date, point]) => ({ date, price: point.price }));
}

export function filterPriceHistory(points: PricePoint[], days: number, from?: string, to?: string): PricePoint[] {
  const latest = points.at(-1)?.date;
  if (!latest) return [];
  const earliest = new Date(Date.parse(latest + 'T00:00:00Z') - (days - 1) * DAY).toISOString().slice(0, 10);
  return points.filter(point => point.date >= earliest && (!from || point.date >= from) && (!to || point.date <= to));
}

export function aggregatePriceHistory(points: PricePoint[], interval: HistoryInterval): PricePoint[] {
  if (interval === 'daily') return points;
  const buckets = new Map<string, { mean: number; count: number }>();
  for (const point of points) {
    const date = new Date(point.date + 'T00:00:00Z');
    if (interval === 'weekly') date.setUTCDate(date.getUTCDate() - (date.getUTCDay() + 6) % 7);
    else date.setUTCDate(1);
    const key = date.toISOString().slice(0, 10);
    const bucket = buckets.get(key) ?? { mean: 0, count: 0 };
    bucket.count++;
    bucket.mean += (point.price - bucket.mean) / bucket.count;
    buckets.set(key, bucket);
  }
  return [...buckets].sort(([a], [b]) => a.localeCompare(b)).map(([date, { mean }]) => ({ date, price: mean }));
}

export function selectPriceHistory(points: PricePoint[], range: HistoryRange, from: string, to: string, interval: HistoryInterval) {
  if (range === 'custom') {
    if (!validDay(from) || !validDay(to)) return { points: [], error: 'Enter a valid start and end date.' };
    if (from > to) return { points: [], error: 'End date must be on or after start date.' };
  }
  const selected = filterPriceHistory(points, range === 'custom' ? 365 : Number(range), range === 'custom' ? from : undefined, range === 'custom' ? to : undefined);
  return { points: aggregatePriceHistory(selected, interval), error: null };
}

export function formatHistoryPrice(value: number, currency: HistoryCurrency): string {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: currency.toUpperCase(), currencyDisplay: 'code', minimumFractionDigits: 2, maximumFractionDigits: value > 0 && value < 1 ? 8 : 2 }).format(value);
}
