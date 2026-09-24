/** @fileOverview Versioned, server-owned delivery requests and retainable purchase records. @stability experimental */
import { z } from 'zod';
import { CheckoutError, moneyString, type ShowcaseQuote } from './showcase-policy';

export const CHECKOUT_AGREEMENT_VERSION = '2026-09-24.1';
export const DELIVERY_REQUESTS = {
  files: 'I request immediate delivery of the digital files before the 14-day withdrawal period ends. I acknowledge losing the withdrawal right when delivery starts, subject to the legally required confirmation. Defect and payment-dispute rights remain.',
  credits: 'I request that AI usage starts before the 14-day withdrawal period ends. I acknowledge losing the withdrawal right only after the service is fully performed, subject to legal requirements. Unused credits and defects remain reviewable.',
} as const;

// Retained with the order, not reconstructed from whichever terms happen to be
// published later. No client-supplied policy text or acceptance timestamp.
export const DIGITAL_PURCHASE_RECORD = `Veggat Studio digital purchase terms — ${CHECKOUT_AGREEMENT_VERSION}
Seller: THORSEN SOFTWARE, organisation number 937 051 107.
Address: Blåskjellveien 5B, 4310 Hommersåk, Norway.
Contact: kontakt@veggat.com; +47 984 207 21.
These reviewer listings are test/showcase products: one original JPG and a TXT interview guide, and/or the specified number of prepaid AI usage credits. No physical delivery, subscription or automatic top-up.
PayPal payments are charged in NOK. Displayed fiat and crypto conversions are estimates, not an exchange-rate guarantee. Any applicable taxes are included in the confirmed total. Sandbox uses test money; a demo order is free and does not buy credits.
Files and purchased credits are released only after server-verified payment. Private file links require the purchasing account, expire after 24 hours and allow at most 10 requests per file. Contact the seller if access fails. A link expiring does not remove statutory rights.
AI messages have a fixed credit price shown before sending. The server reserves that price before contacting the provider, enforces usage limits and returns the reservation on provider failure. A successful message spends that credit price, not a claim on an exact number of provider tokens. AI output may be inaccurate. Model availability may change; contact the seller about unused purchased credits if the service cannot be provided.
Consumers generally have 14 days from the digital agreement to request withdrawal. Immediate digital-file delivery requires prior express consent, acknowledgment of loss of withdrawal rights and the legally required agreement/consent confirmation. Downloading once alone is not a blanket waiver. Starting AI usage is not the same as fully performing the service; any lawful proportionate charge or loss of withdrawal rights requires its own conditions.
Defective, missing or misdescribed content, mandatory consumer rights and PayPal/card disputes remain reviewable. Contact the seller or use My orders to request help or withdrawal. A request being approved is not proof that money was returned; only a verified payment-provider refund is a refund.
A verified refund or reversal revokes future access and the purchased credit grant; it cannot erase files already saved. Where refunded credits were already used, an account adjustment can offset future credit purchases and is disclosed before payment. Veggat does not automatically charge a card to collect that adjustment.
To withdraw, send to kontakt@veggat.com: "I withdraw from my agreement for [items], ordered on [date], order [id]. My name and address: [...]. Date: [...]." This template is optional; any unambiguous notice can be used. Keep a copy. Complaints can also be referred to Forbrukertilsynet/Forbrukerklageutvalget as applicable; see https://www.forbrukertilsynet.no/.
The complete published terms at checkout are linked at /terms. This retained purchase record does not restrict mandatory law. Consent recording and this downloadable copy do not, by themselves, prove that every legal requirement for loss of withdrawal rights has been met. Veggat does not automatically deny a refund because a file was downloaded.`;

export const DeliveryConsentInput = z.object({
  version: z.literal(CHECKOUT_AGREEMENT_VERSION),
  files: z.boolean(),
  credits: z.boolean(),
}).strict();
export type DeliveryConsent = z.infer<typeof DeliveryConsentInput>;

export function recordCheckoutAgreement(quote: ShowcaseQuote, input: unknown, demo: boolean, now = new Date()) {
  // Demo has no paid agreement; never manufacture the visitor's consent.
  if (demo) return { version: CHECKOUT_AGREEMENT_VERSION, recordedAt: now.toISOString(), demo: true,
    requests: [], purchaseTerms: DIGITAL_PURCHASE_RECORD };
  const parsed = DeliveryConsentInput.safeParse(input);
  const files = quote.lines.some(line => line.kind === 'DIGITAL_FILES');
  const credits = quote.lines.some(line => line.kind === 'AI_CREDITS');
  if (!parsed.success || parsed.data.files !== files || parsed.data.credits !== credits) {
    throw new CheckoutError('DELIVERY_CONSENT_REQUIRED', 400);
  }
  return { version: CHECKOUT_AGREEMENT_VERSION, recordedAt: now.toISOString(), demo: false,
    requests: [...(files ? [DELIVERY_REQUESTS.files] : []), ...(credits ? [DELIVERY_REQUESTS.credits] : [])],
    purchaseTerms: DIGITAL_PURCHASE_RECORD };
}

const StoredAgreement = z.object({ version: z.string().min(1).max(80), recordedAt: z.string().datetime(),
  demo: z.boolean(), requests: z.array(z.string().max(2000)).max(2), purchaseTerms: z.string().min(1).max(20000) });
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

${agreement.purchaseTerms}

Keep this file for your records. It contains no private download tokens.
This is the original confirmation; subsequent refunds and current access are shown in My orders, not by altering this file.
`;
}
