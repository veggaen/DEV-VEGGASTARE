import { NextResponse } from 'next/server';
import { fetchProductsWithDetails } from '@/actions/fetch-products-with-details';
import { z } from 'zod';
import { ProductsListResponseSchema } from '@/lib/types/products';

const LOG_PREFIX = '[frontend/app/api/products/route.ts]';
const isDev = process.env.NODE_ENV !== 'production';
const shouldLog = isDev && process.env.DEBUG_PRODUCTS === '1';

// Helper to parse comma-separated strings to arrays
function parseCommaSeparated(value: string | null, maxItems: number): string[] {
  if (!value) return [];
  return value.split(',').map((s) => s.trim()).filter(Boolean).slice(0, maxItems);
}

export const GET = async (request: Request) => {
  const { searchParams } = new URL(request.url);
  
  // Parse and validate query parameters with explicit types
  const page = Math.max(1, Math.min(1000, parseInt(searchParams.get('page') || '1', 10) || 1));
  const perPage = Math.max(1, Math.min(50, parseInt(searchParams.get('perPage') || '10', 10) || 10));
  const categories = parseCommaSeparated(searchParams.get('categories'), 50);
  const sellerIds = parseCommaSeparated(searchParams.get('sellerIds'), 200);
  const minPrice = Math.max(0, parseFloat(searchParams.get('minPrice') || '0') || 0);
  const maxPriceRaw = searchParams.get('maxPrice');
  const maxPrice = maxPriceRaw ? Math.max(0, parseFloat(maxPriceRaw)) : Number.POSITIVE_INFINITY;
  const searchTerm = (searchParams.get('searchTerm') || '').trim().slice(0, 200);

  // Validate price range
  if (maxPrice < minPrice) {
    return NextResponse.json({ error: 'maxPrice must be >= minPrice' }, { status: 400 });
  }

  if (shouldLog) console.log(`${LOG_PREFIX} page=${page} perPage=${perPage}`);
  
  try {
    const products = await fetchProductsWithDetails({ 
      page, 
      perPage, 
      categories, 
      minPrice, 
      maxPrice, 
      searchTerm, 
      sellerIds 
    });
    if (shouldLog) console.log(`${LOG_PREFIX} Successfully fetched products`);

    const parsed = ProductsListResponseSchema.safeParse(products);
    if (!parsed.success) {
      console.error(`${LOG_PREFIX} Invalid GET DTO:`, parsed.error);
      return NextResponse.json(
        { error: 'Failed to fetch products', ...(isDev ? { issues: parsed.error.issues } : {}) },
        { status: 500 }
      );
    }

    return NextResponse.json(parsed.data, { status: 200 });
  } catch (error) {
    console.error(`${LOG_PREFIX} Failed to fetch products:`, error);
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 });
  }
};