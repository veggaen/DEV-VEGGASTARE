/** @fileOverview Validated warehouse reads with explicit access versus temporary failure states. @stability stable */
import { WarehouseDetailsResponseSchema, WarehousesListResponseSchema } from '@/lib/types/warehouses';

export class WarehouseReadError extends Error {
  constructor(message: string, public readonly discardSaved: boolean) { super(message); }
}
export async function readWarehouseLocations(endpoint: string, detail: boolean, signal: AbortSignal) {
  const response = await fetch(endpoint, { signal, cache: 'no-store' });
  if (!response.ok) {
    const discard = [401, 403, 404].includes(response.status);
    throw new WarehouseReadError(response.status === 401 ? 'Your session has expired. Sign in again.'
      : response.status === 403 ? 'This account no longer has access to these warehouse details.'
      : response.status === 404 ? 'Warehouse not found. Return to the warehouse list.'
      : response.status === 429 ? 'Too many requests. Wait a moment, then refresh.'
      : 'Warehouses are temporarily unavailable. Please refresh.', discard);
  }
  const payload: unknown = await response.json();
  if (detail) return [WarehouseDetailsResponseSchema.parse(payload).warehouse];
  return WarehousesListResponseSchema.parse(payload);
}
