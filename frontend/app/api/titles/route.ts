import { dbPrisma } from '@/lib/db';
import { NextResponse } from 'next/server';
import { TitlesResponseSchema } from '@/lib/types/products';

const isDev = process.env.NODE_ENV !== 'production';


export async function GET() {
  try {
    const titles = await dbPrisma.product.findMany({
      select: { title: true },
    });

    const dto = titles
      .map((t) => t.title)
      .filter((t): t is string => typeof t === 'string' && t.trim().length > 0);

    const parsed = TitlesResponseSchema.safeParse(dto);
    if (!parsed.success) {
      console.error('[api/titles] Invalid GET DTO:', parsed.error);
      return NextResponse.json(
        { error: 'Failed to fetch titles', ...(isDev ? { issues: parsed.error.issues } : {}) },
        { status: 500 }
      );
    }

    return NextResponse.json(parsed.data);
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to fetch titles' }, { status: 500 });
  }
}