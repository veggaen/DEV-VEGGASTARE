/** @fileOverview Keep old receipt links auth-checked and route verified checkout to its canonical receipt. @stability stable */
import { auth } from '@/auth';
import { dbPrisma } from '@/lib/db';
import { notFound, redirect } from 'next/navigation';
import LegacyOrderConfirmation from '@/components/checkout/legacy-order-confirmation';

export default async function OrderConfirmationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect(`/auth/login?callbackUrl=${encodeURIComponent('/order-confirmation/' + id)}`);
  const order = await dbPrisma.order.findUnique({ where: { id }, select: { userId: true, CheckoutAttempt: { select: { orderId: true } } } });
  if (!order || order.userId !== session.user.id) notFound();
  if (order.CheckoutAttempt) redirect('/checkout/receipt/' + encodeURIComponent(id));
  return <LegacyOrderConfirmation />;
}
