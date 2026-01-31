import { NextRequest, NextResponse } from 'next/server';
import { dbPrisma } from '@/lib/db';
import { parseQueryOrError } from '@/lib/api-validate';
import { z } from 'zod';
import { WarehouseDetailsResponseSchema } from '@/lib/types/warehouses';

const isDev = process.env.NODE_ENV !== 'production';

function toIsoString(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string' && value) return value;
  return new Date(String(value)).toISOString();
}

const querySchema = z.object({
  id: z.string().trim().min(1).max(200),
});

export async function GET(req: NextRequest) {
  const queryResult = parseQueryOrError(req, querySchema);
  if (!queryResult.ok) return queryResult.response;
  const { id } = queryResult.data;

  try {
    if (isDev) console.log('[frontend/app/api/warehouses/[...id]/route.ts] GET warehouse details for ID:', id);
    const warehouse = await dbPrisma.warehouseLocation.findUnique({
      where: { id: id },
      include: {
        Inventory: {
          include: {
            Product: true,
          },
        },
      },
    });

    if (!warehouse) {
      console.log('[frontend/app/api/warehouses/[...id]/route.ts] Warehouse not found for ID:', id);
      return NextResponse.json({ error: 'Warehouse not found' }, { status: 404 });
    }

    const warehouseDetails = {
      warehouse: {
        id: warehouse.id,
        userId: warehouse.userId ?? null,
        companyId: warehouse.companyId ?? null,
        postalCode: warehouse.postalCode,
        address: warehouse.address,
        city: warehouse.city,
        country: warehouse.country,
        latitude: warehouse.latitude ?? null,
        longitude: warehouse.longitude ?? null,
        createdAt: toIsoString(warehouse.createdAt),
        updatedAt: toIsoString(warehouse.updatedAt),
        inventory: warehouse.Inventory.map((inv) => ({
          id: inv.id,
          stock: inv.stock,
          product: {
            id: inv.Product.id,
            title: inv.Product.title,
            price: inv.Product.price,
            stock: inv.Product.stock,
            image: inv.Product.image ?? [],
          },
        })),
      },
      products: warehouse.Inventory.map((inv) => ({
        product: {
          id: inv.Product.id,
          title: inv.Product.title,
          price: inv.Product.price,
          stock: inv.Product.stock,
          image: inv.Product.image ?? [],
        },
        stock: inv.stock,
      })),
    };

    const parsed = WarehouseDetailsResponseSchema.safeParse(warehouseDetails);
    if (!parsed.success) {
      console.error('[frontend/app/api/warehouses/[...id]/route.ts] Invalid GET DTO:', parsed.error);
      return NextResponse.json(
        { error: 'Internal server error', ...(isDev ? { issues: parsed.error.issues } : {}) },
        { status: 500 }
      );
    }

    if (isDev) console.log('[frontend/app/api/warehouses/[...id]/route.ts] Fetched warehouse details');
    return NextResponse.json(parsed.data, { status: 200 });
  } catch (error) {
    console.error('[frontend/app/api/warehouses/[...id]/route.ts] Error fetching warehouse details:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}