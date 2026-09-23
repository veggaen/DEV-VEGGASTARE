/** @fileOverview Authoritative NOK quotes and strict PayPal capture validation. @stability experimental */
import { z } from 'zod';
import { SHOWCASE_PRODUCTS } from '@/lib/showcase-catalog';
import { DEFAULT_PURCHASE_CREDITS, MIN_PURCHASE_CREDITS, MAX_PURCHASE_CREDITS, quoteCreditPurchase } from '@/lib/ai-credit-purchase';

export class CheckoutError extends Error {
  constructor(public code: string, public status = 400) { super(code); }
}

export function paypalEnvironment(env: Record<string, string | undefined> = process.env) {
  // A local `next start` is NODE_ENV=production, but must NEVER use Live.
  const live = env.VERCEL === '1' && env.VERCEL_ENV === 'production';
  return {
    mode: live ? 'LIVE' as const : 'SANDBOX' as const,
    apiOrigin: live ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com',
    approvalHost: live ? 'www.paypal.com' : 'www.sandbox.paypal.com',
  };
}

const CartInput = z.array(z.object({ productId: z.string(), quantity: z.number().int().min(1).max(1),
  creditAmount: z.number().int().min(MIN_PURCHASE_CREDITS).max(MAX_PURCHASE_CREDITS).nullish() })).min(1).max(2);
export function quoteShowcaseCart(input: unknown) {
  const parsed = CartInput.safeParse(input);
  if (!parsed.success) throw new CheckoutError('ONE_OF_EACH_REVIEWER_ITEM_PER_ORDER');
  const seen = new Set<string>();
  const lines = parsed.data.map(item => {
    const sku = Object.values(SHOWCASE_PRODUCTS).find(sku => sku.id === item.productId);
    if (!sku || seen.has(sku.id)) throw new CheckoutError('UNSUPPORTED_CART_ITEM');
    seen.add(sku.id);
    if (sku.kind !== 'AI_CREDITS' && item.creditAmount != null) throw new CheckoutError('UNSUPPORTED_CREDIT_AMOUNT');
    const creditQuote = sku.kind === 'AI_CREDITS' ? quoteCreditPurchase(item.creditAmount ?? DEFAULT_PURCHASE_CREDITS) : null;
    if (creditQuote) return { productId: sku.id, title: `${sku.title} · ${creditQuote.credits} credits`, quantity: 1,
      amountOre: creditQuote.amountOre, kind: sku.kind, credits: creditQuote.credits,
      discountOre: creditQuote.discountOre, pricingVersion: creditQuote.pricingVersion };
    return { productId: sku.id, title: sku.title, quantity: 1, amountOre: sku.amountOre, kind: sku.kind,
      credits: 'credits' in sku ? sku.credits : 0 };
  }).sort((a, b) => a.productId.localeCompare(b.productId));
  return { currency: 'NOK' as const, totalOre: lines.reduce((sum, line) => sum + line.amountOre, 0), lines };
}
export type ShowcaseQuote = ReturnType<typeof quoteShowcaseCart>;

export function moneyString(ore: number) {
  if (!Number.isSafeInteger(ore) || ore < 0) throw new CheckoutError('INVALID_AMOUNT');
  return `${Math.floor(ore / 100)}.${String(ore % 100).padStart(2, '0')}`;
}
export function parseNokOre(value: string) {
  if (!/^(0|[1-9]\d{0,7})\.\d{2}$/.test(value)) throw new CheckoutError('INVALID_PROVIDER_AMOUNT', 502);
  const [whole, fraction] = value.split('.');
  return Number(whole) * 100 + Number(fraction);
}

const ProviderAmount = z.object({ currency_code: z.literal('NOK'), value: z.string() });
const Capture = z.object({ id: z.string().regex(/^[A-Z0-9]{1,36}$/), status: z.literal('COMPLETED'),
  final_capture: z.literal(true), amount: ProviderAmount });
const CapturedOrder = z.object({ id: z.string(), status: z.literal('COMPLETED'), purchase_units: z.array(z.object({
  reference_id: z.string(), invoice_id: z.string(), custom_id: z.string(), amount: ProviderAmount,
  payee: z.object({ merchant_id: z.string().min(1) }), payments: z.object({ captures: z.array(Capture).length(1) }),
})).length(1) });

/** Input MUST come from an authenticated server-to-server PayPal GET/capture,
 * never from a return URL, browser JSON or an unverified webhook payload. */
export function verifyCapturedOrder(input: unknown, expected: {
  paypalOrderId: string; orderId: string; totalOre: number; merchantId: string;
}) {
  const parsed = CapturedOrder.safeParse(input);
  if (!parsed.success) throw new CheckoutError('PAYMENT_NOT_COMPLETED', 409);
  const order = parsed.data, unit = order.purchase_units[0], capture = unit.payments.captures[0];
  if (order.id !== expected.paypalOrderId || unit.reference_id !== expected.orderId ||
      unit.invoice_id !== expected.orderId || unit.custom_id !== expected.orderId ||
      unit.payee.merchant_id !== expected.merchantId ||
      parseNokOre(unit.amount.value) !== expected.totalOre || parseNokOre(capture.amount.value) !== expected.totalOre) {
    throw new CheckoutError('PAYMENT_BINDING_MISMATCH', 409);
  }
  return { captureId: capture.id, totalOre: expected.totalOre, currency: 'NOK' as const };
}

export function validateApprovalUrl(value: string, environment = paypalEnvironment()) {
  const url = new URL(value);
  if (url.protocol !== 'https:' || url.hostname !== environment.approvalHost || url.username || url.password || url.port) {
    throw new CheckoutError('INVALID_APPROVAL_URL', 502);
  }
  return url.toString();
}
