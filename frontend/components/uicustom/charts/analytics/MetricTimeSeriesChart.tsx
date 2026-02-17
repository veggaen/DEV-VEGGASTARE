'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { Line } from 'react-chartjs-2';
import { defaultChartOptions } from '@/components/uicustom/charts/chartjs';
import { useFetchAnalytics } from '@/hooks/useFetchAnalytics';
import { analyticsMetrics, type AnalyticsMetricKey, type TimeSeriesDatum } from '@/lib/analytics/metricsRegistry';

type Interval = 'daily' | 'monthly' | 'yearly' | 'custom';

function isFullyValidDate(dateString: string | null) {
  if (!dateString) return false;
  const date = new Date(dateString);
  return !isNaN(date.getTime()) && /^\d{4}-\d{2}-\d{2}$/.test(dateString);
}

export default function MetricTimeSeriesChart({ metric }: { metric: AnalyticsMetricKey }) {
  const def = analyticsMetrics[metric];

  const { data, firstDate, lastDate, today, loading, error } = useFetchAnalytics(def.endpoint);

  const [interval, setInterval] = useState<Interval>('daily');
  const [customStartDate, setCustomStartDate] = useState<string>('');
  const [customEndDate, setCustomEndDate] = useState<string>('');

  const availableIntervals = useMemo(() => {
    const intervals: Interval[] = ['daily'];
    if (firstDate && lastDate) {
      const totalDays = (lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24);
      if (totalDays >= 30) intervals.push('monthly');
      if (totalDays >= 365) intervals.push('yearly');
    }
    intervals.push('custom');
    return intervals;
  }, [firstDate, lastDate]);

  useEffect(() => {
    if (interval === 'custom' && firstDate && lastDate) {
      const timeoutId = window.setTimeout(() => {
        setCustomStartDate(firstDate.toISOString().split('T')[0]);
        setCustomEndDate(lastDate.toISOString().split('T')[0]);
      }, 0);
      return () => window.clearTimeout(timeoutId);
    }
  }, [interval, firstDate, lastDate]);

  const filteredSeries = useMemo(() => {
    let startDate: Date;
    let endDate: Date = today;

    if (interval === 'custom') {
      const isStartValid = isFullyValidDate(customStartDate);
      const isEndValid = isFullyValidDate(customEndDate);

      if (!isStartValid && !isEndValid) {
        startDate = firstDate ? new Date(firstDate) : new Date(0);
        endDate = lastDate ? new Date(lastDate) : new Date();
      } else {
        startDate = isStartValid ? new Date(customStartDate) : new Date(firstDate ?? 0);
        endDate = isEndValid ? new Date(customEndDate) : today;

        if (startDate > endDate) {
          startDate = firstDate ? new Date(firstDate) : new Date(0);
          endDate = lastDate ? new Date(lastDate) : new Date();
        }
      }
    } else if (interval === 'yearly') {
      const earliest = firstDate ? new Date(firstDate) : new Date(0);
      startDate = earliest;
      endDate = new Date(earliest);
      endDate.setFullYear(endDate.getFullYear() + 1);
      endDate = endDate > today ? today : endDate;
    } else if (interval === 'monthly') {
      const earliest = firstDate ? new Date(firstDate) : new Date(0);
      startDate = earliest;
      endDate = new Date(earliest);
      endDate.setMonth(endDate.getMonth() + 1);
      endDate = endDate > today ? today : endDate;
    } else {
      startDate = firstDate ? new Date(firstDate) : new Date(0);
    }

    return data.map((series) => ({
      ...series,
      data: (series.data as TimeSeriesDatum[]).filter((d) => d.date >= startDate && d.date <= endDate),
    }));
  }, [data, interval, customStartDate, customEndDate, firstDate, lastDate, today]);

  const chartData = useMemo(() => {
    const dateSet = new Set<number>();
    for (const series of filteredSeries) {
      for (const d of series.data) dateSet.add(new Date(d.date).getTime());
    }

    const dates = Array.from(dateSet)
      .sort((a, b) => a - b)
      .map((t) => new Date(t));

    const labels = dates.map((d) => format(d, 'MMM d'));

    const palette = [
      def.colors,
      { stroke: 'rgba(59,130,246,0.95)', fill: 'rgba(59,130,246,0.20)' },
      { stroke: 'rgba(168,85,247,0.95)', fill: 'rgba(168,85,247,0.20)' },
      { stroke: 'rgba(251,146,60,0.95)', fill: 'rgba(251,146,60,0.20)' },
    ];

    const datasets = filteredSeries.map((series, index) => {
      const byTime = new Map<number, number>(
        (series.data as TimeSeriesDatum[]).map((d) => [new Date(d.date).getTime(), def.value(d)])
      );

      const colors = palette[index % palette.length];
      const label = series.label || (filteredSeries.length === 1 ? def.datasetLabel : `${def.datasetLabel} ${index + 1}`);

      return {
        label,
        data: dates.map((d) => byTime.get(d.getTime()) ?? 0),
        borderColor: colors.stroke,
        backgroundColor: colors.fill,
        fill: true,
        tension: 0.35,
        pointRadius: 0,
        pointHitRadius: 8,
      };
    });

    return { labels, datasets };
  }, [filteredSeries, def]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-102px)] bg-gray-100 dark:bg-gray-900 p-6">
      <div className="max-w-4xl w-full text-center">
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4 text-gray-900 dark:text-white">{def.title}</h1>
        <p className="text-sm sm:text-base md:text-lg text-gray-600 dark:text-gray-300 mb-8">{def.description}</p>

        {loading ? (
          <div className="flex flex-col items-center">
            <div className="loader"></div>
            <p className="text-gray-600 dark:text-gray-300 mt-4">Loading data...</p>
          </div>
        ) : error ? (
          <div className="text-red-600 dark:text-red-400">
            <p>{`${error}`}</p>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <div className="mb-4 w-full max-w-sm sm:max-w-md md:max-w-lg">
              <label htmlFor="interval" className="mr-2 block text-sm md:text-base text-gray-900 dark:text-gray-300">
                Select Interval:
              </label>
              <select
                id="interval"
                className="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-md text-sm md:text-base bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                value={interval}
                onChange={(e) => setInterval(e.target.value as Interval)}
              >
                {availableIntervals.includes('yearly') && <option value="yearly">Yearly</option>}
                {availableIntervals.includes('monthly') && <option value="monthly">Monthly</option>}
                {availableIntervals.includes('daily') && <option value="daily">Daily</option>}
                <option value="custom">Custom Range</option>
              </select>
            </div>

            {interval === 'custom' && (
              <div className="flex flex-col sm:flex-row space-y-4 sm:space-y-0 sm:space-x-4 mb-4 w-full max-w-sm sm:max-w-md md:max-w-lg">
                <div className="flex-1">
                  <label htmlFor="start-date" className="block mb-1 text-sm md:text-base text-gray-900 dark:text-gray-300">
                    From Date:
                  </label>
                  <input
                    type="date"
                    id="start-date"
                    className="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-md text-sm md:text-base bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    value={customStartDate || ''}
                    onChange={(e) => setCustomStartDate(e.target.value)}
                    min={firstDate ? firstDate.toISOString().split('T')[0] : ''}
                    max={lastDate ? lastDate.toISOString().split('T')[0] : ''}
                    title={firstDate ? `Value must be ${firstDate.toLocaleDateString()} or later` : ''}
                  />
                </div>
                <div className="flex-1">
                  <label htmlFor="end-date" className="block mb-1 text-sm md:text-base text-gray-900 dark:text-gray-300">
                    To Date (Optional):
                  </label>
                  <input
                    type="date"
                    id="end-date"
                    className="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-md text-sm md:text-base bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    value={customEndDate || ''}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    min={customStartDate || (firstDate ? firstDate.toISOString().split('T')[0] : '')}
                    max={today.toISOString().split('T')[0]}
                    title={customStartDate ? `Value must be ${new Date(customStartDate).toLocaleDateString()} or later` : ''}
                  />
                </div>
              </div>
            )}

            <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg p-4 w-full h-full">
              {filteredSeries.length > 0 && filteredSeries[0].data.length > 0 ? (
                <div className="w-full h-96 md:h-128 lg:h-[48rem]">
                  <Line data={chartData} options={defaultChartOptions} />
                </div>
              ) : (
                <p className="text-gray-600 dark:text-gray-300">No data available for the selected date range.</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
