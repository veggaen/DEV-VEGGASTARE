import { dbPrisma } from '@/lib/db';
import { NextResponse } from 'next/server';

export interface CategoryWithCount {
  category: string;
  count: number;
}

export async function GET() {
  try {
    // Group products by category and count them
    const categoryCounts = await dbPrisma.product.groupBy({
      by: ['category'],
      _count: {
        id: true,
      },
      orderBy: {
        _count: {
          id: 'desc',
        },
      },
    });

    const result: CategoryWithCount[] = categoryCounts.map((item) => ({
      category: item.category,
      count: item._count.id,
    }));

    return NextResponse.json(result);
  } catch (error) {
    console.error('[API/categories-with-counts] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch categories with counts' }, { status: 500 });
  }
}

