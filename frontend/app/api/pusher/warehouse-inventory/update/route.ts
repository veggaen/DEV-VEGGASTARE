import { dbPrisma } from '@/lib/db';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { parseJsonOrError } from '@/lib/api-validate';
import { pusherServer } from '@/lib/pusher';
import { MyLibUserAuth } from '@/lib/user-auth';

export const dynamic = 'force-dynamic';

const postBodySchema = z.object({
  warehouseId: z.string().min(1),
  inventoryId: z.string().min(1),
  stock: z.number().int().min(0),
});

export async function POST(req: Request) {
  const sessionUser = await MyLibUserAuth();
  if (!sessionUser?.id) {
    return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  }

  const role = (sessionUser as any).role as string | undefined;
  if (role !== 'ADMIN' && role !== 'OWNER') {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  }

  const bodyResult = await parseJsonOrError(req, postBodySchema);
  if (!bodyResult.ok) return bodyResult.response;

  const { warehouseId, inventoryId, stock } = bodyResult.data;

  try {
    const updatedInventory = await dbPrisma.$transaction(async (prisma) => {
      const inventory = await prisma.inventory.findUnique({
        where: { id: inventoryId },
        select: { version: true },
      });

      if (!inventory) {
        return null;
      }

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

    if (!updatedInventory) {
      return NextResponse.json({ message: 'Inventory not found' }, { status: 404 });
    }

    await pusherServer.trigger(`WarehouseChannel_${warehouseId}`, 'inventory-update', {
      warehouseId,
      inventoryId,
      stock: updatedInventory.stock,
      version: updatedInventory.version,
      product: {
        id: updatedInventory.product.id,
        title: updatedInventory.product.title,
      },
    });

    return NextResponse.json({ message: 'Inventory updated successfully' }, { status: 200 });
  } catch (error) {
    console.error('Error updating inventory:', error);
    return NextResponse.json({ message: 'Failed to update inventory' }, { status: 500 });
  }
}