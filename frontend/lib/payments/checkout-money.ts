/** @fileOverview Read original checkout money without repricing historical purchases or mistaking exposure for cash. */
import { z } from 'zod';
import { SHOWCASE_PRODUCTS } from '@/lib/showcase-catalog';
import { CheckoutError, type ShowcaseQuote } from './showcase-policy';
import { MinorUnits, SettlementError, type SettlementMoney } from './settlement-money';
import { readStoredSettlementQuote } from './settlement-quote';
import { verifySettlementCapture } from './settlement-paypal-proof';

export type StoredCheckoutPricing = {
  quote: unknown; totalOre: number; currency?: string | null; totalMinor?: number | null;
  settlementQuoteId?: string | null; refundedMinor?: number | null; refundedOre?: number;
};
const LegacyQuote = z.object({ currency: z.literal('NOK'), totalOre: MinorUnits,
  lines: z.array(z.object({ productId: z.string().min(1), title: z.string().min(1), quantity: z.literal(1),
    amountOre: MinorUnits, credits: z.number().int().min(0).max(10000), kind: z.enum(['AI_CREDITS', 'DIGITAL_FILES']),
  }).passthrough()).min(1).max(2),
}).passthrough();

/** Frozen server data only. Current catalog prices, FX, policy expiry or an
 * untrusted browser quote must never be used to reconstruct a paid amount. */
export function checkoutMoney(attempt: StoredCheckoutPricing) {
  const container = z.object({ settlement: z.unknown().optional() }).safeParse(attempt.quote);
  const hasExact = container.success && container.data.settlement !== undefined;
  if (hasExact || attempt.settlementQuoteId != null || attempt.totalMinor != null || attempt.refundedMinor != null) {
    const quote = readStoredSettlementQuote(container.success ? container.data.settlement : undefined);
    if (!z.string().uuid().safeParse(attempt.settlementQuoteId).success || attempt.currency !== quote.currency ||
        attempt.totalMinor !== quote.totalMinor || attempt.totalOre !== quote.exposureNokOre ||
        !MinorUnits.safeParse(attempt.refundedMinor).success || attempt.refundedMinor! > quote.totalMinor ||
        (attempt.refundedOre ?? 0) !== 0) throw new CheckoutError('INVALID_STORED_QUOTE', 503);
    return { version: 'exact' as const, quote, money: { currency: quote.currency, minor: quote.totalMinor } satisfies SettlementMoney,
      refundedMinor: attempt.refundedMinor!, lines: quote.lines };
  }
  const parsed = LegacyQuote.safeParse(attempt.quote);
  if (!parsed.success) throw new CheckoutError('INVALID_STORED_QUOTE', 503);
  const quote = parsed.data;
  if ((attempt.currency != null && attempt.currency !== 'NOK') || quote.totalOre !== attempt.totalOre || quote.totalOre <= 0 ||
      quote.lines.reduce((sum, line) => sum + line.amountOre, 0) !== quote.totalOre ||
      !MinorUnits.safeParse(attempt.refundedOre ?? 0).success || (attempt.refundedOre ?? 0) > quote.totalOre ||
      new Set(quote.lines.map(line => line.productId)).size !== quote.lines.length || quote.lines.some(line => {
        const sku = Object.values(SHOWCASE_PRODUCTS).find(item => item.id === line.productId);
        return !sku || sku.kind !== line.kind || line.amountOre <= 0 || (line.kind === 'AI_CREDITS' ? line.credits <= 0 : line.credits !== 0);
      })) throw new CheckoutError('INVALID_STORED_QUOTE', 503);
  return { version: 'legacy' as const, quote: quote as ShowcaseQuote, money: { currency: 'NOK' as const, minor: quote.totalOre },
    refundedMinor: attempt.refundedOre ?? 0, lines: quote.lines.map(line => ({ ...line, amountMinor: line.amountOre })) };
}

export function checkoutPaymentBinding(attempt: StoredCheckoutPricing & { orderId: string; paypalOrderId: string | null; merchantId: string | null }) {
  if (!attempt.paypalOrderId || !attempt.merchantId) throw new CheckoutError('PAYMENT_NOT_READY', 409);
  return { orderId: attempt.orderId, paypalOrderId: attempt.paypalOrderId, merchantId: attempt.merchantId, money: checkoutMoney(attempt).money };
}
export function verifyCheckoutCapture(input: unknown, attempt: Parameters<typeof checkoutPaymentBinding>[0]) {
  const binding = checkoutPaymentBinding(attempt);
  try { return verifySettlementCapture(input, binding); }
  catch (error) {
    if (error instanceof SettlementError) throw new CheckoutError(error.code,
      ['PAYMENT_NOT_COMPLETED', 'PAYMENT_BINDING_MISMATCH'].includes(error.code) ? 409 : 502);
    throw error;
  }
}

/** The paid quote must describe exactly the order being fulfilled. Joined
 * order lines cannot smuggle another private file into a verified purchase. */
export function assertCheckoutOrder(attempt: StoredCheckoutPricing & { userId: string; Order: {
  userId: string; totalAmount: number; currency: string | null;
  OrderItem: readonly { productId: string; quantity: number; title: string; priceAtTime: number }[];
} }) {
  const pricing = checkoutMoney(attempt), order = attempt.Order;
  if (order.userId !== attempt.userId || order.currency !== pricing.money.currency ||
      order.totalAmount !== pricing.money.minor / 100 || order.OrderItem.length !== pricing.lines.length ||
      new Set(order.OrderItem.map(item => item.productId)).size !== order.OrderItem.length || order.OrderItem.some(item => {
        const line = pricing.lines.find(line => line.productId === item.productId);
        return !line || item.quantity !== line.quantity || item.priceAtTime !== line.amountMinor / 100 || item.title !== line.title;
      })) throw new CheckoutError('ORDER_QUOTE_MISMATCH', 409);
  return pricing;
}

const CartLines = z.array(z.object({ id: z.string().min(1), productId: z.string().min(1), updatedAt: z.string().datetime(),
  creditAmount: z.number().int().nullable(), creditSpendMinor: MinorUnits.nullable(), creditSpendCurrency: z.string().nullable(),
})).min(1).max(2);
/** Remove only the purchased revision, never a changed/re-added next cart. */
export function purchasedCartFilters(attempt: StoredCheckoutPricing, cartId: string) {
  const pricing = checkoutMoney(attempt);
  if (pricing.version === 'legacy') return pricing.lines.map(line => ({ cartId, productId: line.productId, quantity: line.quantity,
    creditSpendMinor: null, creditSpendCurrency: null,
    ...(line.credits ? { OR: [{ creditAmount: line.credits }, ...(line.credits === 100 ? [{ creditAmount: null }] : [])] } : {}),
  }));
  const parsed = CartLines.safeParse((attempt.quote as { cartLines?: unknown }).cartLines);
  if (!parsed.success || parsed.data.length !== pricing.lines.length || new Set(parsed.data.map(line => line.id)).size !== parsed.data.length ||
      new Set(parsed.data.map(line => line.productId)).size !== parsed.data.length ||
      parsed.data.some(line => !pricing.lines.some(purchased => purchased.productId === line.productId) ||
        (line.creditSpendMinor == null) !== (line.creditSpendCurrency == null))) throw new CheckoutError('INVALID_STORED_QUOTE', 503);
  return parsed.data.map(line => ({ ...line, updatedAt: new Date(line.updatedAt), cartId, quantity: 1 }));
}
