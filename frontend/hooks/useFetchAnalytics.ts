'use client';

import { useState, useEffect } from 'react';

export const useFetchAnalytics = (endpoint: string) => {
  const [data, setData] = useState<{ label: string; data: { date: Date; users: number }[] }[]>([]);
  const [firstDate, setFirstDate] = useState<Date | null>(null);
  const [lastDate, setLastDate] = useState<Date | null>(null);
  const [today, setToday] = useState<Date>(new Date());
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true);
        const response = await fetch(endpoint);
        if (!response.ok) {
          throw new Error('Failed to fetch data');
        }
        const result = await response.json();

        // Sanitize the data
        const sanitizedData = result.data.map((item: any) => ({
          ...item,
          data: item.data.map((datum: any) => ({
            ...datum,
            date: datum.date ? new Date(datum.date) : new Date(),
            users: isNaN(datum.users) ? 0 : datum.users,
          })),
        }));

        setData(sanitizedData);
        setFirstDate(new Date(result.firstUserDate));
        setLastDate(new Date(result.lastUserDate));
        setToday(new Date(result.today));
      } catch (error) {
        console.error('Error fetching data:', error);
        setError('Failed to load analytics data. Please try again later.');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [endpoint]);

  return { data, firstDate, lastDate, today, loading, error };
};