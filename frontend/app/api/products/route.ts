import { NextResponse } from 'next/server';
import { fetchProductsWithDetails } from '@/actions/fetch-products-with-details';

const LOG_PREFIX = '[frontend/app/api/products/route.ts]';

export const GET = async (request: Request) => {
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1', 10);
  const perPage = parseInt(searchParams.get('perPage') || '30', 30);
  const categories = searchParams.get('categories')?.split(',').filter(category => category.trim() !== '') || [];
  const minPrice = parseFloat(searchParams.get('minPrice') || '0');
  const maxPrice = parseFloat(searchParams.get('maxPrice') || 'Infinity');
  const searchTerm = searchParams.get('searchTerm') || '';

  console.log(`${LOG_PREFIX} Request received for page ${page} with ${perPage} items per page.`);
  console.log(`${LOG_PREFIX} Filters: categories=${categories.join(',')}, minPrice=${minPrice}, maxPrice=${maxPrice}, searchTerm=${searchTerm}`);
  
  try {
    const products = await fetchProductsWithDetails({ page, perPage, categories, minPrice, maxPrice, searchTerm });
    console.log(`${LOG_PREFIX} Successfully fetched products`);
    return NextResponse.json(products, { status: 200 });
  } catch (error) {
    console.error(`${LOG_PREFIX} Failed to fetch products:`, error);
    return NextResponse.json({ error: 'Failed to fetch products' }, { status: 500 });
  }
};