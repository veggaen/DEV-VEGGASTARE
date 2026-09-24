/** @fileOverview Private, retainable original order record; never grants files or credits. @stability experimental */
import { auth } from '@/auth';
import { dbPrisma } from '@/lib/db';
import { allowAuthAttempt } from '@/lib/auth-rate-limit';
import { purchaseConfirmation } from '@/lib/payments/checkout-agreement';

const headers = { 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff',
  'Content-Type': 'text/plain; charset=utf-8', 'Referrer-Policy': 'no-referrer' };
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const userId = (await auth())?.user?.id;
    if (!userId) return new Response('Sign in to download your order confirmation.', { status: 401, headers });
    const { id } = await params;
    if (!/^[a-zA-Z0-9_-]{1,100}$/.test(id)) return new Response('Order not found.', { status: 404, headers });
    if (!await allowAuthAttempt('order-confirmation-read', userId, request)) {
      return new Response('Please wait a few minutes before downloading again.', { status: 429, headers });
    }
    const attempt = await dbPrisma.checkoutAttempt.findFirst({ where: { orderId: id, userId } });
    if (!attempt) return new Response('Order not found.', { status: 404, headers });
    const confirmation = purchaseConfirmation(attempt);
    if (!confirmation) return new Response('No original delivery-consent record is available for this order. Your receipt remains in My orders.', { status: 404, headers });
    return new Response(confirmation, { headers: { ...headers,
      'Content-Disposition': `attachment; filename="veggat-order-${id}.txt"` } });
  } catch {
    return new Response('Your confirmation is temporarily unavailable. Please try again.', { status: 503, headers });
  }
}
