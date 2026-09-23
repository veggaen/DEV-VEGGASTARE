'use client';

import { useCallback, useEffect, useState, useTransition, FC } from 'react';
import Link from 'next/link';
import { updateWarehouseInventory } from '@/actions/updateWarehouse';
import { Button } from '@/components/ui/button';
import Spinner from '@/components/uicustom/spinner';
import { useCurrentUser } from '@/hooks/use-current-user';
import usePusher from '@/hooks/usePusher';
import throttle from 'lodash.throttle';
import { WarehousesListResponseSchema, type WarehouseLocationDto } from '@/lib/types/warehouses';

const LOG_PREFIX = '[frontend/app/warehouses/page.tsx]';

const WarehouseOverview = () => {
  const clientUser = useCurrentUser();
  const [warehouses, setWarehouses] = useState<WarehouseLocationDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [showDropdown, setShowDropdown] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const intervalDuration = 3600000; // 60 minutes

  const getWarehouses = useCallback(async () => {
    console.log(LOG_PREFIX, 'Fetching warehouses');
    try {
      setRefreshing(true);
      // Read through the authenticated, role-filtered GET endpoint. A Server
      // Action is a POST and is intentionally denied for read-only demo users.
      const response = await fetch('/api/warehouses');
      if (!response.ok) throw new Error('Warehouses are temporarily unavailable. Please retry.');
      const data = WarehousesListResponseSchema.parse(await response.json());
      setWarehouses(data);
      setError(null);
      setPermissionError(null); // Clear any permission error
    } catch (error) {
      console.error(LOG_PREFIX, 'Failed to fetch warehouses:', (error as Error).message);
      setError('Warehouses are temporarily unavailable. Please retry.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    getWarehouses();

    const intervalId = setInterval(() => {
      getWarehouses();
    }, intervalDuration); // Poll every X seconds

    return () => clearInterval(intervalId);
  }, [getWarehouses]);

  const canReadInventory = clientUser?.role === 'ADMIN' || clientUser?.role === 'OWNER';
  const handleInventoryEvent = useCallback(() => { void getWarehouses(); }, [getWarehouses]);
  usePusher(canReadInventory && showDropdown ? `WarehouseChannel_${showDropdown}` : '', 'my-event-warehouse', handleInventoryEvent);

  const handleStockUpdate = throttle(async (warehouseId: string, inventoryId: string, action: 'add' | 'subtract') => {
    console.log(LOG_PREFIX, 'Updating stock for warehouse:', warehouseId, 'inventory:', inventoryId, 'action:', action);
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

  if (loading) return <section role="status" aria-label="Loading warehouses" className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8"><div className="h-8 w-56 rounded bg-muted motion-safe:animate-pulse" /><div className="h-48 rounded-xl bg-muted motion-safe:animate-pulse" /></section>;

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 text-foreground sm:px-6 lg:px-8">
      <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Experimental · logistics workspace</p>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-lg md:text-2xl font-bold">Warehouse Overview</h1>
        <LoadingTimer intervalDuration={intervalDuration} onRefresh={getWarehouses} refreshing={refreshing} />
      </div>
      {error && <p role="alert" className="mb-6 rounded-xl border border-destructive/30 p-4 text-sm">{error}</p>}
      {permissionError && <div className="text-red-500">{permissionError}</div>}
      {warehouses.length === 0 ? (
        <p>No warehouses available.</p>
      ) : (
        <div className="flex flex-col justify-start items-center">
          {warehouses.map((warehouse) => (
            <div key={warehouse.id} className="mb-6 border p-4 bg-white/10 border-gray-200 dark:border-gray-700 w-full md:max-w-[1200px] rounded">
              <div className="flex flex-wrap items-center justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="text-lg md:text-xl font-semibold mb-2">
                    {warehouse.address ? `${warehouse.address}, ` : ''}
                    {warehouse.city ? `${warehouse.city}, ` : ''}
                    {warehouse.country}
                  </h2>
                  {(!warehouse.address || !warehouse.city) && <p className="mb-2 text-sm text-muted-foreground">Address incomplete · not ready for shipping</p>}
                  <Link href={`/warehouses/${warehouse.id}`}>
                    <div className="text-blue-500 dark:text-blue-300 hover:underline">View Details</div>
                  </Link>
                </div>
                {warehouse.inventory && <Button variant="vegaNormalBtn" className="min-h-11" aria-expanded={showDropdown === warehouse.id} onClick={() => setShowDropdown(showDropdown === warehouse.id ? null : warehouse.id)}>
                  {showDropdown === warehouse.id ? 'Hide inventory' : 'Show inventory'}
                </Button>}
              </div>
              {showDropdown === warehouse.id && (
                <div className="warehousedropdown block">
                  <ul>
                    {warehouse.inventory?.map((item) => (
                      <li key={item.id} className="mb-3 flex flex-wrap items-center justify-between gap-3">
                        <div className="min-w-0">
                          <strong>{item.product.title}</strong> - Stock: {item.stock}
                        </div>
                        {clientUser?.role === 'ADMIN' && <div className="flex items-center gap-2">
                          <Button variant="outline" className="size-11" disabled={isPending} aria-label={`Increase stock for ${item.product.title}`} onClick={() => handleStockUpdate(warehouse.id, item.id, 'add')}>+</Button>
                          <Button variant="outline" className="size-11" disabled={isPending || item.stock <= 0} aria-label={`Decrease stock for ${item.product.title}`} onClick={() => handleStockUpdate(warehouse.id, item.id, 'subtract')}>−</Button>
                        </div>}
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
