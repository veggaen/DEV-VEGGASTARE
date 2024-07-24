import { NextRequest, NextResponse } from 'next/server';
import { dbPrisma } from '@/lib/db';

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const ids = searchParams.getAll('id');
        
        if (!ids || ids.length !== 2) {
            return new NextResponse(JSON.stringify({ message: 'Invalid request parameters' }), { status: 400 });
        }

        const [companyId, warehouseId] = ids;

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
            return new NextResponse(JSON.stringify({ message: 'Warehouse not found' }), { status: 404 });
        }

        return new NextResponse(JSON.stringify(warehouse), { status: 200 });
    } catch (error) {
        console.error('Error fetching warehouse details:', error);
        return new NextResponse(JSON.stringify({ message: 'Internal Server Error' }), { status: 500 });
    }
}