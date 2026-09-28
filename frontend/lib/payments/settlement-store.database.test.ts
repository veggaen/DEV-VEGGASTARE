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
import { applyAiCreditDelta } from '@/lib/ai-credit-adjustment';
vi.mock('server-only', () => ({}));
// Factories receive only the disposable database. Never initialize the app's
// default database connection or use an authenticated provider in this suite.
vi.mock('@/lib/db', () => ({ dbPrisma: {} }));
import { createSettlementStore } from './settlement-store';
import { createCheckoutCompletion } from './showcase-store';
import { createPayPalAdjustmentReconciler } from './showcase-refunds';
import { CHECKOUT_AGREEMENT_VERSION, recordCheckoutAgreement } from './checkout-agreement';
import { quoteShowcaseCart } from './showcase-policy';
import { quoteSettlementCart, readStoredSettlementQuote, type SettlementFx } from './settlement-quote';
import { readSignedSettlementQuoteToken } from './settlement-quote-token';
import { formatMinor, type SettlementCurrency } from './settlement-money';
import { readCapturedPaymentTotals } from './checkout-reporting';

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
    const tables = ['Cart', 'CartItem', 'Product', 'DigitalProductFile', 'DigitalAsset', 'Order', 'OrderItem', 'CheckoutAttempt',
      'AiCreditAccount', 'AiCreditEntry', 'Payment', 'PaymentWebhookEvent', 'DownloadToken', 'TransactionalEmail'];
    for (const table of tables) await admin.query(`CREATE TABLE "${schema}"."${table}" (LIKE public."${table}" INCLUDING ALL)`);
    // After Preview is migrated, reconstruct only this EMPTY private fixture's
    // previous shape so the additive migration remains tested from v1. Never
    // drop columns or constraints in public or copy real checkout rows.
    const migratedShape = (await admin.query(`SELECT 1 FROM information_schema.columns
      WHERE table_schema=$1 AND table_name='CheckoutAttempt' AND column_name='totalMinor'`, [schema])).rowCount;
    if (migratedShape) {
      await admin.query(`ALTER TABLE "${schema}"."CheckoutAttempt" DROP CONSTRAINT "CheckoutAttempt_settlement_money_check",
        DROP COLUMN "totalMinor", DROP COLUMN "refundedMinor", DROP COLUMN "settlementQuoteId", DROP COLUMN "cartFingerprint";
        ALTER TABLE "${schema}"."CheckoutAttempt" ADD CONSTRAINT "CheckoutAttempt_currency_check" CHECK (currency='NOK'),
          ADD CONSTRAINT "CheckoutAttempt_totalOre_check" CHECK ("totalOre" BETWEEN 1 AND 355070);
        ALTER TABLE "${schema}"."CartItem" DROP CONSTRAINT "CartItem_credit_spend_check", DROP COLUMN "creditSpendMinor", DROP COLUMN "creditSpendCurrency";`);
    }
    // LIKE copies shape/defaults/checks/indexes only. It copies NO customer data,
    // FKs or triggers. Recreate enum types locally so Prisma casts stay isolated.
    const enums = ['OrderStatus', 'FulfilmentStatus', 'FiatCurrency', 'ProductCondition', 'ProductType', 'ProductVisibility', 'StorageProvider', 'PaymentMethod', 'PaymentStatus', 'ChainFamily'];
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
      ['Payment', 'method', 'PaymentMethod', ''], ['Payment', 'status', 'PaymentStatus', 'PENDING'], ['Payment', 'chainFamily', 'ChainFamily', ''],
    ]) {
      const cast = `"${schema}"."${type.replace('[]', '')}"${type.endsWith('[]') ? '[]' : ''}`;
      await admin.query(`ALTER TABLE "${schema}"."${table}" ALTER COLUMN "${column}" DROP DEFAULT,
        ALTER COLUMN "${column}" TYPE ${cast} USING "${column}"::text::${cast}`);
      if (defaultValue) await admin.query(`ALTER TABLE "${schema}"."${table}" ALTER COLUMN "${column}" SET DEFAULT '${defaultValue}'::${cast}`);
    }
    // Real FK enforcement is essential to testing the parent's insert lock.
    await admin.query(`ALTER TABLE "CartItem" ADD FOREIGN KEY ("cartId") REFERENCES "Cart"(id),
      ADD FOREIGN KEY ("productId") REFERENCES "Product"(id)`);
    await admin.query(`ALTER TABLE "CheckoutAttempt" ADD FOREIGN KEY ("orderId") REFERENCES "Order"(id)`);
    await admin.query(`ALTER TABLE "OrderItem" ADD FOREIGN KEY ("orderId") REFERENCES "Order"(id),
      ADD FOREIGN KEY ("productId") REFERENCES "Product"(id)`);
    await admin.query(`ALTER TABLE "Payment" ADD FOREIGN KEY ("orderId") REFERENCES "Order"(id)`);
    await admin.query(`ALTER TABLE "AiCreditEntry" ADD FOREIGN KEY ("accountId") REFERENCES "AiCreditAccount"(id)`);
    await admin.query(`ALTER TABLE "DownloadToken" ADD FOREIGN KEY ("orderId") REFERENCES "Order"(id),
      ADD FOREIGN KEY ("digitalAssetId") REFERENCES "DigitalAsset"(id)`);
    // Only the fields needed for outbox recipient selection; no auth identities,
    // passwords, sessions or production-user data are copied into this fixture.
    await admin.query('CREATE TABLE "User" (id TEXT PRIMARY KEY, email TEXT, "emailVerified" TIMESTAMP(3))');
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
    await admin.query('INSERT INTO "User" (id,email,"emailVerified") VALUES ($1,$2,now()) ON CONFLICT DO NOTHING', [userId, `${userId}@example.invalid`]);
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
    expect(await db.aiCreditEntry.count({ where: { sourceKey: `checkout:${attempt.orderId}` } })).toBe(0);
    expect(await db.payment.count({ where: { orderId: attempt.orderId } })).toBe(0);
    expect(await db.downloadToken.count({ where: { orderId: attempt.orderId } })).toBe(0);
    expect(await db.transactionalEmail.count({ where: { orderId: attempt.orderId } })).toBe(0);
  });
  it('keeps the credit and file lines separate in one exact-currency order', async () => {
    const { current, signed } = await exact('USD', '100', true);
    const attempt = await store().prepare(current.userId, signed.token, { ...consent, files: true });
    const lines = await db.orderItem.findMany({ where: { orderId: attempt.orderId } });
    expect(lines).toHaveLength(2);
    expect(lines.find(line => line.productId === creditSku)?.priceAtTime).toBe(100);
    expect(lines.find(line => line.productId === fileSku)?.priceAtTime).toBe(signed.quote.lines.find(line => line.kind === 'DIGITAL_FILES')!.amountMinor / 100);
  });
  it('adds exact spend atomically and replaces the same credit line without an intermediate count price', async () => {
    const current = await cart();
    await db.cartItem.deleteMany({ where: { cartId: current.id } });
    const item = await store().addCreditIntent(current.userId, { type: 'spend', currency: 'USD', amount: '100' });
    expect(item).toMatchObject({ quantity: 1, creditSpendMinor: 10000, creditSpendCurrency: 'USD' });
    const changed = await store().addCreditIntent(current.userId, { type: 'credits', currency: 'NOK', credits: 555 });
    expect(changed).toMatchObject({ id: item.id, creditAmount: 555, creditSpendMinor: null, creditSpendCurrency: null });
    expect(await db.cartItem.count({ where: { cartId: current.id } })).toBe(1);
    expect(await db.order.count({ where: { userId: current.userId } })).toBe(0);
  });
  it('rolls back a product-page add when the credit listing is unavailable', async () => {
    const current = await cart(), before = current.CartItem[0];
    await db.product.update({ where: { id: creditSku }, data: { visibility: 'HIDDEN' } });
    try {
      await expect(store().addCreditIntent(current.userId, { type: 'spend', currency: 'USD', amount: '100' })).rejects.toThrow('ITEM_UNAVAILABLE');
      expect(await db.cartItem.findUnique({ where: { id: before.id } })).toMatchObject({ creditAmount: 100, creditSpendMinor: null });
    } finally { await db.product.update({ where: { id: creditSku }, data: { visibility: 'PUBLIC' } }); }
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
    for (const agreement of [undefined, consent, { ...consent, files: true, credits: false },
      { ...consent, files: true, version: '2026-09-25.1' }]) {
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
    // A release changing the HTTP consent version must not block an already
    // frozen purchase or replace its original agreement on retry.
    const oldClientRetry = await store({ now: () => initialNow + 86400000 }).prepare(current.userId, signed.token,
      { ...consent, version: '2026-09-24.2' });
    expect(oldClientRetry).toEqual(attempts[0]);
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

  async function prepared(withFile = true, currency: SettlementCurrency = 'USD') {
    const data = await exact(currency, '100', withFile);
    const pending = await store().prepare(data.current.userId, data.signed.token, { ...consent, files: withFile });
    const attempt = await db.checkoutAttempt.update({ where: { orderId: pending.orderId }, data: {
      paypalOrderId: randomUUID().replaceAll('-', '').toUpperCase(), merchantId: 'QAMERCHANT', state: 'APPROVAL_PENDING',
    } });
    const captureId = randomUUID().replaceAll('-', '').toUpperCase();
    const amount = { currency_code: String(currency), value: formatMinor(data.signed.quote.totalMinor) };
    const proof = { id: attempt.paypalOrderId!, status: 'COMPLETED', purchase_units: [{
      reference_id: attempt.orderId, invoice_id: attempt.orderId, custom_id: attempt.orderId, amount,
      payee: { merchant_id: attempt.merchantId }, payments: { captures: [{ id: captureId, status: 'COMPLETED', final_capture: true, amount: { ...amount } }] },
    }] };
    const provider = { capturePayPalOrder: vi.fn(async (_id: string, _requestId: string) => proof), readPayPalOrder: vi.fn(async () => proof) };
    const complete = createCheckoutCompletion(db, provider, () => initialNow + 1000);
    return { ...data, attempt, captureId, proof, provider, complete };
  }
  function adjustmentProvider(data: Awaited<ReturnType<typeof prepared>>, status = 'REFUNDED', refunded = data.signed.quote.totalMinor) {
    const refundId = randomUUID().replaceAll('-', '').toUpperCase();
    const provider = {
      readPayPalCapture: vi.fn(async () => ({ id: data.captureId, status,
        amount: { currency_code: data.signed.quote.currency, value: formatMinor(data.signed.quote.totalMinor) }, invoice_id: data.attempt.orderId,
        payee: { merchant_id: data.attempt.merchantId }, supplementary_data: { related_ids: { order_id: data.attempt.paypalOrderId } } })),
      readPayPalRefund: vi.fn(async () => ({ id: refundId, status: 'COMPLETED', amount: { currency_code: data.signed.quote.currency, value: formatMinor(refunded) },
        seller_payable_breakdown: { total_refunded_amount: { currency_code: data.signed.quote.currency, value: formatMinor(refunded) } },
        links: [{ rel: 'up', method: 'GET', href: `https://api-m.sandbox.paypal.com/v2/payments/captures/${data.captureId}` }] })),
    };
    return { reconcile: createPayPalAdjustmentReconciler(db, provider), provider,
      event: { id: randomUUID(), event_type: 'PAYMENT.CAPTURE.REFUNDED' as const, resource: { id: refundId } } };
  }
  it('atomically grants a mixed exact-currency purchase once across simultaneous capture responses', async () => {
    const data = await prepared();
    const results = await Promise.all(Array.from({ length: 5 }, () => data.complete(data.attempt.orderId, data.current.userId)));
    expect(results.filter(result => !result.alreadyCompleted)).toHaveLength(1);
    expect(data.provider.capturePayPalOrder).toHaveBeenCalledWith(data.attempt.paypalOrderId, data.attempt.captureRequestId);
    expect(data.provider.capturePayPalOrder.mock.calls.every(args => args[0] === data.attempt.paypalOrderId && args[1] === data.attempt.captureRequestId)).toBe(true);
    expect(await db.aiCreditEntry.count({ where: { sourceKey: `checkout:${data.attempt.orderId}` } })).toBe(1);
    expect((await db.aiCreditAccount.findUniqueOrThrow({ where: { id: `SANDBOX:${data.current.userId}` } })).balance).toBe(data.signed.quote.lines.find(line => line.credits > 0)!.credits);
    expect(await db.downloadToken.count({ where: { orderId: data.attempt.orderId } })).toBe(2);
    const payment = await db.payment.findUniqueOrThrow({ where: { orderId: data.attempt.orderId } });
    expect(payment).toMatchObject({ tokenSymbol: 'USD', nativeAmount: formatMinor(data.signed.quote.totalMinor), transactionId: data.captureId });
    expect(await db.cartItem.count({ where: { cartId: data.current.id } })).toBe(0);
    const packet = await db.transactionalEmail.findUniqueOrThrow({ where: { sourceKey: `purchase:${data.attempt.orderId}` } });
    expect(packet.status).toBe('SKIPPED'); // .invalid recipient can NEVER send.
    const text = (packet.payload as { text: string }).text;
    expect(text).toContain(`Confirmed total: ${formatMinor(data.signed.quote.totalMinor)} USD`);
    expect(text).not.toContain(`${formatMinor(data.signed.quote.exposureNokOre)} NOK`);
  }, 30_000);
  it('preserves a changed or re-added cart revision when the original payment completes', async () => {
    const data = await prepared(false), item = data.current.CartItem[0];
    await db.cartItem.delete({ where: { id: item.id } });
    const next = await db.cartItem.create({ data: { cartId: data.current.id, productId: creditSku, quantity: 1,
      creditAmount: data.saved.creditAmount, creditSpendMinor: 10000, creditSpendCurrency: 'USD' } });
    await data.complete(data.attempt.orderId, data.current.userId);
    expect(await db.cartItem.findUnique({ where: { id: next.id } })).not.toBeNull();
  });
  it('returns a committed payment when another request finishes before a delayed capture claim', async () => {
    const data = await prepared(false), reached = latch(), proceed = latch();
    const delayedDb = db.$extends({ query: { checkoutAttempt: { async updateMany({args,query}) {
      reached.release(); await proceed.promise; return query(args);
    } } } }) as unknown as PrismaClient;
    const delayedComplete = createCheckoutCompletion(delayedDb,data.provider,()=>initialNow+1000);
    const delayed = delayedComplete(data.attempt.orderId,data.current.userId);
    try {
      await Promise.race([reached.promise,delayed.then(()=>{throw new Error('Expected capture barrier');})]);
      await data.complete(data.attempt.orderId,data.current.userId);
    } finally {proceed.release();}
    expect(await delayed).toMatchObject({alreadyCompleted:true});
    expect(data.provider.capturePayPalOrder).toHaveBeenCalledTimes(1);
    expect(await db.aiCreditEntry.count({where:{sourceKey:`checkout:${data.attempt.orderId}`}})).toBe(1);
  },20000);
  it.each(['NOK', 'USD', 'EUR', 'GBP', 'SEK', 'DKK'] as const)('retains %s 100.00 through native capture, confirmation, reports and full refund', async currency => {
    const readTotals = () => db.$transaction(tx => readCapturedPaymentTotals(tx, 'SANDBOX'));
    const before = (await readTotals()).currencies.find(row => row.currency === currency);
    const data = await prepared(false, currency); await data.complete(data.attempt.orderId, data.current.userId);
    expect((await readTotals()).currencies.find(row => row.currency === currency)).toEqual({ currency,
      captures: (before?.captures ?? 0) + 1, grossMinor: (before?.grossMinor ?? 0) + 10000, refundedMinor: before?.refundedMinor ?? 0 });
    const packet = await db.transactionalEmail.findUniqueOrThrow({ where: { sourceKey: `purchase:${data.attempt.orderId}` } });
    expect((packet.payload as { text: string }).text).toContain(`Confirmed total: 100.00 ${currency}`);
    expect((await db.payment.findUniqueOrThrow({ where: { orderId: data.attempt.orderId } }))).toMatchObject({ tokenSymbol: currency, nativeAmount: '100.00' });
    const refund = adjustmentProvider(data); await refund.reconcile(refund.event);
    expect((await db.checkoutAttempt.findUniqueOrThrow({ where: { orderId: data.attempt.orderId } }))).toMatchObject({ currency, totalMinor: 10000, refundedMinor: 10000, refundedOre: 0, state: 'REFUNDED' });
    expect((await readTotals()).currencies.find(row => row.currency === currency)).toEqual({ currency,
      captures: (before?.captures ?? 0) + 1, grossMinor: (before?.grossMinor ?? 0) + 10000, refundedMinor: (before?.refundedMinor ?? 0) + 10000 });
  }, 15_000);
  it.each(['currency', 'amount'] as const)('does not grant anything after a provider %s mismatch', async mismatch => {
    const data = await prepared(false);
    data.proof.purchase_units[0].payments.captures[0].amount[mismatch === 'currency' ? 'currency_code' : 'value'] = mismatch === 'currency' ? 'NOK' : '99.97';
    await expect(data.complete(data.attempt.orderId, data.current.userId)).rejects.toThrow('PAYMENT_BINDING_MISMATCH');
    expect(await db.aiCreditEntry.count({ where: { sourceKey: `checkout:${data.attempt.orderId}` } })).toBe(0);
    expect(await db.transactionalEmail.count({ where: { orderId: data.attempt.orderId } })).toBe(0);
    expect(await db.payment.count({ where: { orderId: data.attempt.orderId } })).toBe(0);
  });
  it('rolls back the grant and fulfillment when private files disappear after preparation', async () => {
    const data = await prepared();
    try {
      await db.digitalAsset.updateMany({ where: { mimeType: 'text/plain' }, data: { isActive: false } });
      await expect(data.complete(data.attempt.orderId, data.current.userId)).rejects.toThrow('DOWNLOADS_NOT_READY');
      expect(await db.aiCreditEntry.count({ where: { sourceKey: `checkout:${data.attempt.orderId}` } })).toBe(0);
      expect(await db.downloadToken.count({ where: { orderId: data.attempt.orderId } })).toBe(0);
      expect(await db.payment.count({ where: { orderId: data.attempt.orderId } })).toBe(0);
      expect((await db.checkoutAttempt.findUniqueOrThrow({ where: { orderId: data.attempt.orderId } })).captureId).toBeNull();
    } finally { await db.digitalAsset.updateMany({ data: { isActive: true } }); }
    await data.complete(data.attempt.orderId, data.current.userId, false);
    expect(await db.aiCreditEntry.count({ where: { sourceKey: `checkout:${data.attempt.orderId}` } })).toBe(1);
  });
  it('revokes once after partial then full native refunds, preserving the original confirmation', async () => {
    const data = await prepared(); await data.complete(data.attempt.orderId, data.current.userId);
    const original = await db.transactionalEmail.findUniqueOrThrow({ where: { sourceKey: `purchase:${data.attempt.orderId}` } });
    const partial = adjustmentProvider(data, 'PARTIALLY_REFUNDED', 2500);
    const results = await Promise.all(Array.from({ length: 5 }, () => partial.reconcile(partial.event)));
    expect(results.filter(result => !('duplicate' in result))).toHaveLength(1);
    expect((await db.checkoutAttempt.findUniqueOrThrow({ where: { orderId: data.attempt.orderId } }))).toMatchObject({ state: 'PAYMENT_REVIEW', refundedMinor: 2500, refundedOre: 0 });
    expect(await db.downloadToken.count({ where: { orderId: data.attempt.orderId, isRevoked: false } })).toBe(0);
    const full = adjustmentProvider(data); await full.reconcile(full.event);
    expect((await db.checkoutAttempt.findUniqueOrThrow({ where: { orderId: data.attempt.orderId } }))).toMatchObject({ state: 'REFUNDED', refundedMinor: data.signed.quote.totalMinor, refundedOre: 0 });
    expect(await db.aiCreditEntry.count({ where: { sourceKey: `paypal-revoke:${data.attempt.orderId}` } })).toBe(1);
    expect((await db.transactionalEmail.findUniqueOrThrow({ where: { id: original.id } })).payload).toEqual(original.payload);
    await expect(data.complete(data.attempt.orderId, data.current.userId, false)).rejects.toThrow('ORDER_PAYMENT_ADJUSTED');
    const evidence = await db.paymentWebhookEvent.findFirstOrThrow({ where: { deliveryId: full.event.id } });
    expect(evidence.rawPayload).toMatchObject({ amountMinor: data.signed.quote.totalMinor, currency: 'USD' });
    expect(evidence.rawPayload).not.toHaveProperty('amountOre');
  }, 30_000);
  it('handles a refund arriving before completion without ever granting access', async () => {
    const data = await prepared(), refund = adjustmentProvider(data);
    await refund.reconcile(refund.event);
    await expect(data.complete(data.attempt.orderId, data.current.userId, false)).rejects.toThrow('ORDER_PAYMENT_ADJUSTED');
    expect(await db.aiCreditEntry.count({ where: { sourceKey: `checkout:${data.attempt.orderId}` } })).toBe(0);
    expect(await db.downloadToken.count({ where: { orderId: data.attempt.orderId } })).toBe(0);
  });
  it('rejects a mismatched refund currency without revoking purchased access', async () => {
    const data = await prepared(false); await data.complete(data.attempt.orderId, data.current.userId);
    const refund = adjustmentProvider(data), response = await refund.provider.readPayPalRefund();
    response.amount.currency_code = 'NOK'; response.seller_payable_breakdown.total_refunded_amount.currency_code = 'NOK';
    refund.provider.readPayPalRefund.mockResolvedValue(response);
    await expect(refund.reconcile(refund.event)).rejects.toThrow('REFUND_AMOUNT_INVALID');
    expect((await db.checkoutAttempt.findUniqueOrThrow({ where: { orderId: data.attempt.orderId } })).state).toBe('COMPLETED');
    expect(await db.aiCreditEntry.count({ where: { sourceKey: `paypal-revoke:${data.attempt.orderId}` } })).toBe(0);
  });
  it('refuses an order-line substitution before capture or granting a private file', async () => {
    const data = await prepared(false);
    await db.orderItem.updateMany({ where: { orderId: data.attempt.orderId }, data: { productId: fileSku } });
    await expect(data.complete(data.attempt.orderId, data.current.userId)).rejects.toThrow('ORDER_QUOTE_MISMATCH');
    expect(data.provider.capturePayPalOrder).not.toHaveBeenCalled();
    expect(await db.downloadToken.count({ where: { orderId: data.attempt.orderId } })).toBe(0);
  });
  it('records a spent-credit refund adjustment without making available balance negative', async () => {
    const data = await prepared(false); await data.complete(data.attempt.orderId, data.current.userId);
    const accountId = `SANDBOX:${data.current.userId}`, credits = data.signed.quote.lines[0].credits;
    await db.$transaction(async tx => {
      await applyAiCreditDelta(tx, accountId, -credits);
      await tx.aiCreditEntry.create({ data: { accountId, delta: -credits, kind: 'QA_USAGE', sourceKey: `qa-consumed:${data.attempt.orderId}` } });
    });
    const refund = adjustmentProvider(data); await refund.reconcile(refund.event); await refund.reconcile(refund.event);
    expect((await db.aiCreditAccount.findUniqueOrThrow({ where: { id: accountId } }))).toMatchObject({ balance: 0, refundAdjustment: credits });
  });
  it('still captures, confirms and refunds a legacy NOK purchase using only legacy cash fields', async () => {
    const current = await cart(), quote = quoteShowcaseCart([{ productId: creditSku, quantity: 1 }]);
    const order = await db.order.create({ data: { userId: current.userId, totalAmount: 39, currency: 'NOK',
      OrderItem: { create: quote.lines.map(line => ({ productId: line.productId, title: line.title, quantity: 1, priceAtTime: line.amountOre / 100 })) } } });
    const paypalOrderId = randomUUID().replaceAll('-', '').toUpperCase(), captureId = randomUUID().replaceAll('-', '').toUpperCase();
    await db.checkoutAttempt.create({ data: { orderId: order.id, userId: current.userId, requestKey: randomUUID(), environment: 'SANDBOX',
      totalOre: 3900, quote: { ...quote, agreement: recordCheckoutAgreement(quote, consent, false, new Date(initialNow)) },
      paypalOrderId, merchantId: 'QAMERCHANT', state: 'APPROVAL_PENDING', createdAt: new Date(initialNow) } });
    const amount = { currency_code: 'NOK', value: '39.00' };
    const proof = { id: paypalOrderId, status: 'COMPLETED', purchase_units: [{ reference_id: order.id, invoice_id: order.id,
      custom_id: order.id, amount, payee: { merchant_id: 'QAMERCHANT' }, payments: { captures: [{ id: captureId, status: 'COMPLETED', final_capture: true, amount }] } }] };
    const complete = createCheckoutCompletion(db, { capturePayPalOrder: vi.fn(async () => proof), readPayPalOrder: vi.fn(async () => proof) }, () => initialNow + 1000);
    await complete(order.id, current.userId);
    expect((await db.payment.findUniqueOrThrow({ where: { orderId: order.id } }))).toMatchObject({ tokenSymbol: 'NOK', nativeAmount: '39.00' });
    const refundId = randomUUID().replaceAll('-', '').toUpperCase();
    const reconcile = createPayPalAdjustmentReconciler(db, {
      readPayPalCapture: async () => ({ id: captureId, status: 'REFUNDED', amount, invoice_id: order.id, payee: { merchant_id: 'QAMERCHANT' }, supplementary_data: { related_ids: { order_id: paypalOrderId } } }),
      readPayPalRefund: async () => ({ id: refundId, status: 'COMPLETED', amount, links: [{ rel: 'up', method: 'GET', href: `https://api-m.sandbox.paypal.com/v2/payments/captures/${captureId}` }] }),
    });
    await reconcile({ id: randomUUID(), event_type: 'PAYMENT.CAPTURE.REFUNDED', resource: { id: refundId } });
    expect((await db.checkoutAttempt.findUniqueOrThrow({ where: { orderId: order.id } }))).toMatchObject({ state: 'REFUNDED', refundedOre: 3900, refundedMinor: null, totalMinor: null });
    expect((await db.aiCreditAccount.findUniqueOrThrow({ where: { id: `SANDBOX:${current.userId}` } })).balance).toBe(0);
    const packet = await db.transactionalEmail.findUniqueOrThrow({ where: { sourceKey: `purchase:${order.id}` } });
    expect((packet.payload as { text: string }).text).toContain('Confirmed total: 39.00 NOK');
  });
});
