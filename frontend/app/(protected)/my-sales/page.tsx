/** @fileOverview Personal seller workspace. @stability experimental */
import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { auth } from '@/auth';
import SellerOrdersDashboard from '@/components/checkout/seller-orders-dashboard';
import { SalesOrdersSkeleton } from '@/components/checkout/seller-orders-skeleton';

export const metadata = { title: 'My sales' };
export default async function MySalesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect('/auth/login?callbackUrl=%2Fmy-sales');
  return <Suspense fallback={<div className="mx-auto w-full max-w-6xl p-4 sm:p-6 lg:p-8"><SalesOrdersSkeleton /></div>}><SellerOrdersDashboard /></Suspense>;
}
