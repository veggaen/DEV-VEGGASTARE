/** @fileOverview Validated UTC growth data and explicitly illustrative previews. @stability stable */
import { AnalyticsCompaniesResponseSchema, AnalyticsProductsResponseSchema, AnalyticsUsersResponseSchema } from '@/lib/types/analytics';
import type { AnalyticsMetricKey } from './metricsRegistry';

export type GrowthPoint = { date: string; value: number };
export type GrowthRange = 'all' | '7' | '30' | 'custom';
const DAY = 86_400_000;

export function validDay(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(value + 'T00:00:00.000Z');
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function parseGrowth(metric: AnalyticsMetricKey, input: unknown): GrowthPoint[] {
  const schemas = { users: AnalyticsUsersResponseSchema, products: AnalyticsProductsResponseSchema, companies: AnalyticsCompaniesResponseSchema };
  const parsed = schemas[metric].parse(input);
  if ('error' in parsed) return [];
  if (parsed.data.length !== 1) throw new Error('Unexpected growth series');
  const seen = new Set<string>();
  return parsed.data[0].data.map(point => {
    const date = point.date.slice(0, 10);
    if (!validDay(date) || !Number.isFinite(Date.parse(point.date)) || seen.has(date)) throw new Error('Invalid growth date');
    seen.add(date);
    return { date, value: 'companies' in point ? point.companies : point.users };
  }).sort((a, b) => a.date.localeCompare(b.date));
}

// Fixed dates and counts: this preview never impersonates live business data.
export function sampleGrowth(metric: AnalyticsMetricKey): GrowthPoint[] {
  let value = 0;
  const scale = { users: 4, products: 2, companies: 1 }[metric];
  return Array.from({ length: 90 }, (_, day) => {
    value += day % 7 === 0 ? 0 : scale + (day % 3);
    return { date: new Date(Date.UTC(2026, 0, 1) + day * DAY).toISOString().slice(0, 10), value };
  });
}

export function selectGrowth(points: GrowthPoint[], range: GrowthRange, from: string, to: string): { points: GrowthPoint[]; error: string | null } {
  if (range === 'custom') {
    if (!validDay(from) || !validDay(to)) return { points: [], error: 'Enter a valid start and end date.' };
    if (from > to) return { points: [], error: 'End date must be on or after start date.' };
    return { points: points.filter(point => point.date >= from && point.date <= to), error: null };
  }
  const latest = points.at(-1)?.date;
  if (range === 'all' || !latest) return { points, error: null };
  const earliest = new Date(Date.parse(latest + 'T00:00:00Z') - (Number(range) - 1) * DAY).toISOString().slice(0, 10);
  return { points: points.filter(point => point.date >= earliest), error: null };
}

export function displayDay(day: string): string {
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(new Date(day + 'T00:00:00Z'));
}
