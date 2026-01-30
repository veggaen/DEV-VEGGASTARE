import { NextRequest, NextResponse } from 'next/server';
import { dbPrisma } from '@/lib/db';

type CompanyWarehouseParams = {
    companyId?: string;
    companyid?: string;
    warehouseId?: string;
    warehouseid?: string;
};

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<CompanyWarehouseParams> }
) {
    try {
        const resolvedParams = await params;
        const companyId = resolvedParams.companyId ?? resolvedParams.companyid;
        const warehouseId = resolvedParams.warehouseId ?? resolvedParams.warehouseid;
        console.log('Received request with params:', { companyId, warehouseId });

        if (!companyId || !warehouseId) {
            console.error('Invalid request parameters:', { companyId, warehouseId });
            return NextResponse.json({ message: 'Invalid request parameters' }, { status: 400 });
        }

        const warehouse = await dbPrisma.warehouseLocation.findUnique({
            where: { id: warehouseId },
            include: {
                Inventory: {
                    include: {
                        Product: true,
                    },
                },
            },
        });

        if (!warehouse) {
            console.error('Warehouse not found for ID:', warehouseId);
            return NextResponse.json({ message: 'Warehouse not found' }, { status: 404 });
        }

        console.log('Fetched warehouse:', warehouse);
        return NextResponse.json(warehouse, { status: 200 });
    } catch (error) {
        console.error('Error fetching warehouse details:', error);
        return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
    }
}