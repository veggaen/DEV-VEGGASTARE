'use client';

import { useEffect, useState, useTransition, FC } from 'react';
import Link from 'next/link';
import { fetchWarehouses } from '@/actions/fetchWarehouses';
import { updateWarehouseInventory } from '@/actions/updateWarehouse';
import { Button } from '@/components/ui/button';
import Spinner from '@/components/uicustom/spinner';
import { useCurrentUser } from '@/hooks/use-current-user';
import Pusher from 'pusher-js';
import throttle from 'lodash.throttle';

const LOG_PREFIX = '[frontend/app/warehouses/page.tsx]';

const WarehouseOverview = () => {
  const clientUser = useCurrentUser();
  const [warehouses, setWarehouses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [showDropdown, setShowDropdown] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const intervalDuration = 3600000; // 60 minutes

  const pusherClient = new Pusher(process.env.NEXT_PUBLIC_PUSHER_KEY!, {
    cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
    forceTLS: true,
  });

  const getWarehouses = async () => {
    console.log(LOG_PREFIX, 'Fetching warehouses');
    try {
      setRefreshing(true);
      const data = await fetchWarehouses();
      setWarehouses(data);
      setPermissionError(null); // Clear any permission error
      console.log(LOG_PREFIX, 'Fetched warehouses:', data);
    } catch (error) {
      console.error(LOG_PREFIX, 'Failed to fetch warehouses:', (error as Error).message);
      setError((error as Error).message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    getWarehouses();

    const intervalId = setInterval(() => {
      getWarehouses();
    }, intervalDuration); // Poll every X seconds

    return () => clearInterval(intervalId);
  }, []);

  useEffect(() => {
    if (showDropdown) {
      const channelName = `WarehouseChannel_${showDropdown}`;
      console.log(`${LOG_PREFIX} Subscribing to channel ${channelName}`);
      const channel = pusherClient.subscribe(channelName);

      const eventHandler = (data: any) => {
        console.log(LOG_PREFIX, '[Pusher] Message received:', data);
        setWarehouses((prevWarehouses) => {
          return prevWarehouses.map((warehouse) => {
            if (warehouse.id === data.payload.warehouseId) {
              return {
                ...warehouse,
                inventory: warehouse.inventory.map((item) =>
                  item.id === data.payload.inventoryId ? { ...item, stock: data.payload.stock } : item
                ),
              };
            }
            return warehouse;
          });
        });
      };

      channel.bind('my-event-warehouse', eventHandler);

      return () => {
        console.log(`${LOG_PREFIX} Unsubscribing from channel ${channelName}`);
        channel.unbind('my-event-warehouse', eventHandler);
        pusherClient.unsubscribe(channelName);
      };
    }
  }, [showDropdown]);

  const handleStockUpdate = throttle(async (warehouseId: string, inventoryId: string, stock: number) => {
    console.log(LOG_PREFIX, 'Updating stock for warehouse:', warehouseId, 'inventory:', inventoryId, 'new stock:', stock);
    startTransition(async () => {
      try {
        const response = await updateWarehouseInventory(warehouseId, inventoryId, stock);
        if (response.status === 200) {
          console.log(LOG_PREFIX, 'Warehouse inventory updated successfully');
        } else {
          console.error('Failed to update warehouse inventory:', response.message);
          setPermissionError('Missing permissions for this action');
        }
      } catch (error) {
        console.error('Failed to update warehouse inventory:', (error as Error).message);
        setError((error as Error).message);
      }
    });
  }, 1000); // Throttle the updates to once every second

  const LoadingTimer: FC<{ intervalDuration: number; onRefresh: () => void; refreshing: boolean }> = ({
    intervalDuration,
    onRefresh,
    refreshing,
  }) => {
    const [progress, setProgress] = useState(0);

    useEffect(() => {
      const updateProgress = () => {
        setProgress((prev) => (prev >= 100 ? 0 : prev + (100 / (intervalDuration / 1000))));
      };

      const intervalId = setInterval(updateProgress, 1000);

      return () => clearInterval(intervalId);
    }, [intervalDuration]);

    useEffect(() => {
      if (refreshing) setProgress(0);
    }, [refreshing]);

    return (
      <div className="flex items-center">
        <div className="relative w-6 h-6">
          <svg className="absolute top-0 left-0 w-full h-full" viewBox="0 0 100 100">
            <circle
              cx="50"
              cy="50"
              r="45"
              stroke="currentColor"
              strokeWidth="5"
              fill="none"
              className="text-gray-300"
            />
            <circle
              cx="50"
              cy="50"
              r="45"
              stroke="currentColor"
              strokeWidth="5"
              fill="none"
              className="text-blue-500"
              strokeDasharray="282.743"
              strokeDashoffset={(282.743 * (100 - progress)) / 100}
            />
          </svg>
          {refreshing && <Spinner className="absolute top-0 left-0 w-full h-full" />}
        </div>
        <Button
          variant="vegaNormalBtn"
          className="ml-4 text-sm font-medium text-blue-500 dark:text-blue-300 hover:underline"
          onClick={onRefresh}
          disabled={refreshing}
        >
          Refresh Now
        </Button>
      </div>
    );
  };

  if (loading) return <Spinner />;
  if (error) return <div>{error}</div>;

  return (
    <div className="p-4 md:p-6 lg:p-8 min-h-screen bg-white dark:bg-gray-900 text-black dark:text-white">
      <div className="flex justify-between items-center mb-4">
        <h1 className="text-lg md:text-2xl font-bold">Warehouse Overview</h1>
        <LoadingTimer intervalDuration={intervalDuration} onRefresh={getWarehouses} refreshing={refreshing} />
      </div>
      {refreshing && <Spinner />}
      {permissionError && <div className="text-red-500">{permissionError}</div>}
      {warehouses.length === 0 ? (
        <p>No warehouses available.</p>
      ) : (
        <div className="flex flex-col justify-start items-center">
          {warehouses.map((warehouse) => (
            <div key={warehouse.id} className="mb-6 border p-4 bg-white/10 border-gray-200 dark:border-gray-700 w-full md:max-w-[1200px] rounded">
              <div className="flex justify-between items-center gap-2">
                <div>
                  <h2 className="text-lg md:text-xl font-semibold mb-2">
                    {warehouse.address ? `${warehouse.address}, ` : ''}
                    {warehouse.city ? `${warehouse.city}, ` : ''}
                    {warehouse.country}
                  </h2>
                  <Link href={`/warehouses/${warehouse.id}`}>
                    <div className="text-blue-500 dark:text-blue-300 hover:underline">View Details</div>
                  </Link>
                </div>
                <Button variant="vegaNormalBtn" className="" onClick={() => setShowDropdown(showDropdown === warehouse.id ? null : warehouse.id)}>
                  {showDropdown === warehouse.id ? 'Hide inventory' : 'Show inventory'}
                </Button>
              </div>
              {showDropdown === warehouse.id && (
                <div className="warehousedropdown block">
                  <ul>
                    {warehouse.inventory.map((item: any) => (
                      <li key={item.id} className="flex justify-between items-center mb-2">
                        <div>
                          <strong>{item.product.title}</strong> - Stock: {item.stock}
                        </div>
                        <div className="flex items-center gap-2">
                          <Button variant="outline" onClick={() => handleStockUpdate(warehouse.id, item.id, item.stock + 1)}>+</Button>
                          <Button variant="outline" onClick={() => handleStockUpdate(warehouse.id, item.id, item.stock - 1)}>-</Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default WarehouseOverview;