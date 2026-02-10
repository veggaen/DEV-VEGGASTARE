'use client';

import React from 'react';
import {
  Chart as ChartJS,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
} from 'chart.js';
import { Radar } from 'react-chartjs-2';
import { useTheme } from 'next-themes';

ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

interface PillarBreakdown {
  visibility: number;
  engagement: number;
  conversion: number;
  loyalty: number;
  growth: number;
  recall: number;
  velocity: number;
}

interface ReachRadarChartProps {
  data: PillarBreakdown;
  accentColor?: string;
  size?: number;
  className?: string;
}

const PILLAR_META = [
  { key: 'visibility', label: 'Visibility', shortLabel: 'Views', icon: '👁️', color: '#10b981' },
  { key: 'engagement', label: 'Engagement', shortLabel: 'Engage', icon: '💬', color: '#3b82f6' },
  { key: 'conversion', label: 'Conversion', shortLabel: 'Convert', icon: '🛒', color: '#f59e0b' },
  { key: 'loyalty', label: 'Loyalty', shortLabel: 'Loyalty', icon: '❤️', color: '#ec4899' },
  { key: 'growth', label: 'Growth', shortLabel: 'Growth', icon: '📈', color: '#8b5cf6' },
  { key: 'recall', label: 'Recall', shortLabel: 'Recall', icon: '🔄', color: '#06b6d4' },
  { key: 'velocity', label: 'Velocity', shortLabel: 'Speed', icon: '⚡', color: '#f97316' },
] as const;

export default function ReachRadarChart({
  data,
  accentColor = '#10b981',
  size = 280,
  className = '',
}: ReachRadarChartProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  const values = PILLAR_META.map(p => data[p.key as keyof PillarBreakdown] || 0);

  return (
    <div className={className} style={{ width: size, height: size, margin: '0 auto' }}>
      <Radar
        data={{
          labels: PILLAR_META.map(p => p.shortLabel),
          datasets: [{
            label: 'Reach Score',
            data: values,
            backgroundColor: `${accentColor}20`,
            borderColor: accentColor,
            borderWidth: 2,
            pointBackgroundColor: PILLAR_META.map(p => p.color),
            pointBorderColor: isDark ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,1)',
            pointBorderWidth: 2,
            pointRadius: 4,
            pointHoverRadius: 6,
          }],
        }}
        options={{
          scales: {
            r: {
              angleLines: {
                color: isDark ? `${accentColor}20` : `${accentColor}30`,
              },
              grid: {
                color: isDark ? `${accentColor}12` : `${accentColor}18`,
                circular: true,
              },
              pointLabels: {
                color: isDark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.7)',
                font: { size: 10, weight: 500 },
                padding: 8,
              },
              ticks: { display: false, stepSize: 20 },
              suggestedMin: 0,
              suggestedMax: 100,
            },
          },
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: isDark ? 'rgba(0,0,0,0.9)' : 'rgba(255,255,255,0.95)',
              titleColor: isDark ? '#fff' : '#000',
              bodyColor: isDark ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.7)',
              borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
              borderWidth: 1,
              cornerRadius: 8,
              padding: 10,
              callbacks: {
                title: (items) => {
                  const pillar = PILLAR_META[items[0].dataIndex];
                  return `${pillar.icon} ${pillar.label}`;
                },
                label: (item) => `Score: ${item.raw}/100`,
              },
            },
          },
          maintainAspectRatio: true,
        }}
      />
      {/* Legend */}
      <div className="mt-3 flex flex-wrap justify-center gap-2">
        {PILLAR_META.map(p => (
          <div key={p.key} className="flex items-center gap-1 text-[10px] text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: p.color }} />
            {p.shortLabel}
          </div>
        ))}
      </div>
    </div>
  );
}

export { PILLAR_META };
export type { PillarBreakdown };
