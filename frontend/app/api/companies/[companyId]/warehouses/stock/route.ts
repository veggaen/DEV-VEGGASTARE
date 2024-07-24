'use server'

import { NextRequest, NextResponse } from 'next/server';
import { dbPrisma } from '@/lib/db';

export async function GET(req: NextRequest, { params }: { params: { companyId: string } }) {
    try {
        const { companyId } = params;

        if (!companyId) {
            return NextResponse.json({ message: 'Invalid request parameters' }, { status: 400 });
        }

        const warehouses = await dbPrisma.warehouseLocation.findMany({
            where: { companyId: companyId },
            include: {
                inventory: true,
            },
        });

        const warehouseData = warehouses.map(warehouse => ({
            id: warehouse.id,
            address: warehouse.address,
            city: warehouse.city,
            country: warehouse.country,
            initialStock: warehouse.inventory.reduce((acc, item) => acc + item.quantity, 0),
            currentStock: warehouse.inventory.reduce((acc, item) => acc + item.stock, 0),
        }));

        return NextResponse.json({ warehouses: warehouseData }, { status: 200 });
    } catch (error) {
        console.error('Error fetching warehouse stock details:', error);
        return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
    }
}