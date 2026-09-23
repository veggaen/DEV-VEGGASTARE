'use client';

import { useCallback, useEffect, useState, useTransition, FC } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import Spinner from '@/components/uicustom/spinner';
import { useCurrentUser } from '@/hooks/use-current-user';
import usePusher from '@/hooks/usePusher';
import throttle from 'lodash.throttle';
import { WarehouseDetailsResponseSchema, type WarehouseLocationDto } from '@/lib/types/warehouses';
import { updateWarehouseInventory } from '@/actions/updateWarehouse';
import { useParams } from 'next/navigation';

const LOG_PREFIX = '[frontend/app/warehouses/[id]/page.tsx]';

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
    if (refreshing) {
      const timeoutId = window.setTimeout(() => setProgress(0), 0);
      return () => window.clearTimeout(timeoutId);
    }
  }, [refreshing]);

  return (
    <div className="flex items-center">
      <div aria-hidden="true" className="relative w-6 h-6">
        <svg className="absolute top-0 left-0 w-full h-full" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="45" stroke="currentColor" strokeWidth="5" fill="none" className="text-gray-300" />
          <circle cx="50" cy="50" r="45" stroke="currentColor" strokeWidth="5" fill="none" className="text-blue-500" strokeDasharray="282.743" strokeDashoffset={(282.743 * (100 - progress)) / 100} />
        </svg>
        {refreshing && <Spinner className="absolute top-0 left-0 w-full h-full" />}
      </div>
      <Button
        variant="vegaNormalBtn"
        className="ml-4 min-h-11 text-sm font-medium text-blue-500 dark:text-blue-300 hover:underline"
        onClick={onRefresh}
        disabled={refreshing}
      >
        Refresh Now
      </Button>
    </div>
  );
};

const WarehouseDetails = () => {
  const { id } = useParams();
  const warehouseId = Array.isArray(id) ? id[0] : id;
  const clientUser = useCurrentUser();
  const [warehouse, setWarehouse] = useState<WarehouseLocationDto | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const intervalDuration = 3600000; // 60 minutes

  const getWarehouseDetails = useCallback(async () => {
    const id = warehouseId;
    if (!id) {
      setError('Invalid warehouse id');
      setLoading(false);
      return;
    }
    try {
      setRefreshing(true);
      const response = await fetch(`/api/warehouses/${encodeURIComponent(id)}?id=${encodeURIComponent(id)}`);
      if (!response.ok) throw new Error(response.status === 404 ? 'Warehouse not found. Return to the warehouse list.' : 'Warehouse details are temporarily unavailable. Please retry.');
      const data = WarehouseDetailsResponseSchema.parse(await response.json());
      setWarehouse(data.warehouse);
      setError(null);
      setPermissionError(null); // Clear any permission error
    } catch (error) {
      console.error(LOG_PREFIX, 'Failed to fetch warehouse details:', (error as Error).message);
      setError((error as Error).message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [warehouseId]);

  useEffect(() => {
    getWarehouseDetails();

    const intervalId = setInterval(() => {
      getWarehouseDetails();
    }, intervalDuration); // Poll every X seconds

    return () => clearInterval(intervalId);
  }, [getWarehouseDetails]);

  // Public notifications carry no inventory data. Re-read through the role-
  // checked API, including when another client's role has since been revoked.
  const handleInventoryEvent = useCallback(() => {
    void getWarehouseDetails();
  }, [getWarehouseDetails]);
  const canReadInventory = clientUser?.role === 'ADMIN' || clientUser?.role === 'OWNER';
  usePusher(canReadInventory && warehouseId ? `WarehouseChannel_${warehouseId}` : '', 'my-event-warehouse', handleInventoryEvent);

  const handleStockUpdate = throttle(async (inventoryId: string, action: 'add' | 'subtract') => {
    console.log(LOG_PREFIX, 'Updating stock for inventory:', inventoryId, 'action:', action);
    startTransition(async () => {
      try {
        if (!warehouseId) {
          return;
        }
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

  if (loading) return <section role="status" aria-label="Loading warehouse" className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8"><div className="h-8 w-56 rounded bg-muted motion-safe:animate-pulse" /><div className="h-48 rounded-xl bg-muted motion-safe:animate-pulse" /></section>;

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 text-foreground sm:px-6 lg:px-8">
      <Link href="/warehouses" className="mb-4 inline-flex min-h-11 items-center underline underline-offset-4">Back to warehouses</Link>
      <p className="mb-3 text-xs font-medium uppercase tracking-wider text-muted-foreground">Experimental · logistics workspace</p>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-lg md:text-2xl font-bold">Warehouse Details</h1>
        <LoadingTimer intervalDuration={intervalDuration} onRefresh={getWarehouseDetails} refreshing={refreshing} />
      </div>
      {error && <p role="alert" className="mb-6 rounded-xl border border-destructive/30 p-4 text-sm">{error}</p>}
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
                {(!warehouse.address || !warehouse.city) && <p className="mb-4 text-sm text-muted-foreground">Address incomplete · not ready for shipping</p>}
                {!canReadInventory && <p className="text-sm text-muted-foreground">Inventory is visible to authorized warehouse administrators. You can browse basic location details in this account.</p>}
              </div>
            </div>
            <div className="warehousedropdown block">
              <ul>
                {warehouse.inventory?.map((item) => (
                  <li key={item.id} className="mb-3 flex flex-wrap items-center justify-between gap-3">
                    <div className="min-w-0">
                      <strong>{item.product.title}</strong> - Stock: {item.stock}
                    </div>
                    {clientUser?.role === 'ADMIN' && <div className="flex items-center gap-2">
                      <Button variant="outline" className="size-11" disabled={isPending} aria-label={`Increase stock for ${item.product.title}`} onClick={() => handleStockUpdate(item.id, 'add')}>+</Button>
                      <Button variant="outline" className="size-11" disabled={isPending || item.stock <= 0} aria-label={`Decrease stock for ${item.product.title}`} onClick={() => handleStockUpdate(item.id, 'subtract')}>−</Button>
                    </div>}
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
