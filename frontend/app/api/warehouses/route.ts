import { NextRequest, NextResponse } from 'next/server';
import { dbPrisma } from '@/lib/db';
import { MyLibUserAuth } from '@/lib/user-auth';
import { WarehousesListResponseSchema } from '@/lib/types/warehouses';

const isDev = process.env.NODE_ENV !== 'production';

function toIsoString(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string' && value) return value;
  return new Date(String(value)).toISOString();
}

export async function GET(req: NextRequest) {
  try {
    // Authentication required to view warehouses with inventory
    const session = await MyLibUserAuth();
    if (!session?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('Get() Fetching all warehouses');
    
    // Regular users can only see basic warehouse info
    // Admin/Owner can see full inventory details
    const isAdmin = session.role === 'ADMIN' || session.role === 'OWNER';

    const warehouses = await dbPrisma.warehouseLocation.findMany({
      include: isAdmin ? {
        Inventory: {
          include: {
            Product: {
              select: {
                id: true,
                title: true,
                price: true,
                stock: true,
                image: true,
              },
            },
          },
        },
      } : undefined,
    });

    if (warehouses.length > 0) {
      console.log('Successfully fetched warehouses:', warehouses.length);
    }
    const dto = warehouses.map((w) => ({
      id: w.id,
      userId: w.userId ?? null,
      companyId: w.companyId ?? null,
      postalCode: w.postalCode,
      address: w.address,
      city: w.city,
      country: w.country,
      latitude: w.latitude ?? null,
      longitude: w.longitude ?? null,
      createdAt: toIsoString(w.createdAt),
      updatedAt: toIsoString(w.updatedAt),
      ...(isAdmin
        ? {
            inventory: (w as any).Inventory?.map((inv: any) => ({
              id: inv.id,
              stock: inv.stock,
              product: {
                id: inv.Product.id,
                title: inv.Product.title,
                price: inv.Product.price,
                stock: inv.Product.stock,
                image: inv.Product.image ?? [],
              },
            })) ?? [],
          }
        : {}),
    }));

    const parsed = WarehousesListResponseSchema.safeParse(dto);
    if (!parsed.success) {
      console.error('[api/warehouses] Invalid GET DTO:', parsed.error);
      return NextResponse.json(
        { error: 'Failed to fetch warehouses', ...(isDev ? { issues: parsed.error.issues } : {}) },
        { status: 500 }
      );
    }

    return NextResponse.json(parsed.data, { status: 200 });
  } catch (error) {
    console.error('Failed to fetch warehouses:', error);
    return NextResponse.json({ error: 'Failed to fetch warehouses' }, { status: 500 });
  }
}