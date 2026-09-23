/** @fileOverview Authenticated, same-origin, durable-limited checkout mutations. @stability experimental */
import { auth } from '@/auth';
import { allowAuthAttempt } from '@/lib/auth-rate-limit';
import { CheckoutError } from './showcase-policy';
import { NextResponse } from 'next/server';

export async function checkoutUser(request: Request) {
  if (request.headers.get('origin') !== new URL(request.url).origin) throw new CheckoutError('INVALID_ORIGIN', 403);
  const session = await auth();
  if (!session?.user?.id) throw new CheckoutError('SIGN_IN_REQUIRED', 401);
  if (!await allowAuthAttempt('checkout', session.user.id, request)) throw new CheckoutError('TRY_AGAIN_LATER', 429);
  return session.user;
}
export function checkoutErrorResponse(error: unknown) {
  return NextResponse.json({ error: error instanceof CheckoutError ? error.code : 'CHECKOUT_TEMPORARILY_UNAVAILABLE' },
    { status: error instanceof CheckoutError ? error.status : 503 });
}
