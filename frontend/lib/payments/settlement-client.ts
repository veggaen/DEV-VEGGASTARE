/** Client transport/validation only. Prices and grants are always decided by the server. */
import { CreditIntent } from './settlement-input';
import { parseSpendMinor } from './settlement-money';
import { readStoredSettlementQuote, type SettlementQuote } from './settlement-quote';
import { SHOWCASE_PRODUCTS } from '@/lib/showcase-catalog';

export type CreditChoice = { intent: CreditIntent; quote: SettlementQuote };
export class SettlementClientError extends Error {}
export function settlementFailureMessage(error: unknown) {
  return error instanceof SettlementClientError ? error.message : 'Could not confirm this price. Retry before continuing.';
}
const messages: Record<string, string> = {
  SPEND_BELOW_CUSTOM_MINIMUM: 'Enter an amount for at least 100 credits, or choose the 10-credit starter.',
  SPEND_ABOVE_CUSTOM_MAXIMUM: 'This amount exceeds 10,000 credits. Enter a smaller amount.',
  INVALID_SPEND_AMOUNT: 'Enter an amount with up to two decimal places.',
  SETTLEMENT_FX_UNAVAILABLE: 'Exchange rates are unavailable. Retry shortly.',
  SPEND_CURRENCY_CHANGED: 'Your saved amount uses another currency. Enter an amount in the selected currency.',
  CART_CHANGED: 'Your basket changed in another tab. Refresh it before editing.',
  SETTLEMENT_QUOTE_EXPIRED: 'This price expired. Refresh the price before continuing.',
  SETTLEMENT_QUOTE_SCOPE_CHANGED: 'Your basket changed. Refresh the price and review it again.',
  TRY_AGAIN_LATER: 'Too many updates. Wait a few minutes, then retry.',
  SIGN_IN_REQUIRED: 'Sign in again to update your saved basket.',
  CREDIT_SALES_PAUSED: 'Credit sales are paused while pricing is reviewed.',
  SETTLEMENT_PRICING_REVIEW_REQUIRED: 'Credit sales are paused while pricing is reviewed.',
  EMPTY_CART: 'Your basket is empty.',
};
export function settlementMessage(code: unknown) {
  return typeof code === 'string' && messages[code] || 'Could not confirm this price. Retry before continuing.';
}
export async function settlementRequest(path: string, body: unknown, signal?: AbortSignal, method = 'POST') {
  try {
    const response = await fetch(path, { method, headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body), cache: 'no-store', signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(15_000)]) : AbortSignal.timeout(15_000) });
    const result = await response.json();
    if (!response.ok) throw new SettlementClientError(settlementMessage(response.status === 429 ? 'TRY_AGAIN_LATER' : result?.error));
    return result;
  } catch (error) { throw new SettlementClientError(settlementFailureMessage(error)); }
}
export function readCreditPreview(input: unknown, intent: CreditIntent, now = Date.now()): CreditChoice {
  const quote = readStoredSettlementQuote(input);
  if (quote.currency !== intent.currency || Date.parse(quote.expiresAt) <= now || quote.lines.length !== 1) throw new Error('Price changed. Refresh it before continuing.');
  const line = quote.lines[0];
  if (line.productId !== SHOWCASE_PRODUCTS.credits.id || line.kind !== 'AI_CREDITS' ||
      line.selection !== intent.type || (intent.type === 'spend' ? quote.totalMinor !== parseSpendMinor(intent.amount) : line.credits !== intent.credits)) {
    throw new Error('Price changed. Refresh it before continuing.');
  }
  return { intent, quote };
}
export async function previewCreditIntent(intent: CreditIntent, signal: AbortSignal) {
  const { currency, type } = intent;
  const result = await settlementRequest('/api/checkout/estimate', { currency,
    items: [{ productId: SHOWCASE_PRODUCTS.credits.id, quantity: 1, credits: type === 'spend'
      ? { type, amount: intent.amount } : { type, credits: intent.credits } }] }, signal);
  return readCreditPreview(result.quote, intent);
}
