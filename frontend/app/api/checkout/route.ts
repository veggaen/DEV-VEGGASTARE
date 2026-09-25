/** @fileOverview Begin server-priced checkout from a signed cart quote or a legacy idempotency key. @stability experimental */
import { z } from 'zod';
import { checkoutUser } from '@/lib/payments/checkout-request';
import { beginShowcaseCheckout } from '@/lib/payments/showcase-store';
import { isDemoUserId } from '@/lib/demo-policy';
import { SubmittedDeliveryConsent } from '@/lib/payments/checkout-agreement';
import { settlementStore } from '@/lib/payments/settlement-runtime';
import { QuoteToken } from '@/lib/payments/settlement-input';
import { readSettlementJson, settlementErrorResponse, settlementJson } from '@/lib/payments/settlement-request';
const Body = z.union([
  z.object({ quoteToken: QuoteToken, consent: SubmittedDeliveryConsent }).strict(),
  z.object({ requestKey: z.string().uuid(), expectedQuote: z.string().max(4096).optional(), consent: SubmittedDeliveryConsent }).strict(),
]);
export async function POST(request: Request) {
  try {
    const user = await checkoutUser(request);
    if (isDemoUserId(user.id)) return settlementJson({ error: 'USE_DEMO_CHECKOUT' }, 403);
    const body = Body.parse(await readSettlementJson(request));
    if ('quoteToken' in body) {
      const attempt = await settlementStore().prepare(user.id!, body.quoteToken, body.consent);
      // Reuse the existing provider creation/recovery path and immutable request ID.
      return settlementJson(await beginShowcaseCheckout(user.id!, attempt.requestKey));
    }
    return settlementJson(await beginShowcaseCheckout(user.id!, body.requestKey, body.expectedQuote, body.consent));
  } catch (error) { return settlementErrorResponse(error); }
}
