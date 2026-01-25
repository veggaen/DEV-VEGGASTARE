import { NextResponse } from 'next/server';
import { fetchProductsWithDetails } from '@/actions/fetch-products-with-details';
import { parseQueryOrError } from '@/lib/api-validate';
import { z } from 'zod';

const LOG_PREFIX = '[frontend/app/api/products/route.ts]';
const isDev = process.env.NODE_ENV !== 'production';
const shouldLog = isDev && process.env.DEBUG_PRODUCTS === '1';

const querySchema = z
  .object({
    page: z.coerce.number().int().min(1).max(1000).optional().default(1),
    perPage: z.coerce.number().int().min(1).max(50).optional().default(10),
    categories: z
      .preprocess(
        (v) =>
          typeof v === 'string'
            ? v
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean)
            : [],
        z.array(z.string().min(1).max(100)).max(50)
      )
      .optional()
      .default([]),
    sellerIds: z
      .preprocess(
        (v) =>
          typeof v === 'string'
            ? v
                .split(',')
                .map((s) => s.trim())
                .filter(Boolean)
            : [],
        z.array(z.string().min(1).max(200)).max(200)
      )
      .optional()
      .default([]),
    minPrice: z.coerce.number().min(0).optional().default(0),
    maxPrice: z
      .preprocess((v) => (v === undefined ? undefined : Number(v)), z.number().min(0))
      .optional()
      .default(Number.POSITIVE_INFINITY),
    searchTerm: z.string().trim().max(200).optional().default(''),
  })
  .refine((v) => v.maxPrice >= v.minPrice, { message: 'maxPrice must be >= minPrice' });

export const GET = async (request: Request) => {
  const queryResult = parseQueryOrError(request, querySchema);
  if (!queryResult.ok) return queryResult.response;
  const { page, perPage, categories, minPrice, maxPrice, searchTerm, sellerIds } = queryResult.data;

  if (shouldLog) console.log(`${LOG_PREFIX} page=${page} perPage=${perPage}`);
  
  try {
    const products = await fetchProductsWithDetails({ page, perPage, categories, minPrice, maxPrice, searchTerm, sellerIds });
    if (shouldLog) console.log(`${LOG_PREFIX} Successfully fetched products`);
    return NextResponse.json(products, { status: 200 });
  } catch (error) {
    console.error(`${LOG_PREFIX} Failed to fetch products:`, error);
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 });
  }
};