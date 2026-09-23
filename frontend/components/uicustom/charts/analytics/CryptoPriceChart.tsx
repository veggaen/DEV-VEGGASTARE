'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import useSWR from 'swr';
import { Button } from '@/components/ui/button';
import { displayDay } from '@/lib/analytics/growth';
import { coinNames, historyResponseSchema, selectPriceHistory, formatHistoryPrice,
  type HistoryCoin, type HistoryCurrency, type HistoryInterval, type HistoryRange } from '@/lib/analytics/crypto-history';

const PriceHistoryLine = dynamic(() => import('./PriceHistoryLine'), {
  ssr: false, loading: () => <div className="h-full rounded-xl bg-muted motion-safe:animate-pulse" role="status" aria-label="Loading price chart" />,
});
type Filters = { coin: HistoryCoin; currency: HistoryCurrency; range: HistoryRange; interval: HistoryInterval; from: string; to: string };
const defaults: Filters = { coin: 'ethereum', currency: 'usd', range: '30', interval: 'daily', from: '', to: '' };
const fieldClass = 'min-h-12 w-full min-w-0 rounded-lg border border-input bg-background px-3 text-base focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring';
const intervals = { daily: 'Daily observations', weekly: 'Weekly mean', monthly: 'Monthly mean' };

async function fetchHistory(url: string) {
  let response: Response;
  try { response = await fetch(url, { signal: AbortSignal.timeout(15_000) }); }
  catch { throw new Error('The price service did not respond. Check your connection and try again.'); }
  if (!response.ok) throw new Error(response.status === 429
    ? 'Too many requests. Wait a minute before trying again.'
    : 'Historical prices are temporarily unavailable. Try another asset or try again later.');
  try {
    const history = historyResponseSchema.parse(await response.json());
    const query = new URL(url, 'https://veggat.com').searchParams;
    if (history.coin !== query.get('crypto') || history.currency !== query.get('vs_currency')) throw new Error('Mismatched history');
    return history;
  } catch { throw new Error('The price service returned an unreadable response. Please try again.'); }
}

export default function CryptoPriceChart() {
  const [filters, setFilters] = useState<Filters>(defaults);
  const [tablePage, setTablePage] = useState(0);
  const endpoint = '/api/analytics/crypto-price?' + new URLSearchParams({ crypto: filters.coin, vs_currency: filters.currency, interval: 'daily', days: '365' });
  const request = useSWR(endpoint, fetchHistory, { revalidateOnFocus: false, shouldRetryOnError: false, dedupingInterval: 60_000, keepPreviousData: false });
  const history = request.data?.coin === filters.coin && request.data?.currency === filters.currency ? request.data : undefined;
  const error = request.error instanceof Error ? request.error.message : null;
  const selected = selectPriceHistory(history?.data ?? [], filters.range, filters.from, filters.to, filters.interval);
  const last = selected.points.at(-1);
  const pageCount = Math.max(1, Math.ceil(selected.points.length / 30));
  const pageIndex = Math.min(tablePage, pageCount - 1);
  const rows = selected.points.slice(pageIndex * 30, (pageIndex + 1) * 30);
  const chartLabel = coinNames[filters.coin] + ' · ' + intervals[filters.interval] + ' · ' + filters.currency.toUpperCase();

  function update(patch: Partial<Filters>) {
    setFilters(current => ({ ...current, ...patch }));
    setTablePage(0);
  }

  return <section aria-label="Historical price explorer" className="min-w-0 space-y-5 rounded-2xl border border-border bg-card p-4 sm:p-6">
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      <div className="min-w-0 space-y-2">
        <label htmlFor="price-asset" className="block text-sm font-medium">Asset</label>
        <select id="price-asset" name="asset" className={fieldClass} value={filters.coin} onChange={event => update({ coin: event.target.value as HistoryCoin })}>
          <option value="ethereum">Ethereum</option><option value="bitcoin">Bitcoin</option><option value="wrapped-pulse-wpls">WPLS</option>
        </select>
      </div>
      <div className="min-w-0 space-y-2">
        <label htmlFor="price-currency" className="block text-sm font-medium">Currency</label>
        <select id="price-currency" name="currency" className={fieldClass} value={filters.currency} onChange={event => update({ currency: event.target.value as HistoryCurrency })}>
          <option value="usd">USD</option><option value="eur">EUR</option><option value="nok">NOK</option>
        </select>
      </div>
      <div className="min-w-0 space-y-2">
        <label htmlFor="price-range" className="block text-sm font-medium">Date range</label>
        <select id="price-range" name="range" className={fieldClass} value={filters.range} onChange={event => update(event.target.value === 'custom'
          ? { range: 'custom', from: history?.data.at(-30)?.date ?? history?.data[0]?.date ?? '', to: history?.data.at(-1)?.date ?? '' }
          : { range: event.target.value as HistoryRange })}>
          <option value="7">7 days</option><option value="30">30 days</option><option value="90">90 days</option><option value="365">365 days</option><option value="custom">Custom dates</option>
        </select>
      </div>
      <div className="min-w-0 space-y-2">
        <label htmlFor="price-interval" className="block text-sm font-medium">Display</label>
        <select id="price-interval" name="interval" className={fieldClass} value={filters.interval} onChange={event => update({ interval: event.target.value as HistoryInterval })}>
          <option value="daily">Daily</option><option value="weekly">Weekly mean</option><option value="monthly">Monthly mean</option>
        </select>
      </div>
    </div>
    {filters.range === 'custom' && <div className="grid gap-4 sm:grid-cols-2">
      <div className="min-w-0 space-y-2"><label htmlFor="price-from" className="block text-sm font-medium">Start date (UTC)</label><input id="price-from" name="from" type="date" className={fieldClass} value={filters.from} onChange={event => update({ from: event.target.value })} aria-invalid={!!selected.error} aria-describedby={selected.error ? 'price-date-error' : undefined} /></div>
      <div className="min-w-0 space-y-2"><label htmlFor="price-to" className="block text-sm font-medium">End date (UTC)</label><input id="price-to" name="to" type="date" className={fieldClass} value={filters.to} onChange={event => update({ to: event.target.value })} aria-invalid={!!selected.error} aria-describedby={selected.error ? 'price-date-error' : undefined} /></div>
    </div>}
    {selected.error && <p role="alert" id="price-date-error" className="text-sm text-destructive">{selected.error}</p>}
    <div className="flex flex-wrap gap-3">
      <Button variant="outline" size="touch" onClick={() => { setFilters(defaults); setTablePage(0); }}>Reset filters</Button>
      <Button variant="outline" size="touch" disabled={request.isValidating} onClick={() => { void request.mutate(); }}>{request.isValidating ? 'Loading prices…' : error ? 'Retry prices' : 'Refresh view'}</Button>
    </div>
    {error && <div role="alert" className="space-y-1 rounded-xl border border-destructive/40 p-4 text-sm">
      <p>{error}</p>{history && <p className="text-muted-foreground">Showing the last successfully loaded data for this asset and currency.</p>}
    </div>}
    <div className="min-h-24 space-y-2 rounded-xl border border-border p-4" role="status" aria-live="polite">
      <p className="text-sm font-medium">{chartLabel}</p>
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <p className="break-words text-2xl font-semibold tabular-nums">{last ? formatHistoryPrice(last.price, filters.currency) : '—'}</p>
        <p className="text-sm text-muted-foreground">{last ? selected.points.length + (selected.points.length === 1 ? ' displayed value' : ' displayed values') : request.isLoading ? 'Loading historical prices…' : selected.error ? 'Correct the dates to view prices.' : history ? 'No observations in this date range.' : 'No price data loaded.'}</p>
      </div>
      {last && <p className="text-xs text-muted-foreground">Last displayed {filters.interval === 'daily' ? 'observation' : 'period begins'}: {displayDay(last.date)}. Not a live quote.</p>}
    </div>
    <div className="h-80 min-w-0 sm:h-96">
      {request.isLoading ? <div role="status" aria-label="Loading historical price data" className="h-full rounded-xl bg-muted motion-safe:animate-pulse" />
        : selected.points.length > 0 ? <PriceHistoryLine points={selected.points} currency={filters.currency} label={chartLabel} />
        : <div className="flex h-full items-center justify-center rounded-xl bg-muted/40 p-6 text-center text-sm text-muted-foreground">{selected.error ? 'Choose valid dates to view the chart.' : error ? 'Use Retry prices or choose another asset.' : 'No observations available. Try another date range or asset.'}</div>}
    </div>
    <p className="text-sm leading-relaxed text-muted-foreground">Date ranges end at the latest available observation. Daily values use the latest observation for each UTC day. Weekly means start on Monday; monthly means use calendar months. Averages include only available days in the selected range, including partial periods.</p>
    {history && <p className="text-xs leading-relaxed text-muted-foreground">Provider response retrieved {new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }).format(new Date(history.fetchedAt))} UTC. Refresh view reuses the hourly cache.</p>}
    {rows.length > 0 && <details className="rounded-xl border border-border">
      <summary className="min-h-12 cursor-pointer rounded-xl px-4 py-3 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">View price data table</summary>
      <div className="max-h-72 overflow-auto overscroll-contain px-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring" tabIndex={0} role="region" aria-label="Scrollable price observations">
        <table className="w-full text-left text-sm tabular-nums"><caption className="pb-3 text-left text-muted-foreground">{chartLabel}</caption>
          <thead className="sticky top-0 bg-card"><tr><th scope="col" className="py-3 pr-2">{filters.interval === 'daily' ? 'Date (UTC)' : 'Period starts (UTC)'}</th><th scope="col" className="py-3 text-right">{filters.currency.toUpperCase()}</th></tr></thead>
          <tbody>{rows.map(point => <tr key={point.date} className="border-t border-border"><th scope="row" className="py-3 pr-2 font-normal">{displayDay(point.date)}</th><td className="py-3 text-right">{formatHistoryPrice(point.price, filters.currency)}</td></tr>)}</tbody>
        </table>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 p-3">
        <Button variant="outline" size="lg" disabled={pageIndex === 0} onClick={() => setTablePage(pageIndex - 1)}>Previous rows</Button>
        <span className="text-xs tabular-nums">Page {pageIndex + 1} of {pageCount}</span>
        <Button variant="outline" size="lg" disabled={pageIndex >= pageCount - 1} onClick={() => setTablePage(pageIndex + 1)}>Next rows</Button>
      </div>
    </details>}
  </section>;
}
