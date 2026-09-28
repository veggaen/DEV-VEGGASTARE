import { NextRequest } from 'next/server';
import { dbPrisma } from '@/lib/db';
import { CompanyWarehouseDetailsResponseSchema } from '@/lib/types/company';
import { companyPrivateJson, companyReadScope, companyReadViewer } from '@/lib/company-read-access';

type CompanyWarehouseParams = {
    companyId?: string;
    companyid?: string;
    warehouseId?: string;
    warehouseid?: string;
};

const toIsoString = (value: unknown): string => {
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'string' && value.length) return value;
    return new Date(String(value)).toISOString();
};

const toNumber = (value: unknown): number => {
    if (typeof value === 'number') return value;
    if (typeof value === 'string' && value.length) return Number(value);
    return Number(value);
};

export async function GET(
    req: NextRequest,
    { params }: { params: Promise<CompanyWarehouseParams> }
) {
    try {
        const viewer = await companyReadViewer();
        if (!viewer) return companyPrivateJson({ message: 'Sign in to view this warehouse.' }, 401);
        const resolvedParams = await params;
        const companyId = resolvedParams.companyId ?? resolvedParams.companyid;
        const warehouseId = resolvedParams.warehouseId ?? resolvedParams.warehouseid;

        if (!companyId || !warehouseId) {
            return companyPrivateJson({ message: 'Invalid request parameters' }, 400);
        }

        const warehouse = await dbPrisma.warehouseLocation.findFirst({
            where: { id: warehouseId, companyId, Company: { is: companyReadScope(viewer) } },
            include: {
                Inventory: {
                    include: {
                        Product: true,
                    },
                },
            },
        });

        if (!warehouse) {
            return companyPrivateJson({ message: 'Warehouse unavailable or access restricted.' }, 404);
        }

        const dto = {
            id: String(warehouse.id),
            companyId: String(warehouse.companyId),
            postalCode: (warehouse as any).postalCode ?? null,
            address: (warehouse as any).address ?? null,
            city: (warehouse as any).city ?? null,
            country: (warehouse as any).country ?? null,
            latitude: (warehouse as any).latitude ?? null,
            longitude: (warehouse as any).longitude ?? null,
            inventory: Array.isArray((warehouse as any).Inventory)
                ? (warehouse as any).Inventory.map((inv: any) => ({
                    id: String(inv.id),
                    quantity: Number(inv.quantity ?? 0),
                    stock: Number(inv.stock ?? 0),
                    warehouseId: String(inv.warehouseId),
                    productId: String(inv.productId),
                    product: {
                        id: String(inv.Product.id),
                        title: String(inv.Product.title),
                        description: inv.Product.description ?? null,
                        category: inv.Product.category ?? null,
                        price: toNumber(inv.Product.price),
                        stock: Number(inv.Product.stock ?? 0),
                        shipFromPostalId: String(inv.Product.shipFromPostalId),
                        image: Array.isArray(inv.Product.image) ? inv.Product.image : [],
                        specifications:
                            inv.Product.specifications && typeof inv.Product.specifications === 'object' && !Array.isArray(inv.Product.specifications)
                                ? (inv.Product.specifications as Record<string, unknown>)
                                : undefined,
                        userId: String(inv.Product.userId),
                        companyId: inv.Product.companyId ?? null,
                        createdAt: toIsoString(inv.Product.createdAt),
                        updatedAt: toIsoString(inv.Product.updatedAt),
                    },
                    createdAt: toIsoString(inv.createdAt),
                    updatedAt: toIsoString(inv.updatedAt),
                }))
                : [],
            createdAt: toIsoString((warehouse as any).createdAt),
            updatedAt: toIsoString((warehouse as any).updatedAt),
        };

        const parsed = CompanyWarehouseDetailsResponseSchema.safeParse(dto);
        if (!parsed.success) {
            console.error('Company warehouse response validation failed');
            return companyPrivateJson({ message: 'Warehouse could not be loaded. Try again.' }, 500);
        }

        return companyPrivateJson(parsed.data);
    } catch {
        console.error('Company warehouse read failed');
        return companyPrivateJson({ message: 'Warehouse could not be loaded. Try again.' }, 500);
    }
}
