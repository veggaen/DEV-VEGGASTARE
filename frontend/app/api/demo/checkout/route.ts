/** @fileOverview Isolated, explicitly unpaid demo checkout. Never contacts a payment provider. @stability experimental */
import { z } from 'zod';
import { NextResponse } from 'next/server';
import { checkoutUser, checkoutErrorResponse } from '@/lib/payments/checkout-request';
import { beginShowcaseCheckout, completeShowcaseCheckout } from '@/lib/payments/showcase-store';
import { isDemoUserId } from '@/lib/demo-policy';
export async function POST(request: Request) {
  try {
    const user = await checkoutUser(request);
    if (!isDemoUserId(user.id)) return NextResponse.json({ error: 'DEMO_SESSION_REQUIRED' }, { status: 403 });
    const parsed = z.object({ requestKey: z.string().uuid() }).strict().safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: 'INVALID_REQUEST' }, { status: 400 });
    const attempt = await beginShowcaseCheckout(user.id, parsed.data.requestKey);
    return NextResponse.json(await completeShowcaseCheckout(attempt.orderId, user.id));
  } catch (error) { return checkoutErrorResponse(error); }
}
