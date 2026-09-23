/** @fileOverview Authenticated capture; URL parameters can never fulfill an order. @stability experimental */
import { z } from 'zod';
import { NextResponse } from 'next/server';
import { checkoutUser, checkoutErrorResponse } from '@/lib/payments/checkout-request';
import { completeShowcaseCheckout } from '@/lib/payments/showcase-store';
import { isDemoUserId } from '@/lib/demo-policy';
export async function POST(request: Request) {
  try {
    const user = await checkoutUser(request);
    if (isDemoUserId(user.id)) return NextResponse.json({ error: 'USE_DEMO_CHECKOUT' }, { status: 403 });
    const parsed = z.object({ orderId: z.string().min(1).max(100) }).strict().safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: 'INVALID_REQUEST' }, { status: 400 });
    return NextResponse.json(await completeShowcaseCheckout(parsed.data.orderId, user.id!));
  } catch (error) { return checkoutErrorResponse(error); }
}
