'use client';

import React, { useMemo } from 'react';
import { Chart, AxisOptions } from 'react-charts';
import { useFetchUserProductCreationAnalytics } from '@/hooks/useFetchUserProductCreationAnalytics'; // Use the new custom hook

type UserProductCreationDatum = { label: string; count: number };

const UserProductCreationChart = () => {
  const { data, loading, error } = useFetchUserProductCreationAnalytics('/api/analytics/user-product-creation');

  // Set up the primary axis
  const primaryAxis = useMemo<AxisOptions<UserProductCreationDatum>>(
    () => ({
      getValue: (datum) => datum.label,
    }),
    []
  );

  // Set up the secondary axis
  const secondaryAxes = useMemo<AxisOptions<UserProductCreationDatum>[]>(
    () => [
      {
        getValue: (datum) => datum.count,
        scaleType: 'linear',
      },
    ],
    []
  );

  return (
    <div className="flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-900 p-6">
      <div className="max-w-3xl w-full text-center">
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4 text-gray-900 dark:text-white">
          User Product Creation Overview
        </h1>
        <p className="text-sm sm:text-base md:text-lg text-gray-600 dark:text-gray-300 mb-8">
          This chart displays the number of products created directly by users and on behalf of companies.
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
            <div className="bg-white dark:bg-gray-800 shadow-md rounded-lg p-4 w-full h-full">
              {data.length > 0 ? (
                <div className="w-full h-96 md:h-128">
                  <Chart
                    className="w-full h-full text-black dark:text-white"
                    options={{
                      data: [{ label: 'User Product Creation', data }],
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

export default UserProductCreationChart;