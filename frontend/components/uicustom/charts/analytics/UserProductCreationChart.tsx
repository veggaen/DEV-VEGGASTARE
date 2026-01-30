'use client';

import React, { useMemo } from 'react';
import { Bar } from 'react-chartjs-2';
import { defaultBarChartOptions } from '@/components/uicustom/charts/chartjs';
import { useFetchUserProductCreationAnalytics } from '@/hooks/useFetchUserProductCreationAnalytics'; // Use the new custom hook

type UserProductCreationDatum = { label: string; count: number };

const UserProductCreationChart = () => {
  const { data, loading, error } = useFetchUserProductCreationAnalytics('/api/analytics/user-product-creation');

  const chartData = useMemo(() => {
    const labels = data.map((d) => d.label);
    const values = data.map((d) => d.count);
    return {
      labels,
      datasets: [
        {
          label: 'User Product Creation',
          data: values,
          backgroundColor: 'rgba(34,197,94,0.35)',
          borderColor: 'rgba(34,197,94,0.9)',
          borderWidth: 1,
        },
      ],
    };
  }, [data]);

  return (
    <div className="flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-900 py-6">
      <div className="max-w-4xl w-full text-center">
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
                <div className="w-full h-96 md:h-128 lg:h-[48rem]">
                  <Bar
                    data={chartData}
                    options={{
                      ...defaultBarChartOptions,
                      plugins: {
                        ...defaultBarChartOptions.plugins,
                        legend: { display: false },
                      },
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