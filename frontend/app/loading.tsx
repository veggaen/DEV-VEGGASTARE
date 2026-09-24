/** @fileOverview Default loading shell; public legal text does not wait for hydration. @stability stable */
import { headers } from 'next/headers';
import { RouteSkeleton } from '@/components/ui/route-skeleton';
import TermsPage from './terms/page';

export default async function Loading() {
  // This server-owned marker is overwritten by Proxy for every request. Only
  // static public text is rendered here; authorization remains in each route.
  const publication = (await headers()).get('x-veggat-publication');
  return publication === 'sales-terms' ? <TermsPage /> : <RouteSkeleton />;
}
