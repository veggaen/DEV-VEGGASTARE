/** @fileOverview Versioned, server-owned delivery requests and retainable purchase records. @stability experimental */
import { z } from 'zod';
import { CheckoutError, moneyString, type ShowcaseQuote } from './showcase-policy';
import { SALES_TERMS_TEXT } from '@/lib/legal/sales-terms';
import { SALES_TERMS_VERSION } from '@/lib/legal/sales-terms-version';

export { CHECKOUT_AGREEMENT_VERSION, DELIVERY_REQUESTS, DIGITAL_PURCHASE_RECORD } from './checkout-delivery-policy';
import { CHECKOUT_AGREEMENT_VERSION, DELIVERY_REQUESTS, DIGITAL_PURCHASE_RECORD } from './checkout-delivery-policy';

export const DeliveryConsentInput = z.object({
  version: z.literal(CHECKOUT_AGREEMENT_VERSION),
  files: z.boolean(),
  credits: z.boolean(),
}).strict();
export type DeliveryConsent = z.infer<typeof DeliveryConsentInput>;

export function recordCheckoutAgreement(quote: ShowcaseQuote, input: unknown, demo: boolean, now = new Date()) {
  const publishedTerms = { version: SALES_TERMS_VERSION, language: 'nb' as const, text: SALES_TERMS_TEXT };
  // Demo has no paid agreement; never manufacture the visitor's consent.
  if (demo) return { version: CHECKOUT_AGREEMENT_VERSION, recordedAt: now.toISOString(), demo: true,
    requests: [], purchaseTerms: DIGITAL_PURCHASE_RECORD, publishedTerms };
  const parsed = DeliveryConsentInput.safeParse(input);
  const files = quote.lines.some(line => line.kind === 'DIGITAL_FILES');
  const credits = quote.lines.some(line => line.kind === 'AI_CREDITS');
  if (!parsed.success || parsed.data.files !== files || parsed.data.credits !== credits) {
    throw new CheckoutError('DELIVERY_CONSENT_REQUIRED', 400);
  }
  return { version: CHECKOUT_AGREEMENT_VERSION, recordedAt: now.toISOString(), demo: false,
    requests: [...(files ? [DELIVERY_REQUESTS.files] : []), ...(credits ? [DELIVERY_REQUESTS.credits] : [])],
    purchaseTerms: DIGITAL_PURCHASE_RECORD, publishedTerms };
}

const StoredAgreement = z.object({ version: z.string().min(1).max(80), recordedAt: z.string().datetime(),
  demo: z.boolean(), requests: z.array(z.string().max(2000)).max(2), purchaseTerms: z.string().min(1).max(20000),
  // Optional only for historical records. Never backfill current wording.
  publishedTerms: z.object({ version: z.string().min(1).max(80), language: z.literal('nb'), text: z.string().min(1).max(40000) }).optional() });
export function storedCheckoutAgreement(quote: unknown) {
  const container = z.object({ agreement: StoredAgreement }).safeParse(quote);
  return container.success ? container.data.agreement : null;
}

/** Original confirmation stays identical after refund or a future terms change.
 * It is a purchase record, NOT a fresh grant, tax invoice or refund certificate. */
export function purchaseConfirmation(attempt: {
  orderId: string; userId: string; quote: unknown; totalOre: number; environment: string;
  captureId: string | null; completedAt: Date | null;
}) {
  const agreement = storedCheckoutAgreement(attempt.quote);
  if (!agreement || !attempt.completedAt || (!attempt.captureId && attempt.environment !== 'DEMO')) return null;
  const quote = attempt.quote as ShowcaseQuote;
  const lines = quote.lines.map(line => `${line.title} × ${line.quantity}: ${moneyString(line.amountOre)} NOK`).join('\n');
  return `VEGGAT — ORIGINAL ORDER CONFIRMATION\n
Order: ${attempt.orderId}
Purchasing account: ${attempt.userId}
Payment environment: ${attempt.environment}${attempt.environment === 'LIVE' ? ' — real payment' : ' — no real money'}
Confirmed at (UTC): ${attempt.completedAt.toISOString()}
Receipt: ${attempt.captureId ?? 'Demo — no payment collected'}
${lines}
${attempt.environment === 'DEMO' ? 'Catalog value' : 'Confirmed total'}: ${moneyString(attempt.totalOre)} NOK
${attempt.environment === 'DEMO' ? 'Actually charged: 0.00 NOK. No purchased AI credits were granted.\n' : ''}
Delivery request record (${agreement.version}), recorded at (UTC): ${agreement.recordedAt}
${agreement.demo ? 'Free demo; no paid delivery consent was collected.' : agreement.requests.join('\n\n')}

${agreement.purchaseTerms}${agreement.publishedTerms ? `\n\n${agreement.publishedTerms.text}` : ''}

Keep this file for your records. It contains no private download tokens.
This is the original confirmation; subsequent refunds and current access are shown in My orders, not by altering this file.
`;
}
