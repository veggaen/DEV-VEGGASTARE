/** Private, bounded HTTP boundary; quote bodies and tokens are never logged. */
import 'server-only';
import { z } from 'zod';
import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { allowSettlementEdit } from '@/lib/auth-rate-limit';
import { CheckoutError } from './showcase-policy';
import { SettlementError } from './settlement-money';
import { checkoutErrorResponse } from './checkout-request';

const privateHeaders = { 'Cache-Control': 'private, no-store', Vary: 'Cookie', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff' };
export function settlementJson(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { ...privateHeaders, ...(status === 429 ? { 'Retry-After': '300' } : {}) } });
}
export async function settlementEditor(request: Request, required = true) {
  if (request.headers.get('origin') !== new URL(request.url).origin) throw new CheckoutError('INVALID_ORIGIN', 403);
  const session = await auth();
  if (session?.user?.isImpersonating) throw new CheckoutError('IMPERSONATION_READ_ONLY', 403);
  if (required && !session?.user?.id) throw new CheckoutError('SIGN_IN_REQUIRED', 401);
  if (!await allowSettlementEdit(session?.user?.id ?? '', request)) throw new CheckoutError('TRY_AGAIN_LATER', 429);
  return session?.user;
}

/** Stream limit works even when Content-Length is absent or dishonest. */
export async function readSettlementJson(request: Request, maxBytes = 20_480): Promise<unknown> {
  if (!request.headers.get('content-type')?.toLowerCase().match(/^application\/json(?:\s*;|$)/)) throw new CheckoutError('JSON_REQUIRED', 415);
  if (request.headers.has('content-encoding') && request.headers.get('content-encoding') !== 'identity') throw new CheckoutError('JSON_REQUIRED', 415);
  const declared = request.headers.get('content-length');
  if (declared !== null && (!/^\d+$/.test(declared) || Number(declared) > maxBytes)) throw new CheckoutError('REQUEST_TOO_LARGE', 413);
  if (!request.body) throw new CheckoutError('INVALID_REQUEST', 400);
  const reader = request.body.getReader(), decoder = new TextDecoder('utf-8', { fatal: true });
  let bytes = 0, text = '', timedOut = false;
  const timeout = setTimeout(() => { timedOut = true; void reader.cancel().catch(() => undefined); }, 10_000);
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (timedOut) throw new CheckoutError('REQUEST_TIMEOUT', 408);
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) throw new CheckoutError('REQUEST_TOO_LARGE', 413);
      text += decoder.decode(value, { stream: true });
    }
    return JSON.parse(text + decoder.decode()) as unknown;
  } catch (error) {
    if (error instanceof CheckoutError) throw error;
    throw new CheckoutError('INVALID_REQUEST', 400);
  } finally { clearTimeout(timeout); await reader.cancel().catch(() => undefined); reader.releaseLock(); }
}

const settlementStatuses: Record<string, number> = {
  INVALID_SETTLEMENT_SELECTION: 400, INVALID_SPEND_AMOUNT: 400, UNSUPPORTED_SETTLEMENT_CURRENCY: 400,
  UNSUPPORTED_CART_ITEM: 400, UNSUPPORTED_CREDIT_SELECTION: 400, CREDIT_SELECTION_REQUIRED: 400,
  SPEND_BELOW_CUSTOM_MINIMUM: 400, SPEND_ABOVE_CUSTOM_MAXIMUM: 400, PURCHASE_AMOUNT_LIMIT: 400,
  INVALID_CART_REVISION: 400, INVALID_SETTLEMENT_TOKEN: 400, EMPTY_CART: 409, SPEND_CURRENCY_CHANGED: 409,
  SETTLEMENT_QUOTE_SCOPE_CHANGED: 409, SETTLEMENT_QUOTE_EXPIRED: 409,
  SETTLEMENT_FX_UNAVAILABLE: 503, SETTLEMENT_PRICING_REVIEW_REQUIRED: 503, CREDIT_SALES_PAUSED: 503,
};
export function settlementErrorResponse(error: unknown) {
  if (error instanceof z.ZodError) return settlementJson({ error: 'INVALID_REQUEST' }, 400);
  if (error instanceof SettlementError) return settlementStatuses[error.code]
    ? settlementJson({ error: error.code }, settlementStatuses[error.code])
    : settlementJson({ error: 'CHECKOUT_TEMPORARILY_UNAVAILABLE' }, 503);
  const response = checkoutErrorResponse(error);
  for (const [key, value] of Object.entries(privateHeaders)) response.headers.set(key, value);
  if (response.status === 429) response.headers.set('Retry-After', '300');
  return response;
}
