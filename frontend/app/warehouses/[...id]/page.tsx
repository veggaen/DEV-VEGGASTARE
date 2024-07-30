'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { fetchWarehouseById } from '@/actions/fetchWarehouseById';
import { updateWarehouseInventory } from '@/actions/updateWarehouse';
import { Button } from '@/components/ui/button';
import Spinner from '@/components/uicustom/spinner';
import { useWebSocket } from '@/hooks/useWebSocket';

const LOG_PREFIX = '[frontend/app/warehouses/[...id]/page.tsx]';

const WarehouseDetail = () => {
  const router = useRouter();
  const { id } = useParams();
  const warehouseId = Array.isArray(id) ? id[0] : id;
  const [warehouse, setWarehouse] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [permissionError, setPermissionError] = useState<string | null>(null);

  const getWarehouse = async (warehouseId: string) => {
    try {
      setLoading(true);
      const data = await fetchWarehouseById(warehouseId);
      setWarehouse(data);
      setPermissionError(null); // Clear any permission error
    } catch (error) {
      console.error(LOG_PREFIX, 'Failed to fetch warehouse:', (error as Error).message);
      setError((error as Error).message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (warehouseId) {
      getWarehouse(warehouseId);
    }
  }, [warehouseId]);

  useWebSocket((data) => {
    console.log(LOG_PREFIX, '[WebSocket] Message received:', data);
    if (data.type === 'WAREHOUSES_UPDATE') {
      console.log(LOG_PREFIX, '[WebSocket] Updating warehouse:', data.payload);
      const updatedWarehouse = data.payload.find((wh: any) => wh.id === warehouseId);
      if (updatedWarehouse) {
        setWarehouse(updatedWarehouse);
      }
    }
  });

  const handleStockUpdate = async (inventoryId: string, stock: number) => {
    try {
      const response = await updateWarehouseInventory(warehouseId as string, inventoryId, stock);
      if (response.status === 200) {
        console.log(LOG_PREFIX, 'Warehouse updated successfully');
        getWarehouse(warehouseId as string); // Refresh data after update
      } else {
        console.error('Failed to update warehouse:', response.message);
        setPermissionError('Missing permissions for this action');
      }
    } catch (error) {
      console.error('Failed to update warehouse:', (error as Error).message);
      setError((error as Error).message);
    }
  };

  if (loading) return <Spinner />;
  if (error) return <div>{error}</div>;

  return (
    <div className="p-4 md:p-6 lg:p-8 min-h-screen bg-white dark:bg-gray-900 text-black dark:text-white">
      {permissionError && <div className="text-red-500">{permissionError}</div>}
      {warehouse ? (
        <div className="mb-6 border p-4 bg-white/10 border-gray-200 dark:border-gray-700 rounded">
          <div className="flex justify-start items-center gap-2">
            <div>
              <h2 className="text-lg md:text-xl font-semibold mb-2">
                {warehouse.address ? `${warehouse.address}, ` : ''}
                {warehouse.city ? `${warehouse.city}, ` : ''}
                {warehouse.country}
              </h2>
              <Link href={`/warehouses`}>
                <div className="text-blue-500 dark:text-blue-300 hover:underline">Back to Overview</div>
              </Link>
            </div>
          </div>
          <div>
            <ul>
              {warehouse.inventory.map((item: any) => (
                <li key={item.id} className="flex justify-between items-center mb-2">
                  <div>
                    <strong>{item.product.title}</strong> - Stock: {item.stock}
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" onClick={() => handleStockUpdate(item.id, item.stock + 1)}>+</Button>
                    <Button variant="outline" onClick={() => handleStockUpdate(item.id, item.stock - 1)}>-</Button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : (
        <p>Warehouse not found.</p>
      )}
    </div>
  );
};

export default WarehouseDetail;