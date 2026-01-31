import { dbPrisma } from '@/lib/db';
import { NextResponse } from 'next/server';
import { CategoriesWithCountsResponseSchema } from '@/lib/types/categories';

const isDev = process.env.NODE_ENV !== 'production';

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

    const parsed = CategoriesWithCountsResponseSchema.safeParse(result);
    if (!parsed.success) {
      console.error('[API/categories-with-counts] Invalid GET DTO:', parsed.error);
      return NextResponse.json(
        { error: 'Failed to fetch categories with counts', ...(isDev ? { issues: parsed.error.issues } : {}) },
        { status: 500 }
      );
    }

    return NextResponse.json(parsed.data);
  } catch (error) {
    console.error('[API/categories-with-counts] Error:', error);
    return NextResponse.json({ error: 'Failed to fetch categories with counts' }, { status: 500 });
  }
}

