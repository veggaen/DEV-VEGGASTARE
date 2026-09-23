'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { useSession } from 'next-auth/react';
import { Button } from '@/components/ui/button';
import { useFetchAnalytics } from '@/hooks/useFetchAnalytics';
import { analyticsMetrics, type AnalyticsMetricKey } from '@/lib/analytics/metricsRegistry';
import { displayDay, sampleGrowth, selectGrowth, type GrowthPoint, type GrowthRange } from '@/lib/analytics/growth';
import AnalyticsShell from './AnalyticsShell';

const GrowthLine = dynamic(() => import('./GrowthLine'), { ssr: false, loading: () => <div className="h-full rounded-lg bg-muted motion-safe:animate-pulse" role="status" aria-label="Loading chart" /> });
const fieldClass = 'min-h-12 w-full min-w-0 rounded-lg border border-input bg-background px-3 text-base focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring';

function ReportSkeleton() {
  return <div role="status" aria-label="Loading analytics" className="space-y-5 rounded-2xl border border-border bg-card p-4 sm:p-6"><div className="h-32 rounded-xl bg-muted motion-safe:animate-pulse sm:h-20" /><div className="h-20 rounded-lg bg-muted motion-safe:animate-pulse sm:w-1/3" /><div className="grid grid-cols-2 gap-3"><div className="h-24 rounded-xl bg-muted motion-safe:animate-pulse" /><div className="h-24 rounded-xl bg-muted motion-safe:animate-pulse" /></div><div className="h-5 rounded bg-muted motion-safe:animate-pulse" /><div className="h-80 rounded-lg bg-muted motion-safe:animate-pulse sm:h-96" /><div className="h-12 rounded-xl bg-muted motion-safe:animate-pulse" /></div>;
}

function GrowthReport({ points, metric, preview }: { points: GrowthPoint[]; metric: AnalyticsMetricKey; preview: boolean }) {
  const [range, setRange] = useState<GrowthRange>('30');
  const [from, setFrom] = useState(points[0]?.date ?? '');
  const [to, setTo] = useState(points.at(-1)?.date ?? '');
  const selected = selectGrowth(points, range, from, to);
  const last = selected.points.at(-1);
  const first = selected.points[0];
  const previous = first ? points.filter(point => point.date < first.date).at(-1)?.value ?? 0 : 0;
  const def = analyticsMetrics[metric];
  return <section aria-label={def.datasetLabel + ' growth report'} className="space-y-5 rounded-2xl border border-border bg-card p-4 sm:p-6">
    <div className="rounded-xl border border-border bg-muted/40 p-4 text-sm leading-relaxed">
      <p className="font-semibold">{preview ? 'Illustrative sample · not live platform data' : 'Live platform data · administrator access'}</p>
      <p className="mt-1 text-muted-foreground">{preview ? 'Explore this report with fictional counts from January–March 2026. No private user or business data is loaded.' : 'Cumulative creation counts, by UTC day. Queries include up to the earliest 10,000 records; these are not sales or revenue figures.'}</p>
    </div>
    <div className="grid items-start gap-4 sm:grid-cols-3">
      <label className="min-w-0 space-y-2 text-sm font-medium" htmlFor="growth-range"><span className="block">Date range</span><select id="growth-range" className={fieldClass} value={range} onChange={event => setRange(event.target.value as GrowthRange)}><option value="7">Last 7 days</option><option value="30">Last 30 days</option><option value="all">All available dates</option><option value="custom">Custom dates</option></select></label>
      {range === 'custom' && <><label className="min-w-0 space-y-2 text-sm font-medium" htmlFor="growth-from"><span className="block">Start date (UTC)</span><input id="growth-from" type="date" className={fieldClass} value={from} onChange={event => setFrom(event.target.value)} aria-invalid={!!selected.error} aria-describedby={selected.error ? 'growth-date-error' : undefined} /></label><label className="min-w-0 space-y-2 text-sm font-medium" htmlFor="growth-to"><span className="block">End date (UTC)</span><input id="growth-to" type="date" className={fieldClass} value={to} onChange={event => setTo(event.target.value)} aria-invalid={!!selected.error} aria-describedby={selected.error ? 'growth-date-error' : undefined} /></label></>}
    </div>
    {selected.error && <p id="growth-date-error" role="alert" className="text-sm text-destructive">{selected.error}</p>}
    <dl className="grid grid-cols-2 gap-3">
      <div className="min-w-0 rounded-xl border border-border p-4"><dt className="text-sm text-muted-foreground">Total at range end</dt><dd className="mt-2 text-2xl font-semibold tabular-nums">{last ? last.value.toLocaleString('en-GB') : '—'}</dd></div>
      <div className="min-w-0 rounded-xl border border-border p-4"><dt className="text-sm text-muted-foreground">Added in range</dt><dd className="mt-2 text-2xl font-semibold tabular-nums">{last ? (last.value - previous).toLocaleString('en-GB') : '—'}</dd></div>
    </dl>
    <p role="status" className="text-sm text-muted-foreground">{first && last ? displayDay(first.date) + ' – ' + displayDay(last.date) + ' · ' + selected.points.length + (selected.points.length === 1 ? ' daily value' : ' daily values') : selected.error ? 'Correct the date range to view this report.' : 'No data available for the selected date range.'}</p>
    <div className="h-80 min-w-0 sm:h-96">{selected.points.length > 0 ? <GrowthLine metric={metric} points={selected.points} /> : <div className="flex h-full items-center justify-center rounded-xl bg-muted/40 p-6 text-center text-sm text-muted-foreground">{selected.error ? 'The chart will appear when the dates are valid.' : 'Choose another range to explore available data.'}</div>}</div>
    {selected.points.length > 0 && <details className="rounded-xl border border-border"><summary className="cursor-pointer rounded-xl px-4 py-3 text-sm font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">View data table</summary><div className="max-h-72 overflow-auto overscroll-contain rounded-b-xl px-4 pb-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring" tabIndex={0} role="region" aria-label="Scrollable daily counts"><table className="w-full text-left text-sm tabular-nums"><caption className="pb-3 text-left text-muted-foreground">{preview ? 'Illustrative' : 'Platform'} cumulative {def.datasetLabel.toLowerCase()} · UTC dates</caption><thead className="sticky top-0 bg-card"><tr><th scope="col" className="py-3">Date</th><th scope="col" className="py-3 text-right">Count</th></tr></thead><tbody>{selected.points.map(point => <tr key={point.date} className="border-t border-border"><th scope="row" className="py-3 font-normal">{displayDay(point.date)}</th><td className="py-3 text-right">{point.value.toLocaleString('en-GB')}</td></tr>)}</tbody></table></div></details>}
  </section>;
}

function LiveReport({ metric, userId }: { metric: AnalyticsMetricKey; userId: string }) {
  const { data, loading, refreshing, error, retry } = useFetchAnalytics(metric, userId);
  if (loading) return <ReportSkeleton />;
  return <div className="space-y-4">
    {error && <div role="alert" className="rounded-xl border border-destructive/40 bg-card p-4"><p className="text-sm">{error}</p><p className="mt-1 text-sm text-muted-foreground">{data ? 'Showing the last successfully loaded report below.' : 'No platform data has been loaded.'}</p></div>}
    <Button variant="outline" size="touch" disabled={refreshing} onClick={retry}>{refreshing ? 'Refreshing…' : error ? 'Retry analytics' : 'Refresh data'}</Button>
    {data && <GrowthReport points={data} metric={metric} preview={false} />}
  </div>;
}

export default function MetricTimeSeriesChart({ metric }: { metric: AnalyticsMetricKey }) {
  const { data: session, status } = useSession();
  const def = analyticsMetrics[metric];
  return <AnalyticsShell title={def.title} description={'Cumulative ' + def.datasetLabel.toLowerCase() + ' created over time. Compare date ranges and inspect the daily counts without relying on chart hover.'}>
    {status === 'loading' ? <ReportSkeleton /> : session?.user?.role === 'ADMIN' && session.user.id ? <LiveReport key={session.user.id} metric={metric} userId={session.user.id} /> : <GrowthReport key={metric} points={sampleGrowth(metric)} metric={metric} preview />}
  </AnalyticsShell>;
}
