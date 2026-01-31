import { NextRequest, NextResponse } from 'next/server';
import { dbPrisma } from '@/lib/db';
import { CompanyWarehouseDetailsResponseSchema } from '@/lib/types/company';

type CompanyWarehouseParams = {
    companyId?: string;
    companyid?: string;
    warehouseId?: string;
    warehouseid?: string;
};

const isDev = process.env.NODE_ENV !== 'production';
const LOG_PREFIX = '[frontend/app/api/companies/[companyId]/warehouses/[warehouseId]/route.ts]';

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
        const resolvedParams = await params;
        const companyId = resolvedParams.companyId ?? resolvedParams.companyid;
        const warehouseId = resolvedParams.warehouseId ?? resolvedParams.warehouseid;

        if (!companyId || !warehouseId) {
            return NextResponse.json({ message: 'Invalid request parameters' }, { status: 400 });
        }

        const warehouse = await dbPrisma.warehouseLocation.findFirst({
            where: { id: warehouseId, companyId },
            include: {
                Inventory: {
                    include: {
                        Product: true,
                    },
                },
            },
        });

        if (!warehouse) {
            return NextResponse.json({ message: 'Warehouse not found' }, { status: 404 });
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
            console.error(LOG_PREFIX, 'Invalid GET DTO:', parsed.error);
            return NextResponse.json(
                { message: 'Internal Server Error', ...(isDev ? { issues: parsed.error.issues } : {}) },
                { status: 500 }
            );
        }

        return NextResponse.json(parsed.data, { status: 200 });
    } catch (error) {
        console.error('Error fetching warehouse details:', error);
        return NextResponse.json({ message: 'Internal Server Error' }, { status: 500 });
    }
}