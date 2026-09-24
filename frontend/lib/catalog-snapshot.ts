/** @fileOverview Shared first-page contract for server rendering and interactive filters. @stability stable */
import type { ProductsListItem } from '@/lib/types/products';

export const DEFAULT_CATALOG_PAGE_SIZE = 30;
export interface CatalogSnapshot {
  query: string;
  perPage: number;
  products: ProductsListItem[];
}
