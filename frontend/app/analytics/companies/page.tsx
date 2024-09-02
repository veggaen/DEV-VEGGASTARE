'use client';

import { format } from 'date-fns';
import React, { useMemo, useState, useEffect } from 'react';
import { Chart, AxisOptions } from 'react-charts';
import { useFetchAnalytics } from '@/hooks/useFetchAnalytics'; // Import the custom hook

// Define the DataType for companies
type DataType = { date: Date; users?: number; companies?: number }; // Update to match hook's definition
type CompanyGrowthDatum = { date: Date; companies: number };

const MyPageAnalyticsCompanies = () => {
  // Use the custom hook to fetch data
  const { data, firstDate, lastDate, today, loading, error } = useFetchAnalytics('/api/analytics/companies');
  const [interval, setInterval] = useState<string>('daily'); // Default to daily
  const [customStartDate, setCustomStartDate] = useState<string>(''); // Custom start date
  const [customEndDate, setCustomEndDate] = useState<string>(''); // Custom end date

  // Determine the available intervals based on data range
  const availableIntervals = useMemo(() => {
    const intervals = ['daily']; // Daily is always available
    if (firstDate && lastDate) {
      const totalDays = (lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24);
      if (totalDays >= 30) intervals.push('monthly'); // Show Monthly if data is more than a month
      if (totalDays >= 365) intervals.push('yearly'); // Show Yearly if data is more than a year
    }
    return intervals;
  }, [firstDate, lastDate]);

  // Adjust the custom date range when the interval is set to "custom"
  useEffect(() => {
    if (interval === 'custom' && firstDate && lastDate) {
      const initialStartDate = new Date(firstDate);
      const initialEndDate = new Date(lastDate);
      setCustomStartDate(initialStartDate.toISOString().split('T')[0]);
      setCustomEndDate(initialEndDate.toISOString().split('T')[0]);
    }
  }, [interval, firstDate, lastDate]);

  // Helper function to check if a date is fully valid
  const isFullyValidDate = (dateString: string | null) => {
    if (!dateString) return false;
    const date = new Date(dateString);
    return !isNaN(date.getTime()) && /^\d{4}-\d{2}-\d{2}$/.test(dateString); // Matches YYYY-MM-DD format
  };

  // Filter data based on the selected interval or custom date range
  const filteredData = useMemo(() => {
    let startDate: Date;
    let endDate: Date = today;
    if (interval === 'custom') {
      const isStartValid = isFullyValidDate(customStartDate);
      const isEndValid = isFullyValidDate(customEndDate);
  
      if (!isStartValid && !isEndValid) {
        startDate = firstDate ? new Date(firstDate) : new Date(0);
        endDate = lastDate ? new Date(lastDate) : new Date();
      } else {
        startDate = isStartValid ? new Date(customStartDate!) : new Date(firstDate!);
        endDate = isEndValid ? new Date(customEndDate!) : today;
  
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
  
    // Correct the filtering logic to match the expected CompanyGrowthDatum type
    return data.map(item => ({
      ...item,
      data: item.data.filter((datum: DataType): datum is CompanyGrowthDatum => {
        return datum.date >= startDate && datum.date <= endDate && typeof datum.companies === 'number';
      }),
    }));
  }, [data, interval, customStartDate, customEndDate, firstDate, lastDate, today]);
  
  // Set up the primary axis (time-based)
  const primaryAxis = useMemo<AxisOptions<CompanyGrowthDatum>>(
    () => ({
      getValue: (datum) => datum.date || new Date(),
      scaleType: 'time',
      min: filteredData.length > 0 && filteredData[0].data.length > 0 ? new Date(Math.min(...filteredData[0].data.map(d => d.date.getTime()))) : new Date(),
      max: filteredData.length > 0 && filteredData[0].data.length > 0 ? new Date(Math.max(...filteredData[0].data.map(d => d.date.getTime()))) : new Date(),
      formatters: {
        scale: (date) => format(new Date(date), 'MMM d'), // Format date as "Sep 1"
      },
    }),
    [filteredData]
  );

  // Set up the secondary axis (linear scale for company count)
  const secondaryAxes = useMemo<AxisOptions<CompanyGrowthDatum>[]>(
    () => [
      {
        getValue: (datum) => datum.companies || 0,
        scaleType: 'linear',
        min: 0,
      },
    ],
    []
  );

  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-102px)] bg-gray-100 dark:bg-gray-900 p-6">
      <div className="max-w-3xl w-full text-center">
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4 text-gray-900 dark:text-white">Company Growth Analytics</h1>
        <p className="text-sm sm:text-base md:text-lg text-gray-600 dark:text-gray-300 mb-8">
          This chart displays the company growth over time, helping you understand the growth trend for your application.
        </p>
        
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
              <label htmlFor="interval" className="mr-2 block text-sm md:text-base text-gray-900 dark:text-gray-300">Select Interval:</label>
              <select
                id="interval"
                className="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-md text-sm md:text-base bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                value={interval}
                onChange={(e) => setInterval(e.target.value)}
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
                  <label htmlFor="start-date" className="block mb-1 text-sm md:text-base text-gray-900 dark:text-gray-300">From Date:</label>
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
                  <label htmlFor="end-date" className="block mb-1 text-sm md:text-base text-gray-900 dark:text-gray-300">To Date (Optional):</label>
                  <input
                    type="date"
                    id="end-date"
                    className="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-md text-sm md:text-base bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                    value={customEndDate || ''}
                    onChange={(e) => setCustomEndDate(e.target.value)}
                    min={customStartDate || (firstDate ? firstDate.toISOString().split('T')[0] : '')}
                    max={today.toISOString().split('T')[0]}  // Allow up to today
                    title={customStartDate ? `Value must be ${new Date(customStartDate).toLocaleDateString()} or later` : ''}
                  />
                </div>
              </div>
            )}

            <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg p-4 w-full h-full">
              {filteredData.length > 0 && filteredData[0].data.length > 0 ? (
                <div className='w-full h-96 md:h-128'>
                  <Chart
                    className='w-full h-full text-black dark:text-white'
                    options={{
                      data: filteredData,
                      primaryAxis,
                      secondaryAxes,
                    }}
                  />
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

export default MyPageAnalyticsCompanies;