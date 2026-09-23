'use client';
/** @fileOverview Lazy price-history canvas with accessible tabular equivalent in its parent. @stability stable */
import { Line } from 'react-chartjs-2';
import { useTheme } from 'next-themes';
import { defaultChartOptions } from '../chartjs';
import { displayDay } from '@/lib/analytics/growth';
import { formatHistoryPrice, type PricePoint, type HistoryCurrency } from '@/lib/analytics/crypto-history';

export default function PriceHistoryLine({ points, currency, label }: { points: PricePoint[]; currency: HistoryCurrency; label: string }) {
  const { resolvedTheme } = useTheme();
  const color = resolvedTheme === 'light' ? '#475569' : '#cbd5e1';
  const priceTicks = new Intl.NumberFormat('en-GB', { maximumFractionDigits: 8 });
  return <Line role="img" aria-label={label + '. Exact values are in the price data table below.'}
    data={{ labels: points.map(point => displayDay(point.date)), datasets: [{ label, data: points.map(point => point.price), borderColor: resolvedTheme === 'light' ? '#15803d' : '#22c55e', backgroundColor: 'rgba(34,197,94,0.16)', fill: true, tension: 0, pointRadius: points.length === 1 ? 4 : 0, pointHitRadius: 12 }] }}
    options={{ ...defaultChartOptions, animation: false, plugins: { legend: { display: false }, tooltip: { callbacks: { label: context => formatHistoryPrice(Number(context.parsed.y), currency) } } }, scales: {
      x: { ticks: { color, maxTicksLimit: 4, maxRotation: 0, autoSkipPadding: 20 }, grid: { display: false } },
      y: { beginAtZero: true, ticks: { color, maxTicksLimit: 6, callback: value => priceTicks.format(Number(value)) }, grid: { color: 'rgba(148,163,184,0.12)' } },
    } }} />;
}
