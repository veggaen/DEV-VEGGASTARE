"use client";

import React, { useState, useEffect, useMemo } from 'react';
import { Line } from 'react-chartjs-2';
import { defaultChartOptions } from '@/components/uicustom/charts/chartjs';
import { format, addDays, subDays, subWeeks, subMonths, isValid, parseISO } from 'date-fns';

type CryptoPriceDatum = { date: string; price: number };

const CryptoPriceChart = () => {
  const [allData, setAllData] = useState<CryptoPriceDatum[]>([]);
  const [data, setData] = useState<CryptoPriceDatum[]>([]);
  const [currency, setCurrency] = useState<string>('usd');
  const [crypto, setCrypto] = useState<string>('ethereum');  // Default to Ethereum
  const [interval, setInterval] = useState<string>('daily');
  const [days, setDays] = useState<string>('max');
  const [fromDate, setFromDate] = useState<string | null>(null);
  const [toDate, setToDate] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [firstAvailableDate, setFirstAvailableDate] = useState<string>('');
  const [lastAvailableDate, setLastAvailableDate] = useState<string>(new Date().toISOString().split('T')[0]);

  useEffect(() => {
    fetchCryptoPriceData();
  }, [currency, crypto]);

  useEffect(() => {
    filterData();
  }, [interval, days, fromDate, toDate, allData]);

  const fetchCryptoPriceData = async () => {
    setLoading(true);
    setError(null);
    try {
      const apiUrl = `/api/analytics/crypto-price?vs_currency=${currency}&crypto=${crypto}&interval=daily&days=365`;
      const response = await fetch(apiUrl);

      if (!response.ok) {
        throw new Error(`Failed to fetch ${crypto} price data`);
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
      console.error(`Error fetching ${crypto} price data:`, error);
      setError('Failed to fetch data. Please try again later.');
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

  const aggregateData = (data: CryptoPriceDatum[], days: number) => {
    const aggregatedData: CryptoPriceDatum[] = [];
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
    setCrypto('ethereum');
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

  const chartData = useMemo(() => {
    const labels = data.map((d) => format(new Date(d.date), 'MM/dd/yyyy'));
    const values = data.map((d) => d.price);
    const label = `${crypto.charAt(0).toUpperCase() + crypto.slice(1)} Price`;
    return {
      labels,
      datasets: [
        {
          label,
          data: values,
          borderColor: 'rgba(34,197,94,0.95)',
          backgroundColor: 'rgba(34,197,94,0.20)',
          fill: true,
          tension: 0.35,
          pointRadius: 0,
          pointHitRadius: 8,
        },
      ],
    };
  }, [data, crypto]);

  return (
    <div className="flex flex-col items-center justify-center bg-gray-100 dark:bg-gray-900 py-6">
      <div className="w-full text-center">
        {/* Filter Controls */}
        <div className="flex flex-wrap justify-center gap-4 mb-6">
          <select
            value={crypto}
            onChange={(e) => setCrypto(e.target.value)}
            className="p-2 border border-gray-300 dark:border-gray-700 rounded-md bg-white dark:bg-gray-800 text-gray-900 dark:text-white"
          >
            <option value="ethereum">Ethereum</option>
            <option value="bitcoin">Bitcoin</option>
            <option value="wrapped-pulse-wpls">Pulse (WPLS)</option>
            {/* Add more options dynamically as needed */}
          </select>

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
};

export default CryptoPriceChart;