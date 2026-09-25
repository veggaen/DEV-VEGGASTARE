/** @fileOverview Transactional exact-price cart intent and immutable checkout preparation. Not activated by a route yet. */
import 'server-only';
import { isDeepStrictEqual } from 'node:util';
import type { Prisma, PrismaClient } from '@/generated/prisma/client';
import { z } from 'zod';
import { isDemoUserId } from '@/lib/demo-policy';
import { SHOWCASE_PRODUCTS } from '@/lib/showcase-catalog';
import { DEFAULT_PURCHASE_CREDITS, DAILY_PURCHASE_CAP_ORE, isPurchasableCreditAmount } from '@/lib/ai-credit-purchase';
import { productPurchaseState } from '@/lib/product-purchase-state';
import { CheckoutError } from './showcase-policy';
import { recordCheckoutAgreement, type DeliveryConsent } from './checkout-agreement';
import { SettlementCurrency, SettlementError, formatMinor } from './settlement-money';
import { quoteSettlementCart, readStoredSettlementQuote, settlementCreditEconomics, type SettlementFx, type SettlementSelection } from './settlement-quote';
import { issueSettlementQuoteToken, readSignedSettlementQuoteToken, settlementCartFingerprint, verifySettlementQuoteToken } from './settlement-quote-token';

const cartInclude = { CartItem: { include: { Product: { select: {
  id: true, productType: true, visibility: true, downloadsEnabled: true,
  Files: { select: { DigitalAsset: { select: { isActive: true, mimeType: true } } } },
} } } } } as const;
type StoredCart = Prisma.CartGetPayload<{ include: typeof cartInclude }>;
const Intent = z.discriminatedUnion('type', [
  z.object({ type: z.literal('spend'), currency: SettlementCurrency, amount: z.string().max(32) }).strict(),
  z.object({ type: z.literal('credits'), currency: SettlementCurrency, credits: z.number().refine(isPurchasableCreditAmount) }).strict(),
]);

function selectionForCart(cart: StoredCart, currency: SettlementCurrency): SettlementSelection {
  return { currency, items: cart.CartItem.map(item => {
    if (item.quantity !== 1) throw new CheckoutError('ONE_OF_EACH_REVIEWER_ITEM_PER_ORDER');
    if ((item.creditSpendMinor == null) !== (item.creditSpendCurrency == null)) throw new SettlementError('INVALID_SETTLEMENT_CART');
    if (item.creditSpendMinor != null && item.creditSpendCurrency !== currency) throw new SettlementError('SPEND_CURRENCY_CHANGED');
    return { productId: item.productId, quantity: 1,
      ...(item.productId === SHOWCASE_PRODUCTS.credits.id ? { credits: item.creditSpendMinor != null
        ? { type: 'spend' as const, amount: formatMinor(item.creditSpendMinor) }
        : { type: 'credits' as const, credits: item.creditAmount ?? DEFAULT_PURCHASE_CREDITS } } : {}),
    };
  }) };
}

function checkListings(cart: StoredCart) {
  for (const item of cart.CartItem) {
    if (productPurchaseState(item.Product) !== 'AVAILABLE') throw new CheckoutError('ITEM_UNAVAILABLE', 409);
    if (item.productId === SHOWCASE_PRODUCTS.interviewPack.id) {
      const assets = item.Product.Files.map(file => file.DigitalAsset);
      if (!assets.every(asset => asset.isActive) || !assets.some(asset => ['image/jpeg', 'image/png'].includes(asset.mimeType)) ||
          !assets.some(asset => asset.mimeType === 'text/plain')) throw new CheckoutError('DOWNLOADS_NOT_READY', 503);
    }
  }
}

async function lockCart(tx: Prisma.TransactionClient, userId: string) {
  const rows = await tx.$queryRaw<{ id: string }[]>`SELECT "id" FROM "Cart" WHERE "userId"=${userId} FOR UPDATE`;
  if (!rows.length) throw new SettlementError('EMPTY_CART');
  // Parent FOR UPDATE blocks new child FK inserts. Existing child edits/deletes
  // serialize on row locks, including older cart handlers without advisory locks.
  await tx.$queryRaw`SELECT "id" FROM "CartItem" WHERE "cartId"=${rows[0].id} ORDER BY "id" FOR UPDATE`;
  const cart = await tx.cart.findUnique({ where: { userId }, include: cartInclude });
  if (!cart || !cart.CartItem.length) throw new SettlementError('EMPTY_CART');
  return cart;
}

export function createSettlementStore(db: PrismaClient, config: {
  environment: 'LIVE' | 'SANDBOX'; secret: string; now?: () => number;
  models: readonly { credits: number; reserveMicroUsd: number }[]; modelCostReviewBy: string;
  readFx: (currency: SettlementCurrency) => Promise<SettlementFx | null>;
  paypalConfigured: () => boolean;
}) {
  const clock = config.now ?? Date.now;
  const environmentFor = (userId: string) => isDemoUserId(userId) ? 'DEMO' as const : config.environment;
  const buildQuote = (selection: SettlementSelection, fx: SettlementFx | null) => quoteSettlementCart(selection,
    { now: clock(), fx, models: config.models, modelCostReviewBy: config.modelCostReviewBy });

  return {
    /** Authentication/rate limits/origin checks belong to the calling route.
     * This read never creates an order or grants a demo allowance. */
    async quoteCart(userId: string, selectedCurrency: unknown) {
      const currency = SettlementCurrency.parse(selectedCurrency);
      const cart = await db.cart.findUnique({ where: { userId }, include: cartInclude });
      if (!cart || !cart.CartItem.length) throw new SettlementError('EMPTY_CART');
      checkListings(cart);
      const selection = selectionForCart(cart, currency), fx = await config.readFx(currency);
      const quote = buildQuote(selection, fx);
      const scope = { userId, environment: environmentFor(userId), cartFingerprint: settlementCartFingerprint(cart) };
      return { quote, ...issueSettlementQuoteToken(quote, scope, config.secret, clock()) };
    },

    /** Save a selected spend, not a client price or credit grant. The cached whole
     * count is recomputed by the server; a later checkout quotes fresh FX again. */
    async saveCreditIntent(userId: string, itemId: string, expectedUpdatedAt: string, input: unknown) {
      const intent = Intent.parse(input);
      if (!z.string().datetime().safeParse(expectedUpdatedAt).success) throw new SettlementError('INVALID_CART_REVISION');
      const fx = await config.readFx(intent.currency);
      const credits = intent.type === 'spend' ? { type: 'spend' as const, amount: intent.amount } : { type: 'credits' as const, credits: intent.credits };
      const quote = buildQuote({ currency: intent.currency, items: [{ productId: SHOWCASE_PRODUCTS.credits.id, quantity: 1, credits }] }, fx);
      const line = quote.lines[0];
      return db.$transaction(async tx => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`checkout:${userId}`}, 0))`;
        const cart = await lockCart(tx, userId), item = cart.CartItem.find(item => item.id === itemId);
        if (!item || item.productId !== SHOWCASE_PRODUCTS.credits.id) throw new CheckoutError('ITEM_UNAVAILABLE', 404);
        if (item.updatedAt.toISOString() !== expectedUpdatedAt) throw new CheckoutError('CART_CHANGED', 409);
        checkListings(cart);
        // Recheck quote time after waiting for locks; never save stale FX intent
        // as if its cached credit count were current. The spend itself is retained.
        if (clock() >= Date.parse(quote.expiresAt)) throw new SettlementError('SETTLEMENT_QUOTE_EXPIRED');
        return tx.cartItem.update({ where: { id: item.id }, data: { quantity: 1, creditAmount: line.credits,
          creditSpendMinor: intent.type === 'spend' ? line.amountMinor : null,
          creditSpendCurrency: intent.type === 'spend' ? intent.currency : null },
          select: { id: true, creditAmount: true, creditSpendMinor: true, creditSpendCurrency: true, updatedAt: true } });
      }, { maxWait: 10_000, timeout: 15_000 });
    },

    async prepare(userId: string, token: unknown, consent?: DeliveryConsent) {
      const signed = readSignedSettlementQuoteToken(token, config.secret), environment = environmentFor(userId);
      if (signed.scope.userId !== userId || signed.scope.environment !== environment) throw new SettlementError('SETTLEMENT_QUOTE_SCOPE_CHANGED');
      if (environment !== 'DEMO' && !config.paypalConfigured()) throw new CheckoutError('PAYPAL_NOT_CONFIGURED', 503);
      return db.$transaction(async tx => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`checkout:${userId}`}, 0))`;
        const prior = await tx.checkoutAttempt.findUnique({ where: { userId_requestKey: { userId, requestKey: signed.quoteId } } });
        if (prior) {
          if (prior.environment !== environment || prior.settlementQuoteId !== signed.quoteId || prior.cartFingerprint !== signed.scope.cartFingerprint) throw new SettlementError('SETTLEMENT_QUOTE_SCOPE_CHANGED');
          const stored = readStoredSettlementQuote((prior.quote as { settlement?: unknown }).settlement);
          if (!isDeepStrictEqual(stored, signed.quote) || prior.totalMinor !== stored.totalMinor ||
              prior.totalOre !== stored.exposureNokOre || prior.currency !== stored.currency) throw new SettlementError('SETTLEMENT_QUOTE_SCOPE_CHANGED');
          // Same frozen attempt on retries, even after cart edits/token expiry.
          // Capture/resume still enforce their own original payment time window.
          return prior;
        }
        const now = clock(), start = new Date(now); start.setUTCHours(0, 0, 0, 0);
        const attempts = await tx.checkoutAttempt.count({ where: { userId, environment, createdAt: { gte: start } } });
        if (attempts >= 2) throw new CheckoutError('DAILY_PURCHASE_LIMIT', 429);
        const cart = await lockCart(tx, userId);
        const { quote } = verifySettlementQuoteToken(token, { userId, environment, cartFingerprint: settlementCartFingerprint(cart) }, config.secret, clock());
        // New paid promises must remain within the current reviewed provider
        // policy, even if a previously signed quote has not yet expired.
        const reviewBy = Date.parse(config.modelCostReviewBy);
        if (!Number.isFinite(reviewBy) || clock() >= reviewBy) throw new CheckoutError('CREDIT_SALES_PAUSED', 503);
        for (const line of quote.lines) if (line.credits && !settlementCreditEconomics(line.credits, line.amountMinor, quote.currency, quote.fx?.rate ?? '1', config.models).eligible) {
          throw new CheckoutError('CREDIT_SALES_PAUSED', 503);
        }
        checkListings(cart);
        const exposure = await tx.checkoutAttempt.aggregate({ where: { userId, environment, createdAt: { gte: start } }, _sum: { totalOre: true } });
        if ((exposure._sum.totalOre ?? 0) + quote.exposureNokOre > DAILY_PURCHASE_CAP_ORE) throw new CheckoutError('DAILY_PURCHASE_AMOUNT_LIMIT', 429);
        const agreement = recordCheckoutAgreement(quote, consent, environment === 'DEMO', new Date(now));
        const order = await tx.order.create({ data: { userId, totalAmount: quote.totalMinor / 100, currency: quote.currency, status: 'PENDING',
          commentOrder: environment === 'DEMO' ? 'Demo preview — no payment collected' : 'Veggat Studio checkout',
          OrderItem: { create: quote.lines.map(line => ({ productId: line.productId, title: line.title, quantity: 1, priceAtTime: line.amountMinor / 100 })) },
        } });
        return tx.checkoutAttempt.create({ data: { orderId: order.id, userId, environment, requestKey: signed.quoteId,
          settlementQuoteId: signed.quoteId, cartFingerprint: signed.scope.cartFingerprint, currency: quote.currency,
          totalOre: quote.exposureNokOre, totalMinor: quote.totalMinor, refundedMinor: 0, createdAt: new Date(now),
          quote: { settlement: quote, agreement, cartLines: cart.CartItem.map(item => ({ id: item.id, productId: item.productId,
            updatedAt: item.updatedAt.toISOString(), creditAmount: item.creditAmount,
            creditSpendMinor: item.creditSpendMinor, creditSpendCurrency: item.creditSpendCurrency })) },
        } });
      }, { maxWait: 10_000, timeout: 15_000 });
    },
  };
}
