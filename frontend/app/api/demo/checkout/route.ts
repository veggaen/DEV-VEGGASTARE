/** @fileOverview Isolated, explicitly unpaid demo checkout. Never contacts a payment provider. @stability experimental */
import { z } from 'zod';
import { checkoutUser } from '@/lib/payments/checkout-request';
import { beginShowcaseCheckout, completeShowcaseCheckout } from '@/lib/payments/showcase-store';
import { isDemoUserId } from '@/lib/demo-policy';
import { settlementStore } from '@/lib/payments/settlement-runtime';
import { QuoteToken } from '@/lib/payments/settlement-input';
import { readSettlementJson, settlementErrorResponse, settlementJson } from '@/lib/payments/settlement-request';
const Body = z.union([
  z.object({ quoteToken: QuoteToken }).strict(),
  z.object({ requestKey: z.string().uuid(), expectedQuote: z.string().max(4096).optional() }).strict(),
]);
export async function POST(request: Request) {
  try {
    const user = await checkoutUser(request);
    if (!isDemoUserId(user.id)) return settlementJson({ error: 'DEMO_SESSION_REQUIRED' }, 403);
    const body = Body.parse(await readSettlementJson(request));
    const attempt = 'quoteToken' in body ? await settlementStore().prepare(user.id, body.quoteToken)
      : await beginShowcaseCheckout(user.id, body.requestKey, body.expectedQuote);
    return settlementJson(await completeShowcaseCheckout(attempt.orderId, user.id));
  } catch (error) { return settlementErrorResponse(error); }
}
