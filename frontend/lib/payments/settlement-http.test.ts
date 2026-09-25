/** HTTP contracts only. No network, database, provider, email or secret creation. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
const m = vi.hoisted(() => ({ auth: vi.fn(), editLimit: vi.fn(), paymentLimit: vi.fn(),
  estimate: vi.fn(), quote: vi.fn(), save: vi.fn(), prepare: vi.fn(), begin: vi.fn(), complete: vi.fn() }));
vi.mock('server-only', () => ({}));
vi.mock('@/auth', () => ({ auth: m.auth }));
vi.mock('@/lib/auth-rate-limit', () => ({ allowSettlementEdit: m.editLimit, allowAuthAttempt: m.paymentLimit }));
vi.mock('./settlement-runtime', () => ({ estimateSettlement: m.estimate,
  settlementStore: () => ({ quoteCart: m.quote, saveCreditIntent: m.save, prepare: m.prepare }) }));
vi.mock('./showcase-store', () => ({ beginShowcaseCheckout: m.begin, completeShowcaseCheckout: m.complete }));
import { POST as estimate } from '@/app/api/checkout/estimate/route';
import { POST as quote } from '@/app/api/checkout/quote/route';
import { PATCH as save } from '@/app/api/checkout/credit-intent/route';
import { POST as checkout } from '@/app/api/checkout/route';
import { POST as demoCheckout } from '@/app/api/demo/checkout/route';
import { readSettlementJson, settlementErrorResponse } from './settlement-request';
import { SettlementError } from './settlement-money';
import { CheckoutError } from './showcase-policy';
import { CHECKOUT_AGREEMENT_VERSION } from './checkout-agreement';
import { SHOWCASE_PRODUCTS } from '@/lib/showcase-catalog';
import { allowsDemoMutation } from '@/lib/demo-policy';

const origin = 'http://localhost:3000', quoteId = '584ba6e8-6580-43ac-a6f2-1b93bc80d0b4';
const consent = { version: CHECKOUT_AGREEMENT_VERSION, credits: true, files: false };
const selection = { currency: 'USD', items: [{ productId: SHOWCASE_PRODUCTS.credits.id, quantity: 1, credits: { type: 'spend', amount: '100' } }] };
const intent = { itemId: 'own-item', expectedUpdatedAt: '2026-09-25T12:00:00.000Z', intent: { type: 'spend', currency: 'USD', amount: '100' } };
const request = (body: unknown, path = '/api/checkout', headers: Record<string, string> = {}) => new Request(origin + path, {
  method: path.endsWith('credit-intent') ? 'PATCH' : 'POST', headers: { origin, 'content-type': 'application/json', ...headers }, body: JSON.stringify(body),
});
beforeEach(() => {
  vi.resetAllMocks(); vi.spyOn(console, 'warn').mockImplementation(() => {});
  m.auth.mockResolvedValue({ user: { id: 'signed-in-buyer' } });
  m.editLimit.mockResolvedValue(true); m.paymentLimit.mockResolvedValue(true);
  m.estimate.mockResolvedValue({ currency: 'USD', totalMinor: 10000 });
  m.quote.mockResolvedValue({ quoteId, token: 'private-attestation', quote: { currency: 'USD', totalMinor: 10000 } });
  m.save.mockResolvedValue({ id: 'own-item', creditAmount: 2500, creditSpendMinor: 10000, creditSpendCurrency: 'USD', updatedAt: new Date() });
  m.prepare.mockResolvedValue({ orderId: 'prepared-order', requestKey: quoteId });
  m.begin.mockResolvedValue({ orderId: 'prepared-order', approvalUrl: 'https://www.sandbox.paypal.com/checkoutnow?token=TEST' });
  m.complete.mockResolvedValue({ orderId: 'prepared-order' });
});
afterEach(() => { vi.restoreAllMocks(); vi.useRealTimers(); });

describe('quote/edit authorization and privacy', () => {
  it('permits anonymous price preview without signing, saving, ordering or granting', async () => {
    m.auth.mockResolvedValue(null);
    const response = await estimate(request(selection));
    expect(response.status).toBe(200); expect(await response.json()).toEqual({ quote: { currency: 'USD', totalMinor: 10000 } });
    expect(m.editLimit).toHaveBeenCalledWith('', expect.any(Request));
    expect(m.quote).not.toHaveBeenCalled(); expect(m.save).not.toHaveBeenCalled(); expect(m.prepare).not.toHaveBeenCalled(); expect(m.begin).not.toHaveBeenCalled(); expect(m.complete).not.toHaveBeenCalled();
  });
  it.each([['cart quote',quote,{currency:'USD'}], ['save intent',save,intent]] as const)('requires current auth for %s', async (_label, handler, body) => {
    m.auth.mockResolvedValue(null); expect((await handler(request(body))).status).toBe(401);
    expect(m.quote).not.toHaveBeenCalled(); expect(m.save).not.toHaveBeenCalled(); expect(m.editLimit).not.toHaveBeenCalled();
  });
  it.each([estimate, quote, save, checkout, demoCheckout])('denies cross-origin, missing origin and impersonation before work', async handler => {
    for (const header of ['', 'http://localhost:3100', 'https://evil.invalid']) {
      expect((await handler(request({}, undefined, { origin: header }))).status).toBe(403);
    }
    expect(m.auth).not.toHaveBeenCalled();
    m.auth.mockResolvedValue({ user: { id: 'preview-target', isImpersonating: true } });
    expect((await handler(request({}))).status).toBe(403);
    expect(m.estimate).not.toHaveBeenCalled(); expect(m.prepare).not.toHaveBeenCalled(); expect(m.save).not.toHaveBeenCalled();
  });
  it('signs only the authenticated server cart, not browser items or user IDs', async () => {
    const response = await quote(request({ currency: 'USD' }));
    expect(response.status).toBe(200); expect(m.quote).toHaveBeenCalledWith('signed-in-buyer', 'USD');
    for (const extra of [{ userId: 'other' }, { totalMinor: 1 }, { items: selection.items }, { environment: 'DEMO' }, { fx: { rate: 5 } }]) {
      expect((await quote(request({ currency: 'USD', ...extra }))).status).toBe(400);
    }
    expect(m.quote).toHaveBeenCalledTimes(1);
  });
  it('saves exact spend with optimistic revision, never a client credit grant', async () => {
    const response = await save(request(intent));
    expect(response.status).toBe(200);
    expect(m.save).toHaveBeenCalledWith('signed-in-buyer', 'own-item', intent.expectedUpdatedAt, intent.intent);
    expect((await save(request({ ...intent, intent: { ...intent.intent, credits: 999999 } }))).status).toBe(400);
    expect(m.save).toHaveBeenCalledTimes(1);
    m.save.mockRejectedValue(new CheckoutError('CART_CHANGED',409));
    expect((await save(request(intent))).status).toBe(409);
  });
  it('keeps edit limits separate from payment limits and sends retry metadata', async () => {
    m.editLimit.mockResolvedValue(false);
    const response = await estimate(request(selection));
    expect(response.status).toBe(429); expect(response.headers.get('retry-after')).toBe('300');
    expect(m.estimate).not.toHaveBeenCalled(); expect(m.paymentLimit).not.toHaveBeenCalled();
    m.paymentLimit.mockResolvedValue(false);
    expect((await checkout(request({ quoteToken: 'valid-shape', consent }))).status).toBe(429);
    expect(m.prepare).not.toHaveBeenCalled();
  });
  it.each([200,400,401,403,409,429,503])('never caches a %i quote response or exposes diagnostic messages', async status => {
    if (status !== 200) m.quote.mockRejectedValue(new CheckoutError('SAFE_CODE',status));
    const response = await quote(request({ currency: 'USD' }));
    expect(response.status).toBe(status); expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('vary')).toBe('Cookie'); expect(response.headers.get('referrer-policy')).toBe('no-referrer');
  });
  it('masks arbitrary signing/provider failures and does not log tokens or raw request text', async () => {
    m.quote.mockRejectedValue(Object.assign(new Error('private-attestation and credential'), { code: 'private-provider-value' }));
    const response = await quote(request({ currency: 'USD' }));
    expect(await response.json()).toEqual({ error: 'CHECKOUT_TEMPORARILY_UNAVAILABLE' });
    expect(JSON.stringify(vi.mocked(console.warn).mock.calls)).not.toMatch(/private-attestation|credential|private-provider-value/);
    expect(await settlementErrorResponse(new SettlementError('private-unrecognized-code')).json()).toEqual({ error: 'CHECKOUT_TEMPORARILY_UNAVAILABLE' });
  });
});

describe('signed quote to existing payment path', () => {
  it('prepares the reviewed token before creating an approval using its immutable identity; never captures', async () => {
    expect((await checkout(request({ quoteToken: 'private-attestation', consent }))).status).toBe(200);
    expect(m.prepare).toHaveBeenCalledWith('signed-in-buyer', 'private-attestation', consent);
    expect(m.begin).toHaveBeenCalledWith('signed-in-buyer', quoteId);
    expect(m.prepare.mock.invocationCallOrder[0]).toBeLessThan(m.begin.mock.invocationCallOrder[0]);
    expect(m.complete).not.toHaveBeenCalled();
  });
  it.each(['INVALID_SETTLEMENT_TOKEN','SETTLEMENT_QUOTE_SCOPE_CHANGED','SETTLEMENT_QUOTE_EXPIRED'])('does not create a provider order after %s', async code => {
    m.prepare.mockRejectedValue(new SettlementError(code));
    expect((await checkout(request({ quoteToken: 'rejected', consent }))).status).toBe(code === 'INVALID_SETTLEMENT_TOKEN' ? 400 : 409);
    expect(m.begin).not.toHaveBeenCalled(); expect(m.complete).not.toHaveBeenCalled();
  });
  it.each([{ quoteToken:'token' },{ quoteToken:'token',consent,requestKey:quoteId },{ quoteToken:'token',consent,totalMinor:1 }])('rejects ambiguous/unreviewed purchase bodies %j', async body => {
    expect((await checkout(request(body))).status).toBe(400); expect(m.prepare).not.toHaveBeenCalled(); expect(m.begin).not.toHaveBeenCalled();
  });
  it('retains legacy NOK requests without silently upgrading the price', async () => {
    expect((await checkout(request({ requestKey:quoteId,expectedQuote:'original-nok',consent }))).status).toBe(200);
    expect(m.prepare).not.toHaveBeenCalled(); expect(m.begin).toHaveBeenCalledWith('signed-in-buyer',quoteId,'original-nok',consent);
  });
  it('allows exact-price demos only through the unpaid path, without provider creation', async () => {
    m.auth.mockResolvedValue({ user: { id:'demo_isolated' } });
    expect((await checkout(request({quoteToken:'token',consent}))).status).toBe(403);
    expect((await demoCheckout(request({quoteToken:'token'}))).status).toBe(200);
    expect(m.prepare).toHaveBeenCalledWith('demo_isolated','token'); expect(m.begin).not.toHaveBeenCalled();
    expect(m.complete).toHaveBeenCalledWith('prepared-order','demo_isolated');
    for (const path of ['/api/checkout/estimate','/api/checkout/quote','/api/checkout/credit-intent','/api/demo/checkout']) expect(allowsDemoMutation(path)).toBe(true);
    for (const path of ['/api/checkout','/api/checkout/complete','/api/checkout/quote/complete']) expect(allowsDemoMutation(path)).toBe(false);
  });
  it('does not let a non-demo account use free fulfillment', async () => {
    expect((await demoCheckout(request({quoteToken:'token'}))).status).toBe(403); expect(m.prepare).not.toHaveBeenCalled(); expect(m.complete).not.toHaveBeenCalled();
  });
});

describe('bounded JSON transport', () => {
  it.each(['text/plain','application/x-www-form-urlencoded','text/html'])('rejects %s before quote work', async type => {
    expect((await estimate(request(selection,undefined,{'content-type':type}))).status).toBe(415); expect(m.estimate).not.toHaveBeenCalled();
  });
  it('rejects forged money/rate fields and oversized bodies', async () => {
    expect((await estimate(request({...selection,totalMinor:1}))).status).toBe(400);
    expect((await estimate(request({...selection,fx:{rate:'999'}}))).status).toBe(400);
    expect((await estimate(request('x'.repeat(2049)))).status).toBe(413);
    expect((await estimate(request(selection,undefined,{'content-length':'90000'}))).status).toBe(413);
    expect(m.estimate).not.toHaveBeenCalled();
  });
  it('bounds actual UTF-8 bytes with no trusted length header', async () => {
    await expect(readSettlementJson(request('😀'.repeat(20)),40)).rejects.toMatchObject({code:'REQUEST_TOO_LARGE',status:413});
    expect(await readSettlementJson(request({text:'Hello 😀'}))).toEqual({text:'Hello 😀'});
    const invalid = new Request(origin,{method:'POST',headers:{'content-type':'application/json'},body:'{invalid'});
    await expect(readSettlementJson(invalid)).rejects.toMatchObject({code:'INVALID_REQUEST',status:400});
  });
  it('cancels a stalled body instead of waiting forever', async () => {
    vi.useFakeTimers(); const cancel = vi.fn();
    const stream = new ReadableStream<Uint8Array>({ cancel });
    const slow = new Request(origin,{method:'POST',headers:{'content-type':'application/json'},body:stream,duplex:'half'} as RequestInit);
    const result = readSettlementJson(slow).catch(error => error);
    await vi.advanceTimersByTimeAsync(10_000);
    expect(await result).toMatchObject({code:'REQUEST_TIMEOUT',status:408}); expect(cancel).toHaveBeenCalledTimes(1);
  });
});
