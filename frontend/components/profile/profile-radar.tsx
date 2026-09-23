'use client';
/** @fileOverview Load the chart engine only when the experimental Reach tab is opened. @stability experimental */
import type { ComponentProps } from 'react';
import { Chart as ChartJS, RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend } from 'chart.js';
import { Radar } from 'react-chartjs-2';
ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend);
export default function ProfileRadar(props: ComponentProps<typeof Radar>) {
  return <Radar aria-label="Reach pillar distribution" role="img" {...props} />;
}
