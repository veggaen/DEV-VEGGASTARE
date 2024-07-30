import { fetchProductById } from '@/actions/fetch-product-by-id';
import { NextResponse } from 'next/server';


export async function GET(request: Request) {
  const { pathname } = new URL(request.url);
  const id = pathname.split('/').pop(); // Extract the ID from the URL

  if (!id) {
    return NextResponse.json({ error: 'Product ID is required' }, { status: 400 });
  }

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