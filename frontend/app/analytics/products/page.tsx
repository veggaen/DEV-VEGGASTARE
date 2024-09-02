'use client';

import { format } from 'date-fns';
import React, { useEffect, useState, useMemo } from 'react';
import { Chart, AxisOptions } from 'react-charts';

type ProductGrowthDatum = { date: Date; users: number };

const ProductGrowthAnalytics = () => {
  const [data, setData] = useState<{ label: string; data: ProductGrowthDatum[] }[]>([]);
  const [firstProductDate, setFirstProductDate] = useState<Date | null>(null);
  const [lastProductDate, setLastProductDate] = useState<Date | null>(null);
  const [today, setToday] = useState<Date>(new Date());
  const [loading, setLoading] = useState<boolean>(true);  // Loading state
  const [error, setError] = useState<string | null>(null);
  const [interval, setInterval] = useState<string>('all'); // Interval state
  const [customStartDate, setCustomStartDate] = useState<string>(''); // Custom start date
  const [customEndDate, setCustomEndDate] = useState<string>(''); // Custom end date

  useEffect(() => {
    // Fetch data from the API route
    async function fetchData() {
      try {
        setLoading(true);  // Set loading state to true when fetching data
        const response = await fetch('/api/analytics/products'); // Call the API route
        if (!response.ok) {
          throw new Error('Failed to fetch data');
        }
        const result = await response.json(); // Parse the response

        // Sanitize the data
        const sanitizedData = result.data.map((item: any) => ({
          ...item,
          data: item.data.map((datum: any) => ({
            ...datum,
            date: datum.date ? new Date(datum.date) : new Date(), // Ensure date is valid
            users: isNaN(datum.users) ? 0 : datum.users, // Ensure users count is valid
          })),
        }));

        setData(sanitizedData); // Set the sanitized data
        setFirstProductDate(new Date(result.firstProductDate));
        setLastProductDate(new Date(result.lastProductDate));
        setToday(new Date(result.today));
        console.log('We got this result:', result);
      } catch (error) {
        console.error('Error fetching data:', error);
        setError('Failed to load product growth data. Please try again later.');
      } finally {
        setLoading(false);  // Set loading state to false after fetching data
      }
    }

    fetchData(); // Fetch data when the component mounts
  }, []);

  // Helper function to check if a date is fully valid
  const isFullyValidDate = (dateString: string | null) => {
    if (!dateString) return false;
    const date = new Date(dateString);
    return !isNaN(date.getTime()) && /^\d{4}-\d{2}-\d{2}$/.test(dateString); // Matches YYYY-MM-DD format
  };

  // Helper function to adjust date to the available data range
  const adjustDateToAvailableRange = (date: Date): Date => {
    if (firstProductDate && date < firstProductDate) return new Date(firstProductDate);
    if (lastProductDate && date > lastProductDate) return new Date(lastProductDate);
    return date;
  };

  // Adjust the custom date range when the interval is set to "custom"
  useEffect(() => {
    if (interval === 'custom' && firstProductDate && lastProductDate) {
      // Ensure start date is within range
      const initialStartDate = adjustDateToAvailableRange(new Date(firstProductDate));
      const initialEndDate = adjustDateToAvailableRange(new Date(lastProductDate));

      // Update the custom date range to safe defaults
      setCustomStartDate(initialStartDate.toISOString().split('T')[0]);
      setCustomEndDate(initialEndDate.toISOString().split('T')[0]);
    }
  }, [interval, firstProductDate, lastProductDate]);

  // Filter data based on the selected interval or custom date range
  const filteredData = useMemo(() => {
    let startDate: Date;
    let endDate: Date = today; // Default to today if no end date is specified

    if (interval === 'custom') {
      const isStartValid = isFullyValidDate(customStartDate);
      const isEndValid = isFullyValidDate(customEndDate);

      if (!isStartValid && !isEndValid) {
        startDate = firstProductDate ? new Date(firstProductDate) : new Date(0);
        endDate = lastProductDate ? new Date(lastProductDate) : new Date();
      } else {
        startDate = isStartValid ? new Date(customStartDate!) : (firstProductDate ? new Date(firstProductDate) : new Date(0));
        endDate = isEndValid ? new Date(customEndDate!) : today;

        if (startDate > endDate) {
          startDate = firstProductDate ? new Date(firstProductDate) : new Date(0);
          endDate = lastProductDate ? new Date(lastProductDate) : new Date();
        }
      }
    } else if (interval === 'year') {
      const now = new Date();
      startDate = new Date(now.getFullYear(), 0, 1);
    } else if (interval === 'month') {
      const now = new Date();
      startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    } else {
      startDate = firstProductDate ? new Date(firstProductDate) : new Date(0);
    }

    // Filter data based on the calculated startDate and endDate
    return data.map(item => ({
      ...item,
      data: item.data.filter((datum: ProductGrowthDatum) => datum.date >= startDate && datum.date <= endDate),
    }));
  }, [data, interval, customStartDate, customEndDate, firstProductDate, lastProductDate, today]);

  // Set up the primary axis (time-based)
  const primaryAxis = useMemo<AxisOptions<ProductGrowthDatum>>(
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

  // Set up the secondary axis (linear scale for user count)
  const secondaryAxes = useMemo<AxisOptions<ProductGrowthDatum>[]>(
    () => [
      {
        getValue: (datum) => datum.users || 0, // Ensure user count is always a number
        scaleType: 'linear',
        min: 0,
      },
    ],
    []
  );

  // Render the chart
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-102px)] bg-gray-100 dark:bg-gray-900 p-6">
      <div className="max-w-4xl w-full text-center">
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4 text-gray-900 dark:text-white">Product Growth Analytics</h1>
        <p className="text-sm sm:text-base md:text-lg text-gray-600 dark:text-gray-300 mb-8">
          This chart displays the product growth over time, helping you understand the growth trend for your application.
        </p>
        
        {loading ? (
          // Loading state
          <div className="flex flex-col items-center">
            <div className="loader"></div> {/* Customize this as per your style (e.g., a CSS spinner) */}
            <p className="text-gray-600 dark:text-gray-300 mt-4">Loading data...</p>
          </div>
        ) : error ? (
          // Error state
          <div className="text-red-600 dark:text-red-400">
            <p>{`${error}`}</p>
          </div>
        ) : (
          // Loaded state
          <div className="flex flex-col items-center">
            <div className="mb-4 w-full max-w-sm sm:max-w-md md:max-w-lg">
              <label htmlFor="interval" className="mr-2 block text-sm md:text-base text-gray-900 dark:text-gray-300">Select Interval:</label>
              <select
                id="interval"
                className="w-full p-2 border border-gray-300 dark:border-gray-700 rounded-md text-sm md:text-base bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
                value={interval}
                onChange={(e) => setInterval(e.target.value)}
              >
                <option value="all">Show All History</option>
                <option value="year">Show This Year</option>
                <option value="month">Show This Month</option>
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
                    min={firstProductDate ? firstProductDate.toISOString().split('T')[0] : ''}
                    max={lastProductDate ? lastProductDate.toISOString().split('T')[0] : ''}
                    title={firstProductDate ? `Value must be ${firstProductDate.toLocaleDateString()} or later` : ''}
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
                    min={customStartDate || (firstProductDate ? firstProductDate.toISOString().split('T')[0] : '')}
                    max={today.toISOString().split('T')[0]}  // Allow up to today
                    title={customStartDate ? `Value must be ${new Date(customStartDate).toLocaleDateString()} or later` : ''}
                  />
                </div>
              </div>
            )}

            <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg p-4 w-full h-full">
              {filteredData.length > 0 && filteredData[0].data.length > 0 ? (
                <div className='w-full h-96 md:h-128 lg:h-[48rem]'>
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
};

export default ProductGrowthAnalytics;