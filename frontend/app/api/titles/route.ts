import { dbPrisma } from '@/lib/db';
import { NextResponse } from 'next/server';


export async function GET() {
  try {
    const titles = await dbPrisma.product.findMany({
      select: { title: true },
    });
    return NextResponse.json(titles.map(t => t.title));
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: 'Failed to fetch titles' }, { status: 500 });
  }
}