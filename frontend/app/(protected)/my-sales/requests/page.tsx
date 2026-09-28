/** @fileOverview Seller review workspace, separate from payment execution. @stability experimental */
import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import SellerRequestInbox, { RequestInboxSkeleton } from '@/components/checkout/seller-request-inbox';

export const metadata = { title: 'Purchase requests' };

export default async function SellerRequestsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/auth/login?callbackUrl=%2Fmy-sales%2Frequests');
  return <Suspense fallback={<div className="mx-auto w-full max-w-6xl p-4 sm:p-6 lg:p-8"><RequestInboxSkeleton /></div>}><SellerRequestInbox /></Suspense>;
}
