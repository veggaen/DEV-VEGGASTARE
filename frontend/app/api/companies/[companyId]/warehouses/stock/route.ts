import { NextRequest, NextResponse } from 'next/server';
import { dbPrisma } from '@/lib/db';
import { CompanyWarehouseStockResponseSchema } from '@/lib/types/company';

const isDev = process.env.NODE_ENV !== 'production';
const LOG_PREFIX = '[frontend/app/api/companies/[companyId]/warehouses/stock/route.ts]';

type CompanyParams = { companyId?: string; companyid?: string };

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<CompanyParams> }
) {
    try {
        const resolvedParams = await params;
        const companyId = resolvedParams.companyId ?? resolvedParams.companyid;

        if (!companyId) {
            return NextResponse.json({ message: 'Invalid request parameters' }, { status: 400 });
        }

        const warehouses = await dbPrisma.warehouseLocation.findMany({
            where: { companyId: companyId },
            include: {
                Inventory: true,
            },
        });

        const warehouseData = warehouses.map(warehouse => ({
            id: warehouse.id,
            address: warehouse.address,
            city: warehouse.city,
            country: warehouse.country,
            initialStock: warehouse.Inventory.reduce((acc, item) => acc + item.quantity, 0),
            currentStock: warehouse.Inventory.reduce((acc, item) => acc + item.stock, 0),
        }));

        const parsed = CompanyWarehouseStockResponseSchema.safeParse({ warehouses: warehouseData });
        if (!parsed.success) {
            console.error(LOG_PREFIX, 'Invalid GET DTO:', parsed.error);
            return NextResponse.json(
                { message: 'Internal Server Error', ...(isDev ? { issues: parsed.error.issues } : {}) },
                { status: 500 }
            );
        }

        return NextResponse.json(parsed.data, { status: 200 });
    } catch (error) {
        console.error('Error fetching warehouse stock details:', error);
        return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
    }
}