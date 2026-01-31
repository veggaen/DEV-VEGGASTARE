import { dbPrisma } from '@/lib/db';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { parseJsonOrError } from '@/lib/api-validate';
import { pusherServer } from '@/lib/pusher';
import { MyLibUserAuth } from '@/lib/user-auth';
import { WarehouseInventoryUpdateResponseSchema } from '@/lib/types/pusher-events';

export const dynamic = 'force-dynamic';

const postBodySchema = z.object({
  warehouseId: z.string().min(1),
  inventoryId: z.string().min(1),
  stock: z.number().int().min(0),
});

export async function POST(req: Request) {
  const sessionUser = await MyLibUserAuth();
  if (!sessionUser?.id) {
    const dto = { message: 'Unauthorized' };
    const parsed = WarehouseInventoryUpdateResponseSchema.safeParse(dto);
    return NextResponse.json(parsed.success ? parsed.data : dto, { status: 401 });
  }

  const role = (sessionUser as any).role as string | undefined;
  if (role !== 'ADMIN' && role !== 'OWNER') {
    const dto = { message: 'Forbidden' };
    const parsed = WarehouseInventoryUpdateResponseSchema.safeParse(dto);
    return NextResponse.json(parsed.success ? parsed.data : dto, { status: 403 });
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
          Product: {
            select: {
              id: true,
              title: true,
            },
          },
        },
      });
    });

    if (!updatedInventory) {
      const dto = { message: 'Inventory not found' };
      const parsed = WarehouseInventoryUpdateResponseSchema.safeParse(dto);
      return NextResponse.json(parsed.success ? parsed.data : dto, { status: 404 });
    }

    await pusherServer.trigger(`WarehouseChannel_${warehouseId}`, 'inventory-update', {
      warehouseId,
      inventoryId,
      stock: updatedInventory.stock,
      version: updatedInventory.version,
      product: {
        id: updatedInventory.Product.id,
        title: updatedInventory.Product.title,
      },
    });

    const dto = { message: 'Inventory updated successfully' };
    const parsed = WarehouseInventoryUpdateResponseSchema.safeParse(dto);
    if (!parsed.success) {
      console.error('Invalid pusher/warehouse-inventory/update DTO:', parsed.error.issues);
      return NextResponse.json(
        {
          message: 'Invalid response shape',
          issues: process.env.NODE_ENV === 'development' ? parsed.error.issues : undefined,
        },
        { status: 500 }
      );
    }

    return NextResponse.json(parsed.data, { status: 200 });
  } catch (error) {
    console.error('Error updating inventory:', error);
    const dto = { message: 'Failed to update inventory' };
    const parsed = WarehouseInventoryUpdateResponseSchema.safeParse(dto);
    return NextResponse.json(parsed.success ? parsed.data : dto, { status: 500 });
  }
}