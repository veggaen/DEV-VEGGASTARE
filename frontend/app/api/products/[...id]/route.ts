import { fetchProductById } from '@/actions/fetch-product-by-id';
import { NextResponse } from 'next/server';
import { z } from 'zod';

const paramsSchema = z.object({
  id: z.array(z.string().trim().min(1).max(200)).min(1).max(1),
});

export async function GET(_request: Request, context: { params: Promise<{ id: string[] }> }) {
  const rawParams = await context.params;
  const parsed = paramsSchema.safeParse(rawParams);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid product id' }, { status: 400 });
  }

  const id = parsed.data.id[0];

  try {
    const product = await fetchProductById(id);

    if (!product) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    return NextResponse.json(product);
  } catch (error) {
    console.error('Error fetching product:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}