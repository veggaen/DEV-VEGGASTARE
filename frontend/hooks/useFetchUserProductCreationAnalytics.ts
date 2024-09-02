'use client';

import { useState, useEffect } from 'react';

type UserProductCreationDatum = { label: string; count: number }; // Specific type for this chart

export const useFetchUserProductCreationAnalytics = (endpoint: string) => {
  const [data, setData] = useState<UserProductCreationDatum[]>([]);
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

        // Sanitize and set the data
        const sanitizedData = result.data.map((item: any) => ({
          label: item.label,
          count: typeof item.count === 'number' ? item.count : 0, // Ensure count is a number
        }));

        setData(sanitizedData);
      } catch (error) {
        console.error('Error fetching data:', error);
        setError('Failed to load analytics data. Please try again later.');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [endpoint]);

  return { data, loading, error };
};