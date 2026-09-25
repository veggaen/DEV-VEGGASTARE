/** @fileOverview Transactional checkout and idempotent entitlement grants. @stability experimental */
import 'server-only';
import { randomBytes } from 'node:crypto';
import type { PrismaClient } from '@/generated/prisma/client';
import { dbPrisma } from '@/lib/db';
import { isDemoUserId } from '@/lib/demo-policy';
import { CheckoutError, paypalEnvironment, quoteShowcaseCart } from './showcase-policy';
import { capturePayPalOrder, createPayPalOrder, paypalConfigured, readPayPalOrder } from './showcase-paypal';
import { applyAiCreditDelta } from '@/lib/ai-credit-adjustment';
import { creditSaleEconomics, DAILY_PURCHASE_CAP_ORE } from '@/lib/ai-credit-purchase';
import { FUNDED_AI_MODELS, pricingIsReviewed } from '@/lib/ai-chat/credit-policy';
import { MEDIA_MODELS } from '@/lib/ai-media/policy';
import { purchaseConfirmation, recordCheckoutAgreement, type DeliveryConsent } from './checkout-agreement';
import { queueTransactionEmail } from './email-outbox';
import { productPurchaseState } from '@/lib/product-purchase-state';
import { checkoutExpiresAt } from './checkout-recovery-policy';
import { assertCheckoutOrder, checkoutMoney, purchasedCartFilters, verifyCheckoutCapture } from './checkout-money';
import { formatMinor } from './settlement-money';

const includeOrder = { Order: { include: { OrderItem: true } } } as const;
function filesReady(files: { DigitalAsset: { isActive: boolean; mimeType: string } }[]) {
  return files.every(file => file.DigitalAsset.isActive) &&
    files.some(file => ['image/jpeg', 'image/png'].includes(file.DigitalAsset.mimeType)) &&
    files.some(file => file.DigitalAsset.mimeType === 'text/plain');
}

export async function prepareShowcaseCheckout(userId: string, requestKey: string, expectedQuote?: string, consent?: DeliveryConsent) {
  const environment = isDemoUserId(userId) ? 'DEMO' : paypalEnvironment().mode;
  if (environment !== 'DEMO' && !paypalConfigured()) throw new CheckoutError('PAYPAL_NOT_CONFIGURED', 503);
  return dbPrisma.$transaction(async tx => {
    // Serialize caps and idempotency across all serverless replicas.
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`checkout:${userId}`}, 0))`;
    const prior = await tx.checkoutAttempt.findUnique({ where: { userId_requestKey: { userId, requestKey } } });
    if (prior) {
      if (prior.environment !== environment) throw new CheckoutError('WRONG_PAYMENT_ENVIRONMENT', 409);
      return prior;
    }
    const start = new Date(); start.setUTCHours(0, 0, 0, 0);
    const attempts = await tx.checkoutAttempt.count({ where: { userId, environment, createdAt: { gte: start } } });
    // Includes pending/failed-network attempts: repeated checkout cannot drain a card.
    if (attempts >= 2) throw new CheckoutError('DAILY_PURCHASE_LIMIT', 429);
    const cart = await tx.cart.findUnique({ where: { userId }, include: { CartItem: { include: { Product: { include: { Files: { include: { DigitalAsset: true } } } } } } } });
    // Old clients must not turn an exact-spend selection into a NOK count quote.
    if (cart?.CartItem.some(item => item.creditSpendMinor != null || item.creditSpendCurrency != null)) throw new CheckoutError('EXACT_QUOTE_REQUIRED', 409);
    const quote = quoteShowcaseCart(cart?.CartItem.map(item => ({ productId: item.productId, quantity: item.quantity, creditAmount: item.creditAmount })) ?? []);
    // The browser may assert what it saw, never set a price. A cross-tab cart
    // edit requires another review instead of silently charging a changed total.
    if (expectedQuote !== undefined && expectedQuote !== JSON.stringify(quote)) throw new CheckoutError('CART_CHANGED', 409);
    const agreement = recordCheckoutAgreement(quote, consent, environment === 'DEMO');
    for (const line of quote.lines) {
      if (line.credits && (!pricingIsReviewed() || !creditSaleEconomics(line.credits, [...FUNDED_AI_MODELS, ...Object.values(MEDIA_MODELS)]).eligible)) {
        throw new CheckoutError('CREDIT_SALES_PAUSED', 503);
      }
    }
    const exposure = await tx.checkoutAttempt.aggregate({ where: { userId, environment, createdAt: { gte: start } }, _sum: { totalOre: true } });
    if ((exposure._sum.totalOre ?? 0) + quote.totalOre > DAILY_PURCHASE_CAP_ORE) throw new CheckoutError('DAILY_PURCHASE_AMOUNT_LIMIT', 429);
    for (const item of cart!.CartItem) {
      if (productPurchaseState({ ...item.Product, id: item.productId }) !== 'AVAILABLE') throw new CheckoutError('ITEM_UNAVAILABLE', 409);
      if (quote.lines.find(line => line.productId === item.productId)?.kind === 'DIGITAL_FILES' &&
          !filesReady(item.Product.Files)) {
        throw new CheckoutError('DOWNLOADS_NOT_READY', 503);
      }
    }
    const order = await tx.order.create({ data: {
      userId, totalAmount: quote.totalOre / 100, currency: 'NOK', status: 'PENDING',
      commentOrder: environment === 'DEMO' ? 'Demo preview — no payment collected' : 'Veggat Studio checkout',
      OrderItem: { create: quote.lines.map(line => ({ productId: line.productId, title: line.title, quantity: 1, priceAtTime: line.amountOre / 100 })) },
    } });
    return tx.checkoutAttempt.create({ data: { orderId: order.id, userId, requestKey, environment,
      totalOre: quote.totalOre, quote: { ...quote, agreement }, currency: 'NOK' } });
  }, { timeout: 15_000 });
}

export async function beginShowcaseCheckout(userId: string, requestKey: string, expectedQuote?: string, consent?: DeliveryConsent) {
  const attempt = await prepareShowcaseCheckout(userId, requestKey, expectedQuote, consent);
  if (attempt.state === 'COMPLETED') return { orderId: attempt.orderId, completed: true };
  if (['CANCELLED', 'CANCEL_PENDING'].includes(attempt.state)) throw new CheckoutError('ORDER_CANCELLED', 409);
  if (attempt.state === 'CAPTURE_PENDING') throw new CheckoutError('PAYMENT_STATUS_UNCERTAIN', 409);
  if (['REFUNDED', 'REVERSED', 'PAYMENT_REVIEW'].includes(attempt.state)) throw new CheckoutError('ORDER_PAYMENT_ADJUSTED', 409);
  if (attempt.environment === 'DEMO') return { orderId: attempt.orderId, demo: true };
  // Never retry creation outside PayPal's shortest idempotency retention window.
  if (Date.now() >= checkoutExpiresAt(attempt.createdAt).getTime()) throw new CheckoutError('CHECKOUT_EXPIRED', 409);
  if (attempt.approvalUrl) return { orderId: attempt.orderId, approvalUrl: attempt.approvalUrl };
  const created = await createPayPalOrder(attempt.orderId, checkoutMoney(attempt).quote, attempt.createRequestId);
  const saved = await dbPrisma.checkoutAttempt.updateMany({ where: { orderId: attempt.orderId, state: 'PREPARED' }, data: { ...created, state: 'APPROVAL_PENDING' } });
  if (saved.count !== 1) throw new CheckoutError('ORDER_CHANGED', 409);
  return { orderId: attempt.orderId, approvalUrl: created.approvalUrl };
}

/** Only this function can grant these entitlements. It obtains its own proof
 * from PayPal; no caller can supply a fake COMPLETED browser/webhook payload. */
export function createCheckoutCompletion(db: PrismaClient, provider = { capturePayPalOrder, readPayPalOrder }, clock = Date.now) {
  return (orderId: string, userId: string, capture = true) => completeCheckout({ db, provider, clock }, orderId, userId, capture);
}

async function completeCheckout({ db, provider, clock }: {
  db: PrismaClient; provider: { capturePayPalOrder: typeof capturePayPalOrder; readPayPalOrder: typeof readPayPalOrder }; clock: () => number;
}, orderId: string, userId: string, capture: boolean) {
  const attempt = await db.checkoutAttempt.findUnique({ where: { orderId }, include: includeOrder });
  if (!attempt || attempt.userId !== userId) throw new CheckoutError('ORDER_NOT_FOUND', 404);
  if (['REFUNDED', 'REVERSED', 'PAYMENT_REVIEW'].includes(attempt.state)) throw new CheckoutError('ORDER_PAYMENT_ADJUSTED', 409);
  const demo = attempt.environment === 'DEMO';
  if (demo !== isDemoUserId(userId) || (!demo && attempt.environment !== paypalEnvironment().mode)) throw new CheckoutError('WRONG_PAYMENT_ENVIRONMENT', 409);
  if (attempt.state === 'COMPLETED') return { orderId, alreadyCompleted: true };
  if (capture && ['CANCELLED', 'CANCEL_PENDING'].includes(attempt.state)) throw new CheckoutError('ORDER_CANCELLED', 409);
  let proof: ReturnType<typeof verifyCheckoutCapture> | undefined;
  let providerOrder: unknown;
  assertCheckoutOrder(attempt); // Invalid order/money must never reach a provider call.
  if (!demo) {
    if (!attempt.paypalOrderId || !attempt.merchantId) throw new CheckoutError('PAYMENT_NOT_READY', 409);
    // Expired attempts may reconcile an existing capture, but never initiate a
    // new charge. Requiring same UTC date also preserves the daily purchase cap.
    const now = new Date(clock());
    const canCapture = capture && now.getTime() < checkoutExpiresAt(attempt.createdAt).getTime();
    if (canCapture) {
      const claimed = await db.checkoutAttempt.updateMany({ where: { orderId, userId, captureId: null,
        state: { in: ['PREPARED', 'APPROVAL_PENDING', 'CAPTURE_PENDING'] } }, data: { state: 'CAPTURE_PENDING' } });
      if (claimed.count !== 1) throw new CheckoutError('ORDER_CHANGED', 409);
    }
    try {
      providerOrder = canCapture ? await provider.capturePayPalOrder(attempt.paypalOrderId, attempt.captureRequestId) : await provider.readPayPalOrder(attempt.paypalOrderId);
    } catch (error) {
      // This specific response proves capture was not attempted. Ambiguous
      // network failures stay guarded until the same payment is reconciled.
      if (canCapture && error instanceof CheckoutError && error.code === 'PAYMENT_NOT_APPROVED') {
        await db.checkoutAttempt.updateMany({ where: { orderId, state: 'CAPTURE_PENDING', captureId: null }, data: { state: 'APPROVAL_PENDING' } });
      }
      throw error;
    }
    proof = verifyCheckoutCapture(providerOrder, attempt);
  }
  return db.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`fulfill:${orderId}`}, 0))`;
    const fresh = await tx.checkoutAttempt.findUniqueOrThrow({ where: { orderId }, include: includeOrder });
    if (fresh.userId !== userId) throw new CheckoutError('ORDER_NOT_FOUND', 404);
    if (fresh.environment !== attempt.environment) throw new CheckoutError('WRONG_PAYMENT_ENVIRONMENT', 409);
    if (fresh.state === 'COMPLETED') return { orderId, alreadyCompleted: true };
    if (['REFUNDED', 'REVERSED', 'PAYMENT_REVIEW'].includes(fresh.state)) throw new CheckoutError('ORDER_PAYMENT_ADJUSTED', 409);
    const pricing = assertCheckoutOrder(fresh);
    if (!demo) proof = verifyCheckoutCapture(providerOrder, fresh);
    // Unique captureId also prevents reuse across different internal orders.
    const completedAt = new Date(clock());
    await tx.checkoutAttempt.update({ where: { orderId }, data: { state: 'COMPLETED', captureId: proof?.captureId, completedAt } });
    const grant = pricing.lines.reduce((sum, line) => sum + line.credits, 0);
    // Sandbox balances cannot become Live balances, even in a shared database.
    // Demo's one-time free allowance is granted separately in S5.
    if (grant && !demo) {
      const accountId = `${fresh.environment}:${userId}`;
      await tx.aiCreditAccount.upsert({ where: { id: accountId }, create: { id: accountId, userId, environment: fresh.environment, balance: 0 }, update: {} });
      await applyAiCreditDelta(tx, accountId, grant);
      await tx.aiCreditEntry.create({ data: { accountId, delta: grant, kind: 'PURCHASE', sourceKey: `checkout:${orderId}` } });
    }
    for (const item of fresh.Order.OrderItem) {
      const files = await tx.digitalProductFile.findMany({ where: { productId: item.productId }, include: { DigitalAsset: true } });
      if (pricing.lines.find(line => line.productId === item.productId)?.kind === 'DIGITAL_FILES' && !filesReady(files)) {
        throw new CheckoutError('DOWNLOADS_NOT_READY', 503);
      }
      for (const file of files) {
        if (!file.DigitalAsset.isActive) throw new CheckoutError('DOWNLOADS_NOT_READY', 503);
        await tx.downloadToken.create({ data: { userId, orderId, orderItemId: item.id, digitalAssetId: file.digitalAssetId,
          token: randomBytes(32).toString('hex'), maxUses: 10, expiresAt: new Date(clock() + 24 * 60 * 60 * 1000) } });
      }
    }
    await tx.order.update({ where: { id: orderId }, data: { status: 'COMPLETED', fulfilmentStatus: 'DELIVERED', deliveredAt: new Date(clock()),
      ...(proof ? { transactionId: proof.captureId, Payment: { create: { method: 'PAYPAL', status: 'COMPLETED', transactionId: proof.captureId,
        tokenSymbol: pricing.money.currency, nativeAmount: formatMinor(pricing.money.minor), receiverAddress: fresh.merchantId,
        commentPay: `${fresh.environment}: verified server capture` } } } : {}) } });
    const cart = await tx.cart.findUnique({ where: { userId }, select: { id: true } });
    // A buyer may edit their next cart while PayPal is open. Remove only lines
    // matching this immutable purchase, never a newly selected credit amount.
    if (cart) for (const where of purchasedCartFilters(fresh, cart.id)) await tx.cartItem.deleteMany({ where });
    const original = purchaseConfirmation({ ...fresh, captureId: proof?.captureId ?? null, completedAt });
    if (original) await queueTransactionEmail(tx, { sourceKey: `purchase:${orderId}`, userId, orderId,
      kind: 'PURCHASE', paymentEnvironment: fresh.environment, subject: 'Your Veggat order confirmation',
      filename: `veggat-order-${orderId}.txt`, original });
    return { orderId, alreadyCompleted: false };
  }, { timeout: 15_000 });
}

export function completeShowcaseCheckout(orderId: string, userId: string, capture = true) {
  return createCheckoutCompletion(dbPrisma as PrismaClient)(orderId, userId, capture);
}
