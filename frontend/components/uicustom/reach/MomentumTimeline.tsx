'use client';

import React from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { useTheme } from 'next-themes';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

interface TrendPoint {
  date: string;
  momentum: number;
  lifetime?: number;
  views?: number;
  engagements?: number;
}

interface MomentumTimelineProps {
  data: TrendPoint[];
  accentColor?: string;
  height?: number;
  showViews?: boolean;
  className?: string;
}

export default function MomentumTimeline({
  data,
  accentColor = '#10b981',
  height = 220,
  showViews = false,
  className = '',
}: MomentumTimelineProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  if (!data.length) {
    return (
      <div className={`flex items-center justify-center text-sm text-muted-foreground ${className}`} style={{ height }}>
        No momentum data yet — activity will populate this chart.
      </div>
    );
  }

  const labels = data.map(d => {
    const date = new Date(d.date);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  });

  const datasets = [
    {
      label: 'Momentum',
      data: data.map(d => d.momentum),
      borderColor: accentColor,
      backgroundColor: `${accentColor}20`,
      fill: true,
      tension: 0.4,
      pointRadius: 3,
      pointHoverRadius: 6,
      pointBackgroundColor: accentColor,
      borderWidth: 2,
    },
    ...(showViews && data[0]?.views !== undefined ? [{
      label: 'Views',
      data: data.map(d => d.views || 0),
      borderColor: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.2)',
      backgroundColor: 'transparent',
      borderDash: [4, 4],
      tension: 0.4,
      pointRadius: 0,
      borderWidth: 1.5,
      yAxisID: 'y1' as const,
    }] : []),
  ];

  return (
    <div className={className} style={{ height }}>
      <Line
        data={{ labels, datasets }}
        options={{
          responsive: true,
          maintainAspectRatio: false,
          interaction: {
            mode: 'index',
            intersect: false,
          },
          plugins: {
            legend: {
              display: showViews,
              position: 'top',
              labels: {
                color: isDark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)',
                font: { size: 11 },
                usePointStyle: true,
                pointStyleWidth: 8,
              },
            },
            tooltip: {
              backgroundColor: isDark ? 'rgba(0,0,0,0.9)' : 'rgba(255,255,255,0.95)',
              titleColor: isDark ? '#fff' : '#000',
              bodyColor: isDark ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.7)',
              borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
              borderWidth: 1,
              cornerRadius: 8,
              padding: 10,
            },
          },
          scales: {
            x: {
              grid: {
                color: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
              },
              ticks: {
                color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)',
                font: { size: 10 },
                maxRotation: 0,
                autoSkip: true,
                maxTicksLimit: 10,
              },
            },
            y: {
              beginAtZero: true,
              grid: {
                color: isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
              },
              ticks: {
                color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)',
                font: { size: 10 },
              },
            },
            ...(showViews ? {
              y1: {
                position: 'right' as const,
                beginAtZero: true,
                grid: { display: false },
                ticks: {
                  color: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.2)',
                  font: { size: 10 },
                },
              },
            } : {}),
          },
        }}
      />
    </div>
  );
}
