import { dbPrisma } from '@/lib/db';
import { NextResponse } from 'next/server';
import { CategoriesResponseSchema } from '@/lib/types/categories';

const isDev = process.env.NODE_ENV !== 'production';

export async function GET() {
  try {
    const categories = await dbPrisma.product.findMany({
      distinct: ['category'],
      select: {
        category: true,
      },
    });

    const dto = categories
      .map((cat) => cat.category)
      .filter((c): c is string => typeof c === 'string' && c.trim().length > 0);

    const parsed = CategoriesResponseSchema.safeParse(dto);
    if (!parsed.success) {
      console.error('[api/categories] Invalid GET DTO:', parsed.error);
      return NextResponse.json(
        { error: 'Failed to fetch categories', ...(isDev ? { issues: parsed.error.issues } : {}) },
        { status: 500 }
      );
    }

    return NextResponse.json(parsed.data);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to fetch categories' }, { status: 500 });
  }
}