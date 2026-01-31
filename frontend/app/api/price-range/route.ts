import { dbPrisma } from '@/lib/db';
import { NextResponse } from 'next/server';
import { PriceRangeResponseSchema } from '@/lib/types/products';

const isDev = process.env.NODE_ENV !== 'production';

function toNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.length) return Number(value);
  return Number(value);
}

export async function GET() {
  try {
    const minPriceResult = await dbPrisma.product.findFirst({
      orderBy: { price: 'asc' },
      select: { price: true }
    });
    const maxPriceResult = await dbPrisma.product.findFirst({
      orderBy: { price: 'desc' },
      select: { price: true }
    });

    if (minPriceResult === null || maxPriceResult === null) {
      return NextResponse.json({ error: 'No products found' }, { status: 404 });
    }

    const dto = { min: toNumber(minPriceResult.price), max: toNumber(maxPriceResult.price) };
    const parsed = PriceRangeResponseSchema.safeParse(dto);
    if (!parsed.success) {
      console.error('[api/price-range] Invalid GET DTO:', parsed.error);
      return NextResponse.json(
        { error: 'Failed to fetch price range', ...(isDev ? { issues: parsed.error.issues } : {}) },
        { status: 500 }
      );
    }

    return NextResponse.json(parsed.data);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to fetch price range' }, { status: 500 });
  }
}