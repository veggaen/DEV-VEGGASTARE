'use client';

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Tooltip,
  Legend,
  Filler,
  type ChartOptions,
} from 'chart.js';

// Register once on the client.
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Tooltip, Legend, Filler);

// Base chart options that work for both line and bar charts
const baseChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      labels: {
        color: '#e5e7eb',
      },
    },
    tooltip: {
      enabled: true,
    },
  },
  scales: {
    x: {
      ticks: { color: '#cbd5e1' },
      grid: { color: 'rgba(148,163,184,0.12)' },
    },
    y: {
      ticks: { color: '#cbd5e1' },
      grid: { color: 'rgba(148,163,184,0.12)' },
      beginAtZero: true,
    },
  },
} as const;

export const defaultChartOptions: ChartOptions<'line'> = baseChartOptions;
export const defaultBarChartOptions: ChartOptions<'bar'> = baseChartOptions;
