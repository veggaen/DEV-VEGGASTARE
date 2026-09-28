/** @fileOverview Fresh, bounded public catalog data; failures retain the client's retry path. @stability stable */
import 'server-only';
import { fetchProductsWithDetails } from '@/actions/fetch-products-with-details';
import { ProductsListResponseSchema } from '@/lib/types/products';
import { DEFAULT_CATALOG_PAGE_SIZE, type CatalogSnapshot } from './catalog-snapshot';

export async function getInitialCatalog(): Promise<CatalogSnapshot | null> {
  try {
    const products = ProductsListResponseSchema.parse(await fetchProductsWithDetails({
      page: 1, perPage: DEFAULT_CATALOG_PAGE_SIZE, categories: [], minPrice: 0, searchTerm: '',
    }));
    return { query: '', perPage: DEFAULT_CATALOG_PAGE_SIZE, products };
  } catch {
    // Do not serialize a database/provider error into the page or cache an empty
    // catalog on failure. The existing browser request has a bounded retry UI.
    return null;
  }
}
