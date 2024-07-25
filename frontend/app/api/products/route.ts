import { NextResponse } from 'next/server';
import { fetchProductsWithDetails } from '@/actions/fetch-products-with-details';

const LOG_PREFIX = '[frontend/app/api/products/route.ts]';

export const GET = async () => {
  try {
    const products = await fetchProductsWithDetails();
    console.log(`${LOG_PREFIX} Successfully fetched products`);
    return NextResponse.json(products, { status: 200 });
  } catch (error) {
    console.error(`${LOG_PREFIX} Failed to fetch products:`, error);
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 });
  }
};