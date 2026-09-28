/** @fileOverview Public events invalidate caches; authorized HTTP reads return stock. @stability stable */
import { pusherServer } from '@/lib/pusher';

export async function publishWarehouseInvalidation(warehouseId: string) {
  // This is a public channel, not an access-control boundary. Never add stock,
  // inventory/product IDs, titles, orders, or tenant data to this payload.
  await pusherServer.trigger(`WarehouseChannel_${warehouseId}`, 'my-event-warehouse', {
    type: 'INVENTORY_INVALIDATED',
  });
}
