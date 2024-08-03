'use client';

import { useEffect, useState, useTransition, FC } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import Spinner from '@/components/uicustom/spinner';
import { useCurrentUser } from '@/hooks/use-current-user';
import usePusher from '@/hooks/usePusher';
import throttle from 'lodash.throttle';
import { Product, WarehouseLocation } from '@prisma/client';
import { fetchWarehouseById } from '@/actions/fetchWarehouseById';
import { updateWarehouseInventory } from '@/actions/updateWarehouse';
import { useParams } from 'next/navigation';

const LOG_PREFIX = '[frontend/app/warehouses/[id]/page.tsx]';

interface InventoryItem {
  id: string;
  stock: number;
  version: number;
  product: Product;
}

interface ExtendedWarehouse extends WarehouseLocation {
  inventory: InventoryItem[];
}

const WarehouseDetails = ({ params }: { params: { id: string } }) => {
  const { id } = useParams();
  const warehouseId = Array.isArray(id) ? id[0] : id;
  const clientUser = useCurrentUser();
  const [warehouse, setWarehouse] = useState<ExtendedWarehouse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const intervalDuration = 3600000; // 60 minutes

  const getWarehouseDetails = async () => {
    console.log(LOG_PREFIX, 'Fetching warehouse details');
    try {
      setRefreshing(true);
      const data = await fetchWarehouseById(warehouseId);
      setWarehouse(data);
      setPermissionError(null); // Clear any permission error
      console.log(LOG_PREFIX, 'Fetched warehouse details:', data);
    } catch (error) {
      console.error(LOG_PREFIX, 'Failed to fetch warehouse details:', (error as Error).message);
      setError((error as Error).message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    getWarehouseDetails();

    const intervalId = setInterval(() => {
      getWarehouseDetails();
    }, intervalDuration); // Poll every X seconds

    return () => clearInterval(intervalId);
  }, []);

  usePusher(`WarehouseChannel_${warehouseId}`, 'my-event-warehouse', throttle((data) => {
    console.log(LOG_PREFIX, '[Pusher] Message received:', data);
    if (data.payload.warehouseId === warehouseId) {
      setWarehouse((prevWarehouse) => {
        if (!prevWarehouse) return prevWarehouse;
        return {
          ...prevWarehouse,
          inventory: prevWarehouse.inventory.map((item) =>
            item.id === data.payload.inventoryId ? { ...item, stock: data.payload.stock, version: data.payload.version } : item
          ),
        };
      });
    }
  }, 500)); // Debounce state updates

  const handleStockUpdate = throttle(async (inventoryId: string, action: 'add' | 'subtract') => {
    console.log(LOG_PREFIX, 'Updating stock for inventory:', inventoryId, 'action:', action);
    startTransition(async () => {
      try {
        const response = await updateWarehouseInventory(warehouseId, inventoryId, action);
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
  }, 1000); // Throttle the updates

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
        <h1 className="text-lg md:text-2xl font-bold">Warehouse Details</h1>
        <LoadingTimer intervalDuration={intervalDuration} onRefresh={getWarehouseDetails} refreshing={refreshing} />
      </div>
      {refreshing && <Spinner />}
      {permissionError && <div className="text-red-500">{permissionError}</div>}
      {!warehouse ? (
        <p>Warehouse not available.</p>
      ) : (
        <div className="flex flex-col justify-start items-center">
          <div className="mb-6 border p-4 bg-white/10 border-gray-200 dark:border-gray-700 w-full md:max-w-[1200px] rounded">
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
            </div>
            <div className="warehousedropdown block">
              <ul>
                {warehouse.inventory.map((item) => (
                  <li key={item.id} className="flex justify-between items-center mb-2">
                    <div>
                      <strong>{item.product.title}</strong> - Stock: {item.stock}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant="outline" onClick={() => handleStockUpdate(item.id, 'add')}>+</Button>
                      <Button variant="outline" onClick={() => handleStockUpdate(item.id, 'subtract')}>-</Button>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WarehouseDetails;