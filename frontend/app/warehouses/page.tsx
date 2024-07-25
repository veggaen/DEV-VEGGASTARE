'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import ProgressBar from '@/components/bars/progress-bar'; // Ensure you have the ProgressBar component available


const WarehouseOverview = () => {
  const [warehouses, setWarehouses] = useState<any>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchWarehouses = async () => {
      try {
        console.log('Fetching warehouses');
        const response = await fetch('/api/warehouses');
        if (!response.ok) {
          throw new Error(`Failed to fetch warehouses: ${response.statusText}`);
        }
        const data: any = await response.json();
        console.log('Fetched warehouses:', data);
        setWarehouses(data);
      } catch (error: any) {
        console.error('Failed to fetch warehouses:', error);
        setError(error.message);
      } finally {
        setLoading(false);
      }
    };
    fetchWarehouses();
  }, []);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>{error}</div>;

  return (
    <div className="p-6 min-h-screen bg-white dark:bg-gray-900 text-black dark:text-white">
      <h1 className="text-2xl font-bold mb-4">Warehouse Overview</h1>
      {warehouses.map((warehouse) => (
        <div key={warehouse.id} className="mb-6">
          <h2 className="text-xl font-semibold mb-2">
            {warehouse.address}, {warehouse.city}, {warehouse.country}
          </h2>
          <ul className="space-y-4">
            {warehouse.inventory.map((item) => (
              <li key={item.product.id} className="bg-gray-100 dark:bg-gray-800 p-4 rounded-lg shadow-md">
                <div className="flex justify-between items-center mb-2">
                  <span>{item.product.title}</span>
                  <span>Quantity: {item.quantity}</span>
                </div>
                <ProgressBar value={item.product.stock} max={item.quantity} />
              </li>
            ))}
          </ul>
          <Link href={`/warehouses/${warehouse.id}`}>
            <div className="mt-2 text-blue-500 dark:text-blue-300 hover:underline">
              View Details
            </div>
          </Link>
        </div>
      ))}
    </div>
  );
};

export default WarehouseOverview;