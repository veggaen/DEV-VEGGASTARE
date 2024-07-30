import { dbPrisma } from '@/lib/db';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const categories = await dbPrisma.product.findMany({
      distinct: ['category'],
      select: {
        category: true,
      },
    });
    return NextResponse.json(categories.map(cat => cat.category));
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 });
  }
}