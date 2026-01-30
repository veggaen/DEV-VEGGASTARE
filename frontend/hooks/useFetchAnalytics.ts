'use client';

import { useState, useEffect } from 'react';

type DataType = { date: Date; users?: number; companies?: number }; // Both are optional

interface UseFetchAnalyticsResult {
  data: { label: string; data: DataType[] }[];
  firstDate: Date | null;
  lastDate: Date | null;
  today: Date;
  loading: boolean;
  error: string | null;
}

function firstDefinedDate(...values: Array<unknown>): Date | null {
  for (const v of values) {
    if (!v) continue;
    const d = new Date(v as any);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

export const useFetchAnalytics = (endpoint: string): UseFetchAnalyticsResult => {
  const [data, setData] = useState<{ label: string; data: DataType[] }[]>([]);
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
        const sanitizedData = (result.data ?? []).map((item: any) => ({
          ...item,
          data: (item.data ?? []).map((datum: any) => ({
            ...datum,
            date: datum.date ? new Date(datum.date) : new Date(),
            users: typeof datum.users === 'number' && !isNaN(datum.users) ? datum.users : 0,
            companies: typeof datum.companies === 'number' && !isNaN(datum.companies) ? datum.companies : 0,
          })),
        }));

        setData(sanitizedData);
        setFirstDate(
          firstDefinedDate(
            result.firstCompanyDate,
            result.firstUserDate,
            result.firstProductDate,
            result.firstDate,
            result.first
          )
        );
        setLastDate(
          firstDefinedDate(
            result.lastCompanyDate,
            result.lastUserDate,
            result.lastProductDate,
            result.lastDate,
            result.last
          )
        );
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