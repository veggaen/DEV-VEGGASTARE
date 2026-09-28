'use client';
/** @fileOverview Lazy chart renderer with a text/table equivalent in the report. @stability stable */
import { Line } from 'react-chartjs-2';
import { useTheme } from 'next-themes';
import { defaultChartOptions } from '../chartjs';
import { analyticsMetrics, type AnalyticsMetricKey } from '@/lib/analytics/metricsRegistry';
import { displayDay, type GrowthPoint } from '@/lib/analytics/growth';

export default function GrowthLine({ points, metric }: { points: GrowthPoint[]; metric: AnalyticsMetricKey }) {
  const def = analyticsMetrics[metric];
  const { resolvedTheme } = useTheme();
  const color = resolvedTheme === 'light' ? '#475569' : '#cbd5e1';
  return <Line aria-label={def.datasetLabel + ': cumulative count by UTC date. Exact values are available in the data table below.'} role="img"
    data={{ labels: points.map(point => displayDay(point.date)), datasets: [{ label: def.datasetLabel, data: points.map(point => point.value), borderColor: def.colors.stroke, backgroundColor: def.colors.fill, fill: true, tension: 0, pointRadius: points.length === 1 ? 4 : 0, pointHitRadius: 12 }] }}
    options={{ ...defaultChartOptions, animation: false, plugins: { legend: { display: false } }, scales: {
      x: { ticks: { color, maxTicksLimit: 5, maxRotation: 0 }, grid: { display: false } },
      y: { beginAtZero: true, ticks: { color, precision: 0 }, grid: { color: 'rgba(148,163,184,0.12)' } },
    } }} />;
}
