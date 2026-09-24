/** @fileOverview Render public product cards in the first response, before hydration. @stability stable */
import { getInitialCatalog } from '@/lib/initial-catalog';
import CatalogClient from './CatalogClient';

// Listing visibility/availability must be read at request time, never frozen at
// build time. This adds no shared cache and never reads a user's private data.
export const dynamic = 'force-dynamic';

export default async function ProductsPage() {
  return <CatalogClient initialCatalog={await getInitialCatalog()} />;
}
