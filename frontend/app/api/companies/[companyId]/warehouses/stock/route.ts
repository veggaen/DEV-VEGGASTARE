import { NextRequest } from 'next/server';
import { dbPrisma } from '@/lib/db';
import { CompanyWarehouseStockResponseSchema } from '@/lib/types/company';

import { companyPrivateJson, companyReadScope, companyReadViewer } from '@/lib/company-read-access';

type CompanyParams = { companyId?: string; companyid?: string };

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<CompanyParams> }
) {
    try {
        const viewer = await companyReadViewer();
        if (!viewer) return companyPrivateJson({ message: 'Sign in to view company stock.' }, 401);
        const resolvedParams = await params;
        const companyId = resolvedParams.companyId ?? resolvedParams.companyid;

        if (!companyId) {
            return companyPrivateJson({ message: 'Invalid request parameters' }, 400);
        }

        const company = await dbPrisma.company.findFirst({
            where: { id: companyId, ...companyReadScope(viewer) },
            select: { WarehouseLocation: { select: {
                id: true, address: true, city: true, country: true,
                Inventory: { select: { quantity: true, stock: true } },
            } } },
        });
        if (!company) return companyPrivateJson({ message: 'Company unavailable or access restricted.' }, 404);

        const warehouseData = company.WarehouseLocation.map(warehouse => ({
            id: warehouse.id,
            address: warehouse.address,
            city: warehouse.city,
            country: warehouse.country,
            initialStock: warehouse.Inventory.reduce((acc, item) => acc + item.quantity, 0),
            currentStock: warehouse.Inventory.reduce((acc, item) => acc + item.stock, 0),
        }));

        const parsed = CompanyWarehouseStockResponseSchema.safeParse({ warehouses: warehouseData });
        if (!parsed.success) {
            console.error('Company stock response validation failed');
            return companyPrivateJson({ message: 'Stock could not be loaded. Try again.' }, 500);
        }

        return companyPrivateJson(parsed.data);
    } catch {
        console.error('Company stock read failed');
        return companyPrivateJson({ message: 'Stock could not be loaded. Try again.' }, 500);
    }
}
