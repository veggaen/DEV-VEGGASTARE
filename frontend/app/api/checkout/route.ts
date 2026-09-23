/** @fileOverview Begin a server-priced checkout; the browser supplies only an idempotency key. @stability experimental */
import { z } from 'zod';
import { NextResponse } from 'next/server';
import { checkoutUser, checkoutErrorResponse } from '@/lib/payments/checkout-request';
import { beginShowcaseCheckout } from '@/lib/payments/showcase-store';
import { isDemoUserId } from '@/lib/demo-policy';
export async function POST(request: Request) {
  try {
    const user = await checkoutUser(request);
    if (isDemoUserId(user.id)) return NextResponse.json({ error: 'USE_DEMO_CHECKOUT' }, { status: 403 });
    const parsed = z.object({ requestKey: z.string().uuid(), expectedQuote: z.string().max(4096).optional() }).strict().safeParse(await request.json());
    if (!parsed.success) return NextResponse.json({ error: 'INVALID_REQUEST' }, { status: 400 });
    return NextResponse.json(await beginShowcaseCheckout(user.id!, parsed.data.requestKey, parsed.data.expectedQuote));
  } catch (error) { return checkoutErrorResponse(error); }
}
