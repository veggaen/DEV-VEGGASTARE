"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Chart, AxisOptions } from 'react-charts';
import { format, addDays, subDays, subWeeks, subMonths, isValid, parseISO } from 'date-fns';

type EthereumPriceDatum = { date: string; price: number };

const EthereumPriceChart = () => {
  const [allData, setAllData] = useState<EthereumPriceDatum[]>([]);
  const [data, setData] = useState<EthereumPriceDatum[]>([]);
  const [currency, setCurrency] = useState<string>('usd');
  const [interval, setInterval] = useState<string>('daily');
  const [days, setDays] = useState<string>('max');
  const [fromDate, setFromDate] = useState<string | null>(null);
  const [toDate, setToDate] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [firstAvailableDate, setFirstAvailableDate] = useState<string>('');
  const [lastAvailableDate, setLastAvailableDate] = useState<string>(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    fetchEthereumPriceData();
  }, [currency]);

  useEffect(() => {
    filterData();
  }, [interval, days, fromDate, toDate, allData]);

  const fetchEthereumPriceData = async () => {
    setLoading(true);
    setError(null);
    try {
      const apiUrl = `/api/analytics/ethereum-price?vs_currency=${currency}&interval=daily`;
      const response = await fetch(apiUrl);

      if (!response.ok) {
        throw new Error('Failed to fetch Ethereum price data');
      }

      const result = await response.json();
      setAllData(result.data);

      const firstDate = result.data[0]?.date || '';
      const lastDate = result.data[result.data.length - 1]?.date || new Date().toISOString().split('T')[0];

      setFirstAvailableDate(format(new Date(firstDate), 'yyyy-MM-dd'));
      setLastAvailableDate(format(new Date(lastDate), 'yyyy-MM-dd'));
      setData(result.data);
      setFromDate(format(new Date(firstDate), 'yyyy-MM-dd'));
      setToDate(format(new Date(lastDate), 'yyyy-MM-dd'));
    } catch (error) {
      console.error('Error fetching Ethereum price data:', error);
      setError('Failed to fetch Ethereum price data. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  const filterData = () => {
    let filteredData = allData;

    if (days !== 'max' && toDate) {
      let startDate: Date | undefined;
      const endDate = new Date(toDate);
      if (interval === 'daily') {
        startDate = subDays(endDate, parseInt(days));
      } else if (interval === 'weekly') {
        startDate = subWeeks(endDate, parseInt(days));
      } else if (interval === 'monthly') {
        startDate = subMonths(endDate, parseInt(days));
      }
      if (startDate) {
        setFromDate(format(startDate, 'yyyy-MM-dd'));
        filteredData = filteredData.filter((datum) => new Date(datum.date) >= startDate);
      }
    }

    if (fromDate || toDate) {
      filteredData = filteredData.filter((datum) => {
        const datumDate = new Date(datum.date);
        const from = fromDate ? new Date(fromDate) : null;
        const to = toDate ? new Date(toDate) : null;
        return (!from || datumDate >= from) && (!to || datumDate <= to);
      });
    }

    if (interval === 'weekly') {
      setData(aggregateData(filteredData, 7));
    } else if (interval === 'monthly') {
      setData(aggregateData(filteredData, 30));
    } else {
      setData(filteredData);
    }
  };

  const aggregateData = (data: EthereumPriceDatum[], days: number) => {
    const aggregatedData: EthereumPriceDatum[] = [];
    if (data.length === 0) return aggregatedData;

    let currentDate = new Date(data[0].date);
    let currentSum = 0;
    let count = 0;

    data.forEach((datum) => {
      const datumDate = new Date(datum.date);
      if (datumDate < addDays(currentDate, days)) {
        currentSum += datum.price;
        count++;
      } else {
        aggregatedData.push({
          date: format(currentDate, 'yyyy-MM-dd'),
          price: currentSum / count,
        });
        currentDate = datumDate;
        currentSum = datum.price;
        count = 1;
      }
    });

    if (count > 0) {
      aggregatedData.push({
        date: format(currentDate, 'yyyy-MM-dd'),
        price: currentSum / count,
      });
    }

    return aggregatedData;
  };

  const handleFromDateChange = (date: string) => {
    if (!isValid(parseISO(date))) return; // Validate date
    setFromDate(date);
    setDays('max');

    if (toDate && new Date(toDate) < new Date(date)) {
      setToDate('');
    }
  };

  const handleToDateChange = (date: string) => {
    if (!isValid(parseISO(date))) return; // Validate date
    setToDate(date);
    if (days !== 'max') {
      const newFromDate = calculateFromDateBasedOnToDate(date, parseInt(days));
      setFromDate(newFromDate);
    }
  };

  const calculateFromDateBasedOnToDate = (toDate: string, days: number): string => {
    const to = new Date(toDate);
    let fromDate: Date;
    if (interval === 'daily') {
      fromDate = subDays(to, days);
    } else if (interval === 'weekly') {
      fromDate = subWeeks(to, days);
    } else if (interval === 'monthly') {
      fromDate = subMonths(to, days);
    } else {
      fromDate = new Date(); // default case to prevent undefined
    }
    return format(fromDate, 'yyyy-MM-dd');
  };

  const handleReset = () => {
    setCurrency('usd');
    setInterval('daily');
    setFromDate(firstAvailableDate);
    setToDate(lastAvailableDate);
    setDays('max');
  };

  const getDaysOptions = () => {
    if (interval === 'daily') {
      return ['1', '7', '30', '365', 'max'];
    } else if (interval === 'weekly') {
      return ['1', '2', '3', '4', '30', 'max'];
    } else if (interval === 'monthly') {
      return ['1', '2', '3', '4', '6', '24', 'max'];
    }
    return [];
  };

  const primaryAxis = useMemo<AxisOptions<EthereumPriceDatum>>(
    () => ({
      getValue: (datum) => new Date(datum.date),
      scaleType: 'time',
      formatters: {
        scale: (date) => {
          if (!isNaN(new Date(date).getTime())) {
            return format(new Date(date), 'MM/dd/yyyy');
          }
          return '';
        },
      },
    }),
    []
  );

  const secondaryAxes = useMemo<AxisOptions<EthereumPriceDatum>[]>(
    () => [
      {
        getValue: (datum) => datum.price,
        scaleType: 'linear',
      },
    ],
    []
  );

  return (
    <div className="flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-900 p-6">
      <div className="max-w-4xl w-full text-center">
        <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-4 text-gray-900 dark:text-white">
          Ethereum Price Overview
        </h1>
        <p className="text-sm sm:text-base md:text-lg text-gray-600 dark:text-gray-300 mb-8">
          This chart displays the price of Ethereum in your selected currency and date range.
        </p>

        {/* Filter Controls */}
        <div className="flex flex-wrap justify-center gap-4 mb-6">
          <select
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            className="p-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          >
            <option value="usd">USD</option>
            <option value="eur">EUR</option>
          </select>

          <select
            value={days}
            onChange={(e) => setDays(e.target.value)}
            className="p-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          >
            {getDaysOptions().map((option) => (
              <option key={option} value={option}>
                {option === 'max' ? 'Max' : `${option} ${interval === 'daily' ? 'days' : interval === 'weekly' ? 'weeks' : 'months'}`}
              </option>
            ))}
          </select>

          <select
            value={interval}
            onChange={(e) => setInterval(e.target.value)}
            className="p-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          >
            <option value="daily">Daily</option>
            <option value="weekly">Weekly</option>
            <option value="monthly">Monthly</option>
          </select>

          <input
            type="date"
            value={fromDate || ''}
            onChange={(e) => handleFromDateChange(e.target.value)}
            className="p-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            min={firstAvailableDate}
            max={toDate || lastAvailableDate}
          />
          <input
            type="date"
            value={toDate || ''}
            onChange={(e) => handleToDateChange(e.target.value)}
            className="p-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
            min={fromDate || firstAvailableDate}
            max={lastAvailableDate}
          />
          <button
            onClick={handleReset}
            className="p-2 border border-gray-300 dark:border-gray-700 rounded-md bg-gray-200 dark:bg-gray-800 text-black dark:text-white hover:bg-red-600/50"
          >
            Reset
          </button>
        </div>

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
                      data: [{ label: 'Ethereum Price', data }],
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

        <footer className="mt-8 text-center text-gray-500 dark:text-gray-400 text-sm">
          Data provided by the <a href="https://www.coingecko.com/" className="text-blue-500 hover:underline">CoinGecko API</a>. This application is powered by a free API tier, which has some limitations such as data availability for up to 365 days. If you'd like to see more features or support further development, consider sending a friendly donation to the owner of this site. Donations are accepted to the Ethereum address: <span className="text-blue-500">0xd30791A696E3D4C1Ee53BC8b1Cec6C2f2780197B</span>. Thank you for your support!
        </footer>
      </div>
    </div>
  );
};

export default EthereumPriceChart;