/** @fileOverview Authenticated same-origin resume/cancel actions for an existing order. @stability stable */
import { z } from 'zod';
import { NextResponse } from 'next/server';
import { checkoutErrorResponse, checkoutUser } from '@/lib/payments/checkout-request';
import { cancelUnpaidCheckout, resumeCheckout } from '@/lib/payments/checkout-recovery';
import { scheduleTransactionEmail } from '@/lib/payments/email-after';
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const user = await checkoutUser(request);
    const parsedId = z.string().regex(/^[a-zA-Z0-9_-]{1,100}$/).safeParse((await context.params).id);
    const input = z.object({ action: z.enum(['resume', 'cancel']) }).strict().safeParse(await request.json().catch(() => null));
    if (!parsedId.success || !input.success) return NextResponse.json({ error: 'INVALID_REQUEST' }, { status: 400 });
    const id = parsedId.data;
    const result = input.data.action === 'resume' ? await resumeCheckout(id, user.id!) : await cancelUnpaidCheckout(id, user.id!);
    if ('nextUrl' in result && result.nextUrl.startsWith('/checkout/receipt/')) scheduleTransactionEmail(`purchase:${id}`);
    return NextResponse.json(result, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return checkoutErrorResponse(error); }
}
