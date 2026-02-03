import { fetchProductById } from '@/actions/fetch-product-by-id';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { ProductDetailsResponseSchema } from '@/lib/types/products';

const isDev = process.env.NODE_ENV !== 'production';

function toIsoString(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'string' && value) return value;
  return new Date(String(value)).toISOString();
}

function normalizeSpecifications(value: unknown): Array<{ key: string; value: string }> | null {
  let raw = value;
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw);
    } catch {
      return null;
    }
  }

  if (!Array.isArray(raw)) return null;
  const normalized: Array<{ key: string; value: string }> = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const key = (item as any).key;
    const val = (item as any).value;
    if (typeof key === 'string' && typeof val === 'string') {
      normalized.push({ key, value: val });
    }
  }
  return normalized;
}

const paramsSchema = z.object({
  id: z.array(z.string().trim().min(1).max(200)).min(1).max(1),
});

export async function GET(_request: Request, context: { params: Promise<{ id: string[] }> }) {
  const rawParams = await context.params;
  const parsed = paramsSchema.safeParse(rawParams);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid product id' }, { status: 400 });
  }

  const id = parsed.data.id[0];

  try {
    const product = await fetchProductById(id);

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    const companyLocations = (product as any)?.Company?.WarehouseLocation;
    const warehouseLocations = Array.isArray(companyLocations)
      ? companyLocations
          .filter((w: any) => w && typeof w.id === 'string')
          .map((w: any) => ({
            id: w.id,
            country: typeof w.country === 'string' && w.country ? w.country : 'Unknown',
            postalCode: typeof w.postalCode === 'string' && w.postalCode ? w.postalCode : 'Unknown',
          }))
      : [];

    const inventoryRaw = (product as any)?.Inventory;
    const inventory = Array.isArray(inventoryRaw)
      ? inventoryRaw
          .filter((it: any) => it && typeof it.id === 'string')
          .map((it: any) => ({
            id: it.id,
            stock: typeof it.stock === 'number' ? it.stock : 0,
            warehouseId: typeof it.warehouseId === 'string' ? it.warehouseId : '',
          }))
          .filter((it: any) => typeof it.warehouseId === 'string' && it.warehouseId.length > 0)
      : [];

    const dto = {
      id: (product as any).id,
      title: (product as any).title,
      description: (product as any).description,
      category: (product as any).category,
      price: (product as any).price,
      priceCurrency: (product as any).priceCurrency ?? 'USD',
      acceptedFiatCurrencies: Array.isArray((product as any).acceptedFiatCurrencies)
        ? (product as any).acceptedFiatCurrencies
        : [],
      condition: (product as any).condition,
      image: Array.isArray((product as any).image) ? (product as any).image : [],
      specifications: normalizeSpecifications((product as any).specifications),
      userId: (product as any).userId,
      companyId: (product as any).companyId ?? null,
      acceptedTokens: Array.isArray((product as any).ProductAcceptedToken)
        ? (product as any).ProductAcceptedToken.map((t: any) => ({
            family: t.family,
            symbol: t.symbol,
            decimals: t.decimals,
            tokenAddress: t.tokenAddress ?? null,
            tokenMint: t.tokenMint ?? null,
          }))
        : [],
      company: (product as any).companyId
        ? { warehouseLocations: warehouseLocations.length ? warehouseLocations : null }
        : null,
      inventory,
      shipFromPostalId: (product as any).shipFromPostalId,
      updatedAt: toIsoString((product as any).updatedAt),
      createdAt: toIsoString((product as any).createdAt),
    };

    const parsedDto = ProductDetailsResponseSchema.safeParse(dto);
    if (!parsedDto.success) {
      console.error('[api/products/[...id]] Invalid GET DTO:', parsedDto.error);
      return NextResponse.json(
        { error: 'Internal Server Error', ...(isDev ? { issues: parsedDto.error.issues } : {}) },
        { status: 500 }
      );
    }

    return NextResponse.json(parsedDto.data);
  } catch (error) {
    console.error('Error fetching product:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}