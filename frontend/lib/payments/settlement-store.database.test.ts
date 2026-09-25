/** @fileOverview Exact-currency preparation against real Postgres in a disposable, empty Preview schema. */
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { createHmac, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { Client } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '@/generated/prisma/client';
import { previewDatabaseUrl } from '@/lib/preview-database';
import { SHOWCASE_PRODUCTS } from '@/lib/showcase-catalog';
import { creditCartData } from '@/lib/cart-credit-policy';
vi.mock('server-only', () => ({}));
import { createSettlementStore } from './settlement-store';
import { CHECKOUT_AGREEMENT_VERSION } from './checkout-agreement';
import { quoteSettlementCart, readStoredSettlementQuote, type SettlementFx } from './settlement-quote';
import { readSignedSettlementQuoteToken } from './settlement-quote-token';
import type { SettlementCurrency } from './settlement-money';

const initialNow = Date.parse('2026-09-25T12:00:00Z');
const secret = 'fake-signing-secret-for-disposable-database-tests-only';
const creditSku = SHOWCASE_PRODUCTS.credits.id, fileSku = SHOWCASE_PRODUCTS.interviewPack.id;
const consent = { version: CHECKOUT_AGREEMENT_VERSION, files: false, credits: true } as const;
const rates = { USD: '0.105', EUR: '0.09', GBP: '0.079', SEK: '0.94', DKK: '0.68' };
function fx(currency: SettlementCurrency, now = initialNow): SettlementFx | null {
  return currency === 'NOK' ? null : { source: 'ECB_VIA_FRANKFURTER', base: 'NOK', currency, rate: rates[currency],
    publishedOn: '2026-09-25', fetchedAt: new Date(now).toISOString() };
}
function latch() {
  let release!: () => void;
  const promise = new Promise<void>(resolve => { release = resolve; });
  return { promise, release };
}

describe.skipIf(process.env.TEST_SETTLEMENT_DATABASE !== '1')('exact settlement: isolated real Postgres', () => {
  const schema = `qa_settlement_${randomUUID().replaceAll('-', '')}`;
  let admin: Client, writer: Client, db: PrismaClient;
  let legacyOrderId: string;
  const config = () => ({ environment: 'SANDBOX' as const, secret, now: () => initialNow,
    models: [{ credits: 1, reserveMicroUsd: 10000 }], modelCostReviewBy: '2026-10-24T00:00:00Z',
    readFx: async (currency: SettlementCurrency) => fx(currency), paypalConfigured: () => true });
  const store = (overrides: Partial<ReturnType<typeof config>> = {}, client = db) => createSettlementStore(client, { ...config(), ...overrides });

  beforeAll(async () => {
    const url = new URL(previewDatabaseUrl({ DATABASE_URL_MAINPREVIEW: process.env.DATABASE_URL_MAINPREVIEW,
      DATABASE_URL_MAINLIVE: process.env.DATABASE_URL_MAINLIVE }));
    url.hostname = url.hostname.replace('-pooler.', '.');
    url.searchParams.set('uselibpqcompat', 'true');
    if (!/^qa_settlement_[a-f0-9]{32}$/.test(schema)) throw new Error('Unsafe QA schema');
    // Both Prisma's qualified queries AND raw SQL must resolve only this schema.
    url.searchParams.set('options', `-c search_path=${schema}`);
    url.searchParams.set('application_name', schema);
    admin = new Client({ connectionString: url.toString() });
    writer = new Client({ connectionString: url.toString() });
    await admin.connect(); await writer.connect();
    await admin.query(`CREATE SCHEMA "${schema}"`);
    const tables = ['Cart', 'CartItem', 'Product', 'DigitalProductFile', 'DigitalAsset', 'Order', 'OrderItem', 'CheckoutAttempt'];
    for (const table of tables) await admin.query(`CREATE TABLE "${schema}"."${table}" (LIKE public."${table}" INCLUDING ALL)`);
    // LIKE copies shape/defaults/checks/indexes only. It copies NO customer data,
    // FKs or triggers. Recreate enum types locally so Prisma casts stay isolated.
    const enums = ['OrderStatus', 'FulfilmentStatus', 'FiatCurrency', 'ProductCondition', 'ProductType', 'ProductVisibility', 'StorageProvider'];
    for (const type of enums) {
      const labels = await admin.query<{ label: string }>('SELECT enumlabel AS label FROM pg_enum WHERE enumtypid = $1::regtype ORDER BY enumsortorder', [`public."${type}"`]);
      if (!labels.rows.length || labels.rows.some(row => !/^[A-Z0-9_]+$/.test(row.label))) throw new Error('Unexpected enum');
      await admin.query(`CREATE TYPE "${schema}"."${type}" AS ENUM (${labels.rows.map(row => `'${row.label}'`).join(',')})`);
    }
    for (const [table, column, type, defaultValue] of [
      ['Order', 'status', 'OrderStatus', 'PENDING'], ['Order', 'fulfilmentStatus', 'FulfilmentStatus', 'UNFULFILLED'],
      ['Product', 'priceCurrency', 'FiatCurrency', 'USD'], ['Product', 'acceptedFiatCurrencies', 'FiatCurrency[]', '{}'],
      ['Product', 'condition', 'ProductCondition', 'NEW'], ['Product', 'productType', 'ProductType', 'PHYSICAL'],
      ['Product', 'visibility', 'ProductVisibility', 'PUBLIC'], ['DigitalAsset', 'storageProvider', 'StorageProvider', 'EDGESTORE'],
    ]) {
      const cast = `"${schema}"."${type.replace('[]', '')}"${type.endsWith('[]') ? '[]' : ''}`;
      await admin.query(`ALTER TABLE "${schema}"."${table}" ALTER COLUMN "${column}" DROP DEFAULT,
        ALTER COLUMN "${column}" TYPE ${cast} USING "${column}"::text::${cast}`);
      await admin.query(`ALTER TABLE "${schema}"."${table}" ALTER COLUMN "${column}" SET DEFAULT '${defaultValue}'::${cast}`);
    }
    // Real FK enforcement is essential to testing the parent's insert lock.
    await admin.query(`ALTER TABLE "CartItem" ADD FOREIGN KEY ("cartId") REFERENCES "Cart"(id),
      ADD FOREIGN KEY ("productId") REFERENCES "Product"(id)`);
    await admin.query(`ALTER TABLE "CheckoutAttempt" ADD FOREIGN KEY ("orderId") REFERENCES "Order"(id)`);
    await admin.query(`ALTER TABLE "OrderItem" ADD FOREIGN KEY ("orderId") REFERENCES "Order"(id),
      ADD FOREIGN KEY ("productId") REFERENCES "Product"(id)`);
    // An existing v1 record must survive the migration unchanged.
    legacyOrderId = randomUUID();
    await admin.query(`INSERT INTO "Order" (id,"userId","totalAmount",currency,"updatedAt") VALUES ($1,'migration-legacy',39,'NOK',now())`, [legacyOrderId]);
    await admin.query(`INSERT INTO "CheckoutAttempt" ("orderId","userId","requestKey",environment,"totalOre",currency,quote,"createRequestId","captureRequestId")
      VALUES ($1,'migration-legacy',$2,'SANDBOX',3900,'NOK','{}',$3,$4)`, [legacyOrderId, randomUUID(), randomUUID(), randomUUID()]);
    await admin.query(await readFile(new URL('../../prisma/migrations/20260925190000_exact_settlement_quotes/migration.sql', import.meta.url), 'utf8'));
    db = new PrismaClient({ adapter: new PrismaPg({ connectionString: url.toString(), max: 12 }, { schema }) });
    expect((await db.$queryRaw<{ schema: string }[]>`SELECT current_schema() AS schema`)[0].schema).toBe(schema);
    for (const sku of Object.values(SHOWCASE_PRODUCTS)) {
      await db.product.create({ data: { id: sku.id, title: sku.title, description: 'Synthetic QA product', category: 'digital',
        price: sku.amountOre / 100, stock: 1, shipFromPostalId: 'qa', userId: 'qa-seller', image: [], productType: 'DIGITAL' } });
    }
    for (const [extension, mime] of [['jpg', 'image/jpeg'], ['txt', 'text/plain']]) {
      const asset = await db.digitalAsset.create({ data: { fileName: `qa.${extension}`, fileExtension: extension, mimeType: mime,
        fileSize: 1, checksum: '0'.repeat(64), storageKey: `qa/${extension}`, uploadedById: 'qa-seller' } });
      await db.digitalProductFile.create({ data: { productId: fileSku, digitalAssetId: asset.id } });
    }
  }, 60_000);
  afterAll(async () => {
    await db?.$disconnect();
    await writer?.query('ROLLBACK'); await writer?.end();
    if (admin && /^qa_settlement_[a-f0-9]{32}$/.test(schema)) {
      await admin.query('ROLLBACK');
      await admin.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
      await admin.end();
    }
  }, 30_000);

  async function cart(userId = randomUUID(), withFile = false) {
    return db.cart.create({ data: { userId, CartItem: { create: [
      { productId: creditSku, quantity: 1, creditAmount: 100 }, ...(withFile ? [{ productId: fileSku, quantity: 1, creditAmount: null }] : []),
    ] } }, include: { CartItem: true } });
  }
  async function exact(currency: SettlementCurrency, amount: string, withFile = false) {
    const current = await cart(randomUUID(), withFile), item = current.CartItem.find(line => line.productId === creditSku)!;
    const saved = await store().saveCreditIntent(current.userId, item.id, item.updatedAt.toISOString(), { type: 'spend', currency, amount });
    const signed = await store().quoteCart(current.userId, currency);
    return { current, item, saved, signed };
  }
  async function waitForWriterLock(queryPart = 'qa_blocked_writer') {
    // Poll an observable DB lock, not a guessed sleep. Keep the deadline bounded.
    const deadline = Date.now() + 4000;
    while (Date.now() < deadline) {
      const result = await admin.query(`SELECT EXISTS (SELECT 1 FROM pg_stat_activity WHERE application_name=$1
        AND query LIKE $2 AND wait_event_type='Lock') AS blocked`, [schema, `%${queryPart}%`]);
      if (result.rows[0].blocked) return;
    }
    throw new Error('Writer did not block');
  }

  it('preserves old NOK attempts and rejects non-NOK legacy records', async () => {
    const original = await db.checkoutAttempt.findUniqueOrThrow({ where: { orderId: legacyOrderId } });
    expect(original).toMatchObject({ totalOre: 3900, currency: 'NOK', totalMinor: null, settlementQuoteId: null });
    await expect(admin.query('UPDATE "CheckoutAttempt" SET currency=$1 WHERE "orderId"=$2', ['USD', legacyOrderId])).rejects.toMatchObject({ code: '23514' });
  });
  it.each([['USD', '100.00', 10000], ['NOK', '1000', 100000]] as const)('freezes %s %s exactly, independently of the NOK exposure', async (currency, amount, minor) => {
    const { current, saved, signed } = await exact(currency, amount);
    expect(saved.creditSpendMinor).toBe(minor);
    const attempt = await store().prepare(current.userId, signed.token, consent);
    expect(attempt).toMatchObject({ currency, totalMinor: minor, refundedMinor: 0, state: 'PREPARED', captureId: null,
      totalOre: signed.quote.exposureNokOre, settlementQuoteId: signed.quoteId });
    expect(readStoredSettlementQuote((attempt.quote as { settlement: unknown }).settlement)).toEqual(signed.quote);
    const order = await db.order.findUniqueOrThrow({ where: { id: attempt.orderId }, include: { OrderItem: true } });
    expect(order).toMatchObject({ totalAmount: minor / 100, currency, status: 'PENDING', fulfilmentStatus: 'UNFULFILLED' });
    expect(order.OrderItem[0].priceAtTime).toBe(minor / 100);
    // Preparation has no ledger, payment, email or download tables available;
    // it must not call any fulfillment path or external provider.
  });
  it('keeps the credit and file lines separate in one exact-currency order', async () => {
    const { current, signed } = await exact('USD', '100', true);
    const attempt = await store().prepare(current.userId, signed.token, { ...consent, files: true });
    const lines = await db.orderItem.findMany({ where: { orderId: attempt.orderId } });
    expect(lines).toHaveLength(2);
    expect(lines.find(line => line.productId === creditSku)?.priceAtTime).toBe(100);
    expect(lines.find(line => line.productId === fileSku)?.priceAtTime).toBe(signed.quote.lines.find(line => line.kind === 'DIGITAL_FILES')!.amountMinor / 100);
  });
  it('persists whole-credit mode by clearing both previous spend fields', async () => {
    const { current, item, saved } = await exact('USD', '100');
    const changed = await store().saveCreditIntent(current.userId, item.id, saved.updatedAt.toISOString(), { type: 'credits', currency: 'NOK', credits: 122 });
    expect(changed).toMatchObject({ creditAmount: 122, creditSpendMinor: null, creditSpendCurrency: null });
    expect((await store().quoteCart(current.userId, 'NOK')).quote.lines[0].credits).toBe(122);
  });
  it('rejects stale edits, a changed currency and another account’s line', async () => {
    const { current, item } = await exact('USD', '100');
    await expect(store().saveCreditIntent(current.userId, item.id, item.updatedAt.toISOString(), { type: 'credits', currency: 'USD', credits: 555 })).rejects.toThrow('CART_CHANGED');
    await expect(store().quoteCart(current.userId, 'EUR')).rejects.toThrow('SPEND_CURRENCY_CHANGED');
    const other = await cart();
    await expect(store().saveCreditIntent(other.userId, item.id, item.updatedAt.toISOString(), { type: 'credits', currency: 'USD', credits: 555 })).rejects.toThrow('ITEM_UNAVAILABLE');
  });
  it('legacy count-mode cart updates clear a saved budget too', async () => {
    const { current, item } = await exact('USD', '100');
    await db.cartItem.update({ where: { id: item.id }, data: creditCartData(creditSku, 1, 555) });
    const quote = await store().quoteCart(current.userId, 'NOK');
    expect(quote.quote.lines[0]).toMatchObject({ selection: 'credits', credits: 555 });
  });
  it('requires the exact current delivery consent before preparing any paid order', async () => {
    const { current, signed } = await exact('USD', '100', true);
    for (const agreement of [undefined, consent, { ...consent, files: true, credits: false }]) {
      await expect(store().prepare(current.userId, signed.token, agreement)).rejects.toThrow('DELIVERY_CONSENT_REQUIRED');
    }
    expect(await db.order.count({ where: { userId: current.userId } })).toBe(0);
  });
  it('deduplicates simultaneous prepares, even after cart edits and token expiry', async () => {
    const { current, item, signed } = await exact('USD', '100');
    const attempts = await Promise.all(Array.from({ length: 6 }, () => store().prepare(current.userId, signed.token, consent)));
    expect(new Set(attempts.map(attempt => attempt.orderId)).size).toBe(1);
    await db.cartItem.delete({ where: { id: item.id } });
    const replay = await store({ now: () => initialNow + 86400000 }).prepare(current.userId, signed.token);
    expect(replay).toEqual(attempts[0]);
    expect(await db.order.count({ where: { userId: current.userId } })).toBe(1);
  }, 30_000);
  it('does not reuse an ID to authorize different signed money', async () => {
    const { current, signed } = await exact('USD', '100');
    await store().prepare(current.userId, signed.token, consent);
    // Only a server signer can do this. Even a signer bug reusing an ID must not
    // turn a previous order into permission to charge a changed amount.
    const decoded = readSignedSettlementQuoteToken(signed.token, secret);
    const next = quoteSettlementCart({ currency: 'USD', items: [{ productId: creditSku, quantity: 1, credits: { type: 'spend', amount: '101' } }] },
      { now: initialNow, fx: fx('USD'), models: config().models, modelCostReviewBy: config().modelCostReviewBy });
    const purpose = 'veggat-settlement-quote-v1';
    const payload = Buffer.from(JSON.stringify({ purpose, ...decoded, quote: next })).toString('base64url');
    const key = createHmac('sha256', secret).update(purpose).digest();
    const signature = createHmac('sha256', key).update(payload).digest('base64url');
    await expect(store().prepare(current.userId, `${payload}.${signature}`, consent)).rejects.toThrow('SETTLEMENT_QUOTE_SCOPE_CHANGED');
    expect((await db.checkoutAttempt.findUniqueOrThrow({ where: { settlementQuoteId: signed.quoteId } })).totalMinor).toBe(10000);
  });
  it('blocks expired unprepared quotes, other actors and other payment environments', async () => {
    const { current, signed } = await exact('USD', '100');
    await expect(store({ now: () => Date.parse(signed.expiresAt) }).prepare(current.userId, signed.token, consent)).rejects.toThrow('SETTLEMENT_QUOTE_EXPIRED');
    await expect(store().prepare('another-buyer', signed.token, consent)).rejects.toThrow('SETTLEMENT_QUOTE_SCOPE_CHANGED');
    const live = createSettlementStore(db, { ...config(), environment: 'LIVE' });
    await expect(live.prepare(current.userId, signed.token, consent)).rejects.toThrow('SETTLEMENT_QUOTE_SCOPE_CHANGED');
    expect(await db.order.count({ where: { userId: current.userId } })).toBe(0);
  });
  it('refuses unconfigured payment and newly unsafe or unreviewed model costs', async () => {
    const { current, signed } = await exact('USD', '100');
    await expect(store({ paypalConfigured: () => false }).prepare(current.userId, signed.token, consent)).rejects.toThrow('PAYPAL_NOT_CONFIGURED');
    for (const modelCostReviewBy of ['invalid-date', '2026-09-25T11:59:59Z']) {
      await expect(store({ modelCostReviewBy }).prepare(current.userId, signed.token, consent)).rejects.toThrow('CREDIT_SALES_PAUSED');
    }
    await expect(store({ models: [{ credits: 1, reserveMicroUsd: 1000000 }] }).prepare(current.userId, signed.token, consent)).rejects.toThrow('CREDIT_SALES_PAUSED');
    expect(await db.order.count({ where: { userId: current.userId } })).toBe(0);
  });
  it('rechecks listing and private-file readiness after quoting', async () => {
    const { current, signed } = await exact('USD', '100', true);
    try {
      await db.product.update({ where: { id: creditSku }, data: { visibility: 'HIDDEN' } });
      await expect(store().prepare(current.userId, signed.token, { ...consent, files: true })).rejects.toThrow('ITEM_UNAVAILABLE');
      await db.product.update({ where: { id: creditSku }, data: { visibility: 'PUBLIC' } });
      await db.digitalAsset.updateMany({ where: { mimeType: 'text/plain' }, data: { isActive: false } });
      await expect(store().prepare(current.userId, signed.token, { ...consent, files: true })).rejects.toThrow('DOWNLOADS_NOT_READY');
    } finally {
      await db.product.update({ where: { id: creditSku }, data: { visibility: 'PUBLIC' } });
      await db.digitalAsset.updateMany({ data: { isActive: true } });
    }
    expect(await db.order.count({ where: { userId: current.userId } })).toBe(0);
  });
  it('keeps demo preparation unpaid without manufacturing delivery consent', async () => {
    const current = await cart(`demo_${randomUUID()}`), demo = store({ paypalConfigured: () => false });
    const signed = await demo.quoteCart(current.userId, 'NOK');
    const attempt = await demo.prepare(current.userId, signed.token);
    expect(attempt).toMatchObject({ environment: 'DEMO', state: 'PREPARED', captureId: null });
    expect(attempt.quote).toMatchObject({ agreement: { demo: true, requests: [] } });
  });
  it('serializes distinct concurrent quotes against the two-attempt cap', async () => {
    const current = await cart();
    const quotes = await Promise.all(Array.from({ length: 3 }, () => store().quoteCart(current.userId, 'NOK')));
    const results = await Promise.allSettled(quotes.map(quote => store().prepare(current.userId, quote.token, consent)));
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(2);
    expect(results.filter(result => result.status === 'rejected')).toMatchObject([{ reason: { code: 'DAILY_PURCHASE_LIMIT' } }]);
    expect(await db.order.count({ where: { userId: current.userId } })).toBe(2);
  }, 30_000);
  it('counts old NOK cash and new foreign exposure together against the daily cap', async () => {
    const { current, signed } = await exact('USD', '300');
    const previous = await db.order.create({ data: { userId: current.userId, totalAmount: 2500, currency: 'NOK' } });
    await db.checkoutAttempt.create({ data: { orderId: previous.id, userId: current.userId, requestKey: randomUUID(),
      environment: 'SANDBOX', totalOre: 250000, quote: {}, createdAt: new Date(initialNow - 1000) } });
    expect(signed.quote.exposureNokOre).toBeGreaterThan(250000);
    await expect(store().prepare(current.userId, signed.token, consent)).rejects.toThrow('DAILY_PURCHASE_AMOUNT_LIMIT');
    expect(await db.order.count({ where: { userId: current.userId } })).toBe(1);
  });
  it('rejects a quote after a committed legacy cart edit, even without advisory locks', async () => {
    const { current, item, signed } = await exact('USD', '100');
    await writer.query('UPDATE "CartItem" SET "updatedAt"="updatedAt"+interval \'1 millisecond\', "creditAmount"=555 WHERE id=$1', [item.id]);
    await expect(store().prepare(current.userId, signed.token, consent)).rejects.toThrow('SETTLEMENT_QUOTE_SCOPE_CHANGED');
    expect(await db.order.count({ where: { userId: current.userId } })).toBe(0);
  });
  it.each(['prepare', 'save'] as const)('rechecks expiry after waiting for the cart lock during %s', async operation => {
    const { current, item, saved, signed } = await exact('USD', '100');
    let clock = initialNow;
    const waitingStore = store({ now: () => clock });
    await writer.query('BEGIN');
    await writer.query('SELECT id FROM "Cart" WHERE id=$1 FOR UPDATE', [current.id]);
    const pending = operation === 'prepare' ? waitingStore.prepare(current.userId, signed.token, consent) :
      waitingStore.saveCreditIntent(current.userId, item.id, saved.updatedAt.toISOString(), { type: 'spend', currency: 'USD', amount: '101' });
    // Attach immediately so a genuine early error is reported, never unhandled.
    const result = pending.then(value => ({ value, error: undefined }), error => ({ value: undefined, error }));
    try {
      await waitForWriterLock('FOR UPDATE');
      clock = Date.parse(signed.expiresAt);
    } finally { await writer.query('ROLLBACK'); }
    expect((await result).error).toMatchObject({ code: 'SETTLEMENT_QUOTE_EXPIRED' });
    expect(await db.order.count({ where: { userId: current.userId } })).toBe(0);
    expect((await db.cartItem.findUniqueOrThrow({ where: { id: item.id } })).creditSpendMinor).toBe(10000);
  }, 20_000);
  it.each(['edit', 'insert', 'delete'] as const)('holds a coherent cart snapshot during a concurrent legacy %s', async operation => {
    const { current, item, signed } = await exact('USD', '100');
    const reached = latch(), proceed = latch();
    const gatedDb = db.$extends({ query: { checkoutAttempt: { async create({ args, query }) {
      reached.release(); await proceed.promise; return query(args);
    } } } }) as unknown as PrismaClient;
    const preparing = store({}, gatedDb).prepare(current.userId, signed.token, consent);
    let writing: Promise<unknown> | undefined;
    try {
      await Promise.race([reached.promise, preparing.then(() => { throw new Error('Expected preparation barrier'); })]);
      if (operation === 'edit') writing = writer.query('/* qa_blocked_writer */ UPDATE "CartItem" SET "creditAmount"=555,"updatedAt"=now() WHERE id=$1', [item.id]);
      if (operation === 'delete') writing = writer.query('/* qa_blocked_writer */ DELETE FROM "CartItem" WHERE id=$1', [item.id]);
      if (operation === 'insert') writing = writer.query(`/* qa_blocked_writer */ INSERT INTO "CartItem" (id,"cartId","productId",quantity,"updatedAt") VALUES ($1,$2,$3,1,now())`, [randomUUID(), current.id, fileSku]);
      await waitForWriterLock();
    } finally { proceed.release(); }
    const attempt = await preparing; await writing;
    expect(attempt.totalMinor).toBe(10000);
    expect((await db.orderItem.findMany({ where: { orderId: attempt.orderId } }))).toHaveLength(1);
    expect(readStoredSettlementQuote((attempt.quote as { settlement: unknown }).settlement)).toEqual(signed.quote);
  }, 20_000);
  it('enforces spend-pair and quote immutability constraints in SQL, not only TypeScript', async () => {
    const { current, item, signed } = await exact('USD', '100');
    const attempt = await store().prepare(current.userId, signed.token, consent);
    for (const patch of ['"creditSpendCurrency"=NULL', '"creditSpendMinor"=0', '"creditSpendCurrency"=\'ZZZ\'', '"creditAmount"=10', 'quantity=2']) {
      await expect(admin.query(`UPDATE "CartItem" SET ${patch} WHERE id=$1`, [item.id])).rejects.toMatchObject({ code: '23514' });
    }
    for (const patch of ['"totalMinor"="totalMinor"+1', '"totalOre"="totalOre"+1', 'currency=\'EUR\'',
      '"cartFingerprint"=repeat(\'b\',64)', '"quote"=jsonb_set(quote,\'{agreement}\',\'{}\')', '"settlementQuoteId"=NULL',
      '"requestKey"=\'different\'', '"userId"=\'different\'', '"createRequestId"=\'different\'', '"captureRequestId"=\'different\'']) {
      await expect(admin.query(`UPDATE "CheckoutAttempt" SET ${patch} WHERE "orderId"=$1`, [attempt.orderId])).rejects.toMatchObject({ code: '23514' });
    }
    await expect(admin.query('UPDATE "CheckoutAttempt" SET state=\'COMPLETED\' WHERE "orderId"=$1', [attempt.orderId])).rejects.toMatchObject({ code: '23514' });
    await admin.query('UPDATE "CheckoutAttempt" SET "paypalOrderId"=$2,"merchantId"=$3 WHERE "orderId"=$1', [attempt.orderId, randomUUID(), 'qa-merchant']);
    await expect(admin.query('UPDATE "CheckoutAttempt" SET "merchantId"=\'other\' WHERE "orderId"=$1', [attempt.orderId])).rejects.toMatchObject({ code: '23514' });
    await expect(admin.query('UPDATE "CheckoutAttempt" SET "refundedMinor"="totalMinor"+1 WHERE "orderId"=$1', [attempt.orderId])).rejects.toMatchObject({ code: '23514' });
    await expect(admin.query('UPDATE "CheckoutAttempt" SET "refundedOre"=1 WHERE "orderId"=$1', [attempt.orderId])).rejects.toMatchObject({ code: '23514' });
    expect((await db.checkoutAttempt.findUniqueOrThrow({ where: { orderId: attempt.orderId } })).state).toBe('PREPARED');
  });
  it('SQL rejects duplicate quote identity and mismatched native insert values', async () => {
    const { current, signed } = await exact('USD', '100');
    const attempt = await store().prepare(current.userId, signed.token, consent);
    const other = await db.order.create({ data: { userId: 'qa-other', totalAmount: 100, currency: 'USD' } });
    const copy = async (quoteId: string, currency: string | null, minor: number | null, fingerprint: string | null) => admin.query(`
      INSERT INTO "CheckoutAttempt" ("orderId","userId","requestKey",environment,"totalOre",currency,quote,
        "createRequestId","captureRequestId","settlementQuoteId","totalMinor","refundedMinor","cartFingerprint")
      SELECT $2,'qa-other',$3,environment,"totalOre",$4,quote,$7,$8,$3,$5,0,$6 FROM "CheckoutAttempt" WHERE "orderId"=$1`,
    [attempt.orderId, other.id, quoteId, currency, minor, fingerprint, randomUUID(), randomUUID()]);
    await expect(copy(signed.quoteId, 'USD', 10000, attempt.cartFingerprint)).rejects.toMatchObject({ code: '23505' });
    for (const [currency, minor, fingerprint] of [
      ['EUR', 10000, attempt.cartFingerprint], ['USD', 10001, attempt.cartFingerprint],
      ['USD', null, attempt.cartFingerprint], ['USD', 10000, null], ['USD', 10000, 'invalid'],
    ] as const) {
      await expect(copy(randomUUID(), currency, minor, fingerprint)).rejects.toMatchObject({ code: '23514' });
    }
    expect(await db.checkoutAttempt.count({ where: { orderId: other.id } })).toBe(0);
  });
});
