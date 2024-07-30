import { dbPrisma } from '@/lib/db';
import { NextResponse } from 'next/server';

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

    return NextResponse.json({ min: minPriceResult.price, max: maxPriceResult.price });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to fetch price range' }, { status: 500 });
  }
}