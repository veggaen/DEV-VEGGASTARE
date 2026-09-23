import { dbPrisma } from '@/lib/db';
import { NextResponse } from 'next/server';
import { PriceRangeResponseSchema } from '@/lib/types/products';
import { publicCatalogWhere } from '@/lib/public-catalog';

const isDev = process.env.NODE_ENV !== 'production';

function toNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.length) return Number(value);
  return Number(value);
}

export async function GET() {
  try {
    const range = await dbPrisma.product.aggregate({
      where: publicCatalogWhere(),
      _min: { price: true },
      _max: { price: true },
    });

    // In an empty marketplace, return a safe default instead of 404. Consumers
    // use this for filter initialization and should not crash.
    if (range._min.price === null || range._max.price === null) {
      return NextResponse.json({ min: 0, max: 0 }, { status: 200 });
    }

    const dto = { min: toNumber(range._min.price), max: toNumber(range._max.price) };
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
