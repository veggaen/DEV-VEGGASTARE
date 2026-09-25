/** @fileOverview Short-lived, actor/cart/environment-bound quote attestations; not payment or fulfillment proof. @stability experimental */
import 'server-only';
import { createHash, createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { z } from 'zod';
import { MinorUnits, SettlementCurrency, SettlementError } from './settlement-money';
import { assertSettlementQuoteCurrent, readStoredSettlementQuote, type SettlementQuote } from './settlement-quote';

const PREFIX = 'veggat-settlement-quote-v1';
const MAX_TOKEN_BYTES = 16_384;
const Scope = z.object({
  userId: z.string().min(1).max(128), environment: z.enum(['LIVE', 'SANDBOX', 'DEMO']),
  // The future cart integration must hash canonical SERVER-READ items/revision.
  // A browser-generated fingerprint cannot attest the current cart.
  cartFingerprint: z.string().regex(/^[a-f0-9]{64}$/),
}).strict();
export type SettlementQuoteScope = z.infer<typeof Scope>;
const Envelope = z.object({ purpose: z.literal(PREFIX), quoteId: z.string().uuid(), scope: Scope, quote: z.unknown() }).strict();
const CartSnapshot = z.object({
  id: z.string().min(1).max(128), userId: z.string().min(1).max(128), updatedAt: z.date(),
  CartItem: z.array(z.object({
    id: z.string().min(1).max(128), productId: z.string().min(1).max(128), quantity: z.number().int().min(1).max(10000),
    creditAmount: z.number().int().min(1).max(10000).nullable(), updatedAt: z.date(),
    creditSpendMinor: MinorUnits.nullish(), creditSpendCurrency: SettlementCurrency.nullish(),
  })).max(100),
});

/** Call with a fresh server database result, again inside the preparation
 * transaction. Includes line IDs/timestamps so remove/re-add and changed-back
 * edits cannot accidentally reuse a previously accepted cart revision. */
export function settlementCartFingerprint(input: unknown) {
  const parsed = CartSnapshot.safeParse(input);
  if (!parsed.success) throw new SettlementError('INVALID_SETTLEMENT_CART');
  const cart = parsed.data, ids = new Set<string>(), products = new Set<string>();
  const items = cart.CartItem.map(item => {
    if (ids.has(item.id) || products.has(item.productId) ||
        (item.creditSpendMinor == null) !== (item.creditSpendCurrency == null) || item.creditSpendMinor === 0) throw new SettlementError('INVALID_SETTLEMENT_CART');
    ids.add(item.id); products.add(item.productId);
    return { id: item.id, productId: item.productId, quantity: item.quantity, creditAmount: item.creditAmount,
      updatedAt: item.updatedAt.toISOString(), creditSpendMinor: item.creditSpendMinor ?? null, creditSpendCurrency: item.creditSpendCurrency ?? null };
  }).sort((a, b) => a.productId.localeCompare(b.productId));
  return createHash('sha256').update('veggat-settlement-cart-v1\0').update(JSON.stringify({
    id: cart.id, userId: cart.userId, updatedAt: cart.updatedAt.toISOString(), items,
  })).digest('hex');
}

function signingKey(secret: string) {
  if (typeof secret !== 'string' || Buffer.byteLength(secret) < 32) throw new SettlementError('SETTLEMENT_SIGNING_UNAVAILABLE');
  // Purpose separation prevents reuse of an Auth.js token/session signature.
  return createHmac('sha256', secret).update(PREFIX).digest();
}

/** The server's existing sufficiently strong secret is supplied explicitly.
 * No new secret is generated, logged, included in a quote or exposed to clients.
 * An accepted quoteId must become the database-unique checkout request identity;
 * HMAC authenticity by itself does NOT provide replay/idempotency protection. */
export function issueSettlementQuoteToken(quote: SettlementQuote, scope: SettlementQuoteScope, secret: string, now = Date.now()) {
  const envelope = { purpose: PREFIX, quoteId: randomUUID(), scope: Scope.parse(scope), quote: assertSettlementQuoteCurrent(quote, now) };
  const payload = Buffer.from(JSON.stringify(envelope), 'utf8').toString('base64url');
  const signature = createHmac('sha256', signingKey(secret)).update(payload).digest('base64url');
  const token = `${payload}.${signature}`;
  if (Buffer.byteLength(token) > MAX_TOKEN_BYTES) throw new SettlementError('INVALID_SETTLEMENT_TOKEN');
  return { token, quoteId: envelope.quoteId, expiresAt: quote.expiresAt };
}

export function verifySettlementQuoteToken(input: unknown, expectedScope: SettlementQuoteScope, secret: string, now = Date.now()) {
  const key = signingKey(secret), scope = Scope.parse(expectedScope);
  if (typeof input !== 'string' || input.length > MAX_TOKEN_BYTES) throw new SettlementError('INVALID_SETTLEMENT_TOKEN');
  const parts = input.split('.');
  if (parts.length !== 2 || !/^[A-Za-z0-9_-]+$/.test(parts[0]) || !/^[A-Za-z0-9_-]{43}$/.test(parts[1])) throw new SettlementError('INVALID_SETTLEMENT_TOKEN');
  const digest = createHmac('sha256', key).update(parts[0]).digest();
  const provided = Buffer.from(parts[1], 'base64url');
  if (provided.length !== digest.length || !timingSafeEqual(provided, digest) || provided.toString('base64url') !== parts[1]) throw new SettlementError('INVALID_SETTLEMENT_TOKEN');
  let decoded: z.infer<typeof Envelope>;
  try {
    const bytes = Buffer.from(parts[0], 'base64url');
    if (bytes.toString('base64url') !== parts[0]) throw new Error();
    decoded = Envelope.parse(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)));
  } catch { throw new SettlementError('INVALID_SETTLEMENT_TOKEN'); }
  if (decoded.scope.userId !== scope.userId || decoded.scope.environment !== scope.environment ||
      decoded.scope.cartFingerprint !== scope.cartFingerprint) throw new SettlementError('SETTLEMENT_QUOTE_SCOPE_CHANGED');
  const quote = assertSettlementQuoteCurrent(readStoredSettlementQuote(decoded.quote), now);
  return { quoteId: decoded.quoteId, quote, scope: decoded.scope };
}
