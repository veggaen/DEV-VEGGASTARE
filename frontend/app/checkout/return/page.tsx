/** @fileOverview Validate the return reference without treating it as payment proof. @stability experimental */
import Link from 'next/link';
import PaymentVerification from '@/components/checkout/payment-verification';
export default async function CheckoutReturn({ searchParams }: { searchParams: Promise<{ orderId?: string | string[] }> }) {
  const { orderId } = await searchParams;
  if (typeof orderId !== 'string' || !orderId || orderId.length > 100) {
    return <section className="mx-auto max-w-xl px-4 py-12"><h1 className="text-2xl font-semibold">Missing order reference</h1><Link href="/cart" className="mt-6 inline-flex min-h-11 items-center underline">Return to cart</Link></section>;
  }
  return <PaymentVerification orderId={orderId} />;
}
