/** @fileOverview Default loading shell; public legal text does not wait for hydration. @stability stable */
import { headers } from 'next/headers';
import { RouteSkeleton } from '@/components/ui/route-skeleton';
import TermsPage from './terms/page';
import MarketplaceOffers from '@/components/uicustom/products/MarketplaceOffers';

export default async function Loading() {
  // This server-owned marker is overwritten by Proxy for every request. Only
  // static public text is rendered here; authorization remains in each route.
  const publication = (await headers()).get('x-veggat-publication');
  if (publication === 'sales-terms') return <TermsPage />;
  if (publication === 'marketplace-deals' || publication === 'marketplace-members') {
    // Static public information only. Avoid mounting the catalog's fetching
    // providers twice while this outer streaming fallback is replaced.
    return <div data-app-scroll-container="true" className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
      <MarketplaceOffers kind={publication === 'marketplace-deals' ? 'deals' : 'members'} />
    </div>;
  }
  return <RouteSkeleton />;
}
