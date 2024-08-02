import { NextRequest, NextResponse } from 'next/server';
import { dbPrisma } from '@/lib/db';
import Pusher from 'pusher';

const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.NEXT_PUBLIC_PUSHER_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
  useTLS: true,
});

export async function POST(req: NextRequest, res: NextResponse) {
  try {
    const { warehouseId, inventoryId, stock } = await req.json();

    // Using optimistic locking for concurrency control
    await dbPrisma.$transaction(async (tx) => {
      const inventory = await tx.inventory.findUnique({
        where: { id: inventoryId },
      });

      if (!inventory) {
        throw new Error('Inventory item not found');
      }

      // Update the inventory with the new stock and increment the version for optimistic locking
      await tx.inventory.update({
        where: { id: inventoryId, version: inventory.version },
        data: {
          stock,
          version: inventory.version + 1,
        },
      });
    });

    // Trigger the Pusher event with reduced payload
    await pusher.trigger('MainChannelUpdateWarehouse', 'my-event-warehouse', {
      type: 'INVENTORY_UPDATE',
      payload: {
        warehouseId,
        inventoryId,
        stock,
      },
    });

    return new NextResponse(JSON.stringify({ success: true }), { status: 200 });
  } catch (error: any) {
    console.error('Error updating inventory:', error);
    return new NextResponse(JSON.stringify({ error: error.message }), { status: 500 });
  }
}