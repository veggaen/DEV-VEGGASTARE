/** @fileOverview A quote is bound to actor, cart and environment; never confused with paid proof. */
import { describe, expect, it, vi } from 'vitest';
vi.mock('server-only', () => ({}));
import { createHmac } from 'node:crypto';
import { SHOWCASE_PRODUCTS } from '@/lib/showcase-catalog';
import { quoteSettlementCart } from './settlement-quote';
import { issueSettlementQuoteToken, settlementCartFingerprint, verifySettlementQuoteToken } from './settlement-quote-token';

const now = Date.parse('2026-09-25T12:00:00Z');
const secret = 'not-a-real-secret-unit-test-only-32-bytes';
const scope = { userId: 'qa-buyer', environment: 'SANDBOX' as const, cartFingerprint: 'a'.repeat(64) };
function quote() { return quoteSettlementCart({ currency: 'NOK', items: [{ productId: SHOWCASE_PRODUCTS.credits.id, quantity: 1, credits: { type: 'spend', amount: '1000' } }] },
  { now, models: [{ credits: 1, reserveMicroUsd: 10000 }], modelCostReviewBy: '2026-10-24T00:00:00Z' }); }

describe('short-lived settlement attestation', () => {
  it('round-trips the immutable money with a unique future request identity', () => {
    const issued = issueSettlementQuoteToken(quote(), scope, secret, now);
    const verified = verifySettlementQuoteToken(issued.token, scope, secret, now);
    expect(verified).toEqual({ quoteId: issued.quoteId, quote: quote(), scope });
    expect(issued.expiresAt).toBe(quote().expiresAt);
    expect(issueSettlementQuoteToken(quote(), scope, secret, now).quoteId).not.toBe(issued.quoteId);
    expect(issued.token).not.toContain(secret);
    // Verification returns the SAME ID on retries. The integration must persist
    // it uniquely; this test deliberately does not claim database replay safety.
    expect(verifySettlementQuoteToken(issued.token, scope, secret, now).quoteId).toBe(issued.quoteId);
  });
  it('rejects changing amount, currency, credits or expiry without a new server signature', () => {
    const issued = issueSettlementQuoteToken(quote(), scope, secret, now);
    const [payload, signature] = issued.token.split('.');
    for (const key of ['totalMinor', 'currency', 'lines', 'expiresAt']) {
      const data = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'));
      data.quote[key] = key === 'totalMinor' ? 1 : key === 'currency' ? 'USD' : key === 'lines' ? [] : '2099-01-01T00:00:00Z';
      const changed = Buffer.from(JSON.stringify(data)).toString('base64url');
      expect(() => verifySettlementQuoteToken(`${changed}.${signature}`, scope, secret, now)).toThrow('INVALID_SETTLEMENT_TOKEN');
    }
  });
  it('rejects a token copied to another user, environment or changed cart', () => {
    const { token } = issueSettlementQuoteToken(quote(), scope, secret, now);
    for (const different of [{ ...scope, userId: 'another-buyer' }, { ...scope, environment: 'LIVE' as const }, { ...scope, environment: 'DEMO' as const },
      { ...scope, cartFingerprint: 'b'.repeat(64) }]) {
      expect(() => verifySettlementQuoteToken(token, different, secret, now)).toThrow('SETTLEMENT_QUOTE_SCOPE_CHANGED');
    }
  });
  it('rejects expiry, future issued time and rotation for unprepared quotes', () => {
    const { token } = issueSettlementQuoteToken(quote(), scope, secret, now);
    expect(() => verifySettlementQuoteToken(token, scope, secret, Date.parse(quote().expiresAt))).toThrow('SETTLEMENT_QUOTE_EXPIRED');
    expect(() => verifySettlementQuoteToken(token, scope, secret, now - 1)).toThrow('SETTLEMENT_QUOTE_EXPIRED');
    expect(() => verifySettlementQuoteToken(token, scope, `${secret}-rotated`, now)).toThrow('INVALID_SETTLEMENT_TOKEN');
  });
  it.each(['', '.', 'one.two.three', 'a.!', 'a.'.padEnd(20000, 'a'), 123, null])('rejects malformed/oversized token %j', token => {
    expect(() => verifySettlementQuoteToken(token, scope, secret, now)).toThrow('INVALID_SETTLEMENT_TOKEN');
  });
  it('does not accept a signature from another purpose or unsigned JSON', () => {
    const { token } = issueSettlementQuoteToken(quote(), scope, secret, now);
    const payload = token.split('.')[0];
    const direct = createHmac('sha256', secret).update(payload).digest('base64url');
    expect(() => verifySettlementQuoteToken(`${payload}.${direct}`, scope, secret, now)).toThrow('INVALID_SETTLEMENT_TOKEN');
    expect(() => verifySettlementQuoteToken(JSON.stringify(quote()), scope, secret, now)).toThrow('INVALID_SETTLEMENT_TOKEN');
  });
  it('requires a sufficiently strong signing secret, even for NOK', () => {
    expect(() => issueSettlementQuoteToken(quote(), scope, '', now)).toThrow('SETTLEMENT_SIGNING_UNAVAILABLE');
    const { token } = issueSettlementQuoteToken(quote(), scope, secret, now);
    expect(() => verifySettlementQuoteToken(token, scope, 'short', now)).toThrow('SETTLEMENT_SIGNING_UNAVAILABLE');
  });
});

describe('server cart revision binding', () => {
  const snapshot = () => ({ id: 'cart1', userId: 'buyer1', updatedAt: new Date(now), CartItem: [
    { id: 'line1', productId: String(SHOWCASE_PRODUCTS.credits.id), quantity: 1, creditAmount: 100, updatedAt: new Date(now), creditSpendMinor: 10000, creditSpendCurrency: 'USD' },
    { id: 'line2', productId: String(SHOWCASE_PRODUCTS.interviewPack.id), quantity: 1, creditAmount: null, updatedAt: new Date(now) },
  ] });
  it('is stable regardless of row order and ignores joined product/private metadata', () => {
    const cart = snapshot(), original = settlementCartFingerprint(cart);
    expect(original).toMatch(/^[a-f0-9]{64}$/);
    expect(settlementCartFingerprint({ ...cart, User: { email: 'not-in-the-hash@example.invalid' }, CartItem: [...cart.CartItem].reverse() })).toBe(original);
  });
  it.each(['actor', 'cart', 'cartRevision', 'line', 'product', 'quantity', 'credits', 'spend', 'currency', 'lineRevision', 'remove'])('invalidates a quote after a %s change', field => {
    const cart = snapshot(), original = settlementCartFingerprint(cart);
    if (field === 'actor') cart.userId = 'buyer2';
    if (field === 'cart') cart.id = 'cart2';
    if (field === 'cartRevision') cart.updatedAt = new Date(now + 1);
    if (field === 'line') cart.CartItem[0].id = 'readded-line';
    if (field === 'product') cart.CartItem[0].productId = 'different-product';
    if (field === 'quantity') cart.CartItem[0].quantity = 2;
    if (field === 'credits') cart.CartItem[0].creditAmount = 101;
    if (field === 'spend') cart.CartItem[0].creditSpendMinor = 10001;
    if (field === 'currency') cart.CartItem[0].creditSpendCurrency = 'EUR';
    if (field === 'lineRevision') cart.CartItem[0].updatedAt = new Date(now + 1);
    if (field === 'remove') cart.CartItem.pop();
    expect(settlementCartFingerprint(cart)).not.toBe(original);
  });
  it('refuses corrupt duplicate rows or half-defined spend state', () => {
    const cart = snapshot();
    expect(() => settlementCartFingerprint({ ...cart, CartItem: [cart.CartItem[0], cart.CartItem[0]] })).toThrow('INVALID_SETTLEMENT_CART');
    expect(() => settlementCartFingerprint({ ...cart, CartItem: [{ ...cart.CartItem[0], creditSpendCurrency: null }] })).toThrow('INVALID_SETTLEMENT_CART');
    expect(() => settlementCartFingerprint({ ...cart, CartItem: [{ ...cart.CartItem[0], creditSpendMinor: 0 }] })).toThrow('INVALID_SETTLEMENT_CART');
    expect(() => settlementCartFingerprint({ ...cart, updatedAt: '2026-09-25' })).toThrow('INVALID_SETTLEMENT_CART');
  });
});
