import { dbPrisma } from '@/lib/db';
import { NextResponse } from 'next/server';
import { PriceRangeResponseSchema } from '@/lib/types/products';
import { publicCatalogWhere } from '@/lib/public-catalog';
import { catalogRangeUsd } from '@/lib/catalog-price-filter';
import { getExchangeRates } from '@/lib/currency-rates';

const isDev = process.env.NODE_ENV !== 'production';

export async function GET() {
  try {
    const groups = await dbPrisma.product.groupBy({
      by: ['priceCurrency'],
      where: publicCatalogWhere(),
      _min: { price: true },
      _max: { price: true },
    });

    // Common USD basis; the UI converts to the selected display fiat. One SQL
    // group query avoids fetching every product or summing unlike currencies.
    const dto = catalogRangeUsd(groups, groups.length ? await getExchangeRates() : { USD: 1 });
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
