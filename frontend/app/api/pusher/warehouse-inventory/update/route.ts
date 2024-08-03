import { dbPrisma } from '@/lib/db';
import { NextApiRequest, NextApiResponse } from 'next';
import Pusher from 'pusher';

const pusher = new Pusher({
  appId: process.env.PUSHER_APP_ID!,
  key: process.env.NEXT_PUBLIC_PUSHER_KEY!,
  secret: process.env.PUSHER_SECRET!,
  cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
  useTLS: true,
});

export async function POST(req: NextApiRequest, res: NextApiResponse) {
    const { warehouseId, inventoryId, stock } = req.body;
  
    try {
      const updatedInventory = await dbPrisma.$transaction(async (prisma) => {
        const inventory = await prisma.inventory.findUnique({
          where: { id: inventoryId },
          select: { version: true },
        });
  
        if (!inventory) throw new Error('Inventory not found');
        console.log('inventory:', inventory);
        
        // Update the inventory with the new stock and increment the version for optimistic locking
        await prisma.inventory.update({
          where: { id_version: { id: inventoryId, version: inventory.version } },
          data: {
            stock,
            version: inventory.version + 1,
          },
        });
  
        return prisma.inventory.findUnique({
          where: { id: inventoryId },
          select: {
            id: true,
            stock: true,
            version: true,
            product: {
              select: {
                id: true,
                title: true,
              },
            },
          },
        });
      });
  
      await pusher.trigger(`WarehouseChannel_${warehouseId}`, 'inventory-update', {
        warehouseId,
        inventoryId,
        stock: updatedInventory?.stock,
        version: updatedInventory?.version,
        product: {
          id: updatedInventory?.product.id,
          title: updatedInventory?.product.title,
        },
      });
  
      res.status(200).json({ message: 'Inventory updated successfully' });
    } catch (error) {
      console.error('Error updating inventory:', error);
      res.status(500).json({ error: 'Failed to update inventory' });
    }
  }