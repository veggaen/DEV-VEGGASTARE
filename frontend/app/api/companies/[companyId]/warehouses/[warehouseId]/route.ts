import { NextRequest, NextResponse } from 'next/server';
import { dbPrisma } from '@/lib/db';

export async function GET(req: NextRequest, { params }: { params: { companyId: string; warehouseId: string } }) {
    try {
        const { companyId, warehouseId } = params;
        console.log('Received request with params:', { companyId, warehouseId });

        if (!companyId || !warehouseId) {
            console.error('Invalid request parameters:', { companyId, warehouseId });
            return NextResponse.json({ message: 'Invalid request parameters' }, { status: 400 });
        }

        const warehouse = await dbPrisma.warehouseLocation.findUnique({
            where: { id: warehouseId },
            include: {
                inventory: {
                    include: {
                        product: true,
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