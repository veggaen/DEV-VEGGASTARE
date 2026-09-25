/**
 * @fileOverview  Server actions for Seller Payment Setup (Steps 2 & 3).
 *                Handles PayPal email save/verify and default receiving wallet
 *                selection — for both User and Company targets.
 * @stability     experimental
 */
'use server';

import { z } from 'zod';
import { dbPrisma } from '@/lib/db';
import { MyLibUserAuth } from '@/lib/user-auth';
import { getUserById } from '@/data/user';
import { preparePaypalEmail, discardPaypalEmailRequest, checkPaypalEmail, clearPaypalEmail, readPaypalPaymentStatus, PaypalEmailError } from '@/lib/paypal-email';
import { sendPaypalVerificationEmail, sendTwoFactorTokenEmail } from '@/lib/mail';
import { checkRateLimit } from '@/lib/rate-limit';
import { createLogger } from '@/lib/logger';
import { isDemoUserId } from '@/lib/demo-policy';
import { changePayoutWallet, type PayoutTarget, type PayoutChoice } from '@/lib/payout-wallet';
import { walletActionOrigin } from '@/lib/wallet-action-origin';
import { WalletLinkError } from '@/lib/wallet-link';

const log = createLogger('seller-payment');

// ─── Zod schemas ────────────────────────────────────────────────────────────

/** CUID pattern — 25 lowercase alphanumerics starting with 'c'. */
const CUID_RE = /^c[a-z0-9]{24}$/;

const TargetSchema = z.discriminatedUnion('target', [
  z.object({ target: z.literal('user') }),
  z.object({
    target: z.literal('company'),
    companyId: z.string().regex(/^c[a-z0-9]{24,29}$/, 'Invalid company ID'),
  }),
]);

const SavePaypalEmailSchema = z.object({
  paypalEmail: z.string().trim().toLowerCase().email('Invalid PayPal email').max(254, 'Email too long'),
  expectedEmail: z.string().email().max(254).nullable(),
}).and(TargetSchema);

/** Token is 32 random bytes → 64 hex chars. */
const VerifyPaypalEmailSchema = z.object({
  token: z.string().length(64, 'Invalid token format').regex(/^[0-9a-f]+$/, 'Invalid token format'),
}).and(TargetSchema);

const RemovePaypalEmailSchema = z.object({
  expectedEmail: z.string().email().max(254).nullable(),
  expectedPendingEmail: z.string().email().max(254).nullable(),
}).and(TargetSchema);

const SetDefaultWalletSchema = z.object({
  walletId: z.string().min(1).max(30).regex(CUID_RE, 'Invalid wallet ID'),
  code: z.string().regex(/^\d{6}$/).optional().nullable(),
}).and(TargetSchema);

const RemoveDefaultWalletSchema = z.object({
  expectedWalletId: z.string().min(1).max(30).regex(CUID_RE, 'Refresh payment settings before clearing the receiving wallet.'),
  code: z.string().regex(/^\d{6}$/).optional().nullable(),
}).and(TargetSchema);

// ─── Helpers ────────────────────────────────────────────────────────────────

type Result = { error: string } | { success: string };
export type PayoutWalletResult = Result | { twoFactor: true };

/** Authenticate + rate limit in one call. Returns the DB user or an error. */
async function authAndRateLimit(): Promise<{ error: string } | { dbUser: { id: string } }> {
  const me = await MyLibUserAuth();
  if (!me?.id) return { error: 'Unauthorized' };
  if (isDemoUserId(me.id)) return { error: 'Demo accounts cannot change payout settings. Use your own account.' };

  const rl = await checkRateLimit(me.id, 'payment');
  if (!rl.success) return { error: 'Too many requests. Please try again shortly.' };

  const dbUser = await getUserById(me.id);
  if (!dbUser) return { error: 'Unauthorized' };

  return { dbUser };
}

/** Mail stays outside database locks; a failure removes only its own request. */
export async function savePaypalEmail(values: z.infer<typeof SavePaypalEmailSchema>): Promise<Result> {
  const parsed = SavePaypalEmailSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  const auth = await authAndRateLimit();
  if ('error' in auth) return auth;
  try {
    const origin = await walletActionOrigin();
    const request = await preparePaypalEmail({ ...parsed.data, userId: auth.dbUser.id, origin, email: parsed.data.paypalEmail });
    try {
      await sendPaypalVerificationEmail(parsed.data.paypalEmail, request.token, parsed.data.target, request.entityId, origin);
    } catch {
      await discardPaypalEmailRequest(parsed.data.target, request.entityId, request.tokenHash);
      return { error: 'Verification email could not be sent. Your receiving address is unchanged. Try again.' };
    }
    return { success: 'Verification email requested. Open the link to confirm the new address.' };
  } catch (error) {
    if (error instanceof PaypalEmailError || error instanceof WalletLinkError) return { error: error.message };
    log.error('PayPal email request failed');
    return { error: 'Unable to request verification. Refresh payment settings and try again.' };
  }
}

export async function reviewPaypalEmail(values: z.infer<typeof VerifyPaypalEmailSchema>): Promise<{ error: string } | { data: { email: string } }> {
  const parsed = VerifyPaypalEmailSchema.safeParse(values);
  if (!parsed.success) return { error: 'Invalid verification link. Request a new one in payment settings.' };
  const auth = await authAndRateLimit();
  if ('error' in auth) return auth;
  try {
    const origin = await walletActionOrigin();
    return { data: await checkPaypalEmail({ ...parsed.data, userId: auth.dbUser.id, origin }, false) };
  } catch (error) {
    if (error instanceof PaypalEmailError || error instanceof WalletLinkError) return { error: error.message };
    log.error('PayPal email review failed');
    return { error: 'Verification could not load. Try again.' };
  }
}

export async function verifyPaypalEmail(values: z.infer<typeof VerifyPaypalEmailSchema>): Promise<Result> {
  const parsed = VerifyPaypalEmailSchema.safeParse(values);
  if (!parsed.success) return { error: 'Invalid verification link. Request a new one in payment settings.' };
  const auth = await authAndRateLimit();
  if ('error' in auth) return auth;
  try {
    const origin = await walletActionOrigin();
    await checkPaypalEmail({ ...parsed.data, userId: auth.dbUser.id, origin }, true);
    return { success: 'Receiving email verified.' };
  } catch (error) {
    if (error instanceof PaypalEmailError || error instanceof WalletLinkError) return { error: error.message };
    log.error('PayPal email verification failed');
    return { error: 'Verification could not complete. Request a new link in payment settings.' };
  }
}

export async function removePaypalEmail(values: z.infer<typeof RemovePaypalEmailSchema>): Promise<Result> {
  const parsed = RemovePaypalEmailSchema.safeParse(values);
  if (!parsed.success) return { error: 'Refresh payment settings before removing the receiving email.' };
  const auth = await authAndRateLimit();
  if ('error' in auth) return auth;
  try {
    const origin = await walletActionOrigin();
    await clearPaypalEmail({ ...parsed.data, userId: auth.dbUser.id, origin });
    return { success: 'Receiving email and pending verification removed.' };
  } catch (error) {
    if (error instanceof PaypalEmailError || error instanceof WalletLinkError) return { error: error.message };
    log.error('PayPal email removal failed');
    return { error: 'Unable to remove the receiving email. Refresh payment settings and try again.' };
  }
}

async function applyPayoutChoice(values: PayoutTarget & PayoutChoice & { code?: string | null }): Promise<PayoutWalletResult> {
  const auth = await authAndRateLimit();
  if ('error' in auth) return auth;
  try {
    const origin = await walletActionOrigin();
    const limit = await checkRateLimit(`wallet-user:${auth.dbUser.id}`, 'wallet');
    if (!limit.success) return { error: 'Too many wallet requests. Please try again shortly.' };
    const result = await changePayoutWallet({ ...values, userId: auth.dbUser.id, origin });
    if ('twoFactor' in result) {
      await sendTwoFactorTokenEmail(result.email, result.code);
      return { twoFactor: true };
    }
    return { success: values.action === 'set' ? 'Receiving wallet updated.' : 'Receiving choice cleared. The wallet stays linked.' };
  } catch (error) {
    if (error instanceof WalletLinkError) return { error: error.message };
    log.error('Receiving wallet change could not be confirmed');
    return { error: 'Unable to confirm this change. Refresh payment settings before trying again.' };
  }
}

export async function setDefaultReceivingWallet(values: z.infer<typeof SetDefaultWalletSchema>): Promise<PayoutWalletResult> {
  const parsed = SetDefaultWalletSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  return applyPayoutChoice({ ...parsed.data, action: 'set' });
}

export async function removeDefaultReceivingWallet(values: z.infer<typeof RemoveDefaultWalletSchema>): Promise<PayoutWalletResult> {
  const parsed = RemoveDefaultWalletSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };
  return applyPayoutChoice({ ...parsed.data, action: 'clear' });
}

// ─── Get Seller Payment Status ───────────────────────────────────────────────

const GetPaymentStatusSchema = TargetSchema;

export type SellerPaymentStatus = {
  paypalEmail: string | null;
  paypalEmailVerified: boolean;
  pendingPaypalEmail: string | null;
  defaultReceivingWalletId: string | null;
  defaultReceivingWalletAddress: string | null;
};

export async function getSellerPaymentStatus(
  values: z.infer<typeof GetPaymentStatusSchema>
): Promise<{ error: string } | { data: SellerPaymentStatus }> {
  const parsed = GetPaymentStatusSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };

  const auth = await authAndRateLimit();
  if ('error' in auth) return auth;
  const { dbUser } = auth;

  try {
    return { data: await readPaypalPaymentStatus({ ...parsed.data, userId: dbUser.id, origin: '' }) };
  } catch (error) {
    if (error instanceof PaypalEmailError) return { error: error.message };
    log.error('Payment settings could not load');
    return { error: 'Failed to load payment status. Please try again.' };
  }
}

// ─── Resolve Seller Payment Info for Checkout ────────────────────────────────

/**
 * Given an array of product IDs (from the buyer's cart), resolve each product's
 * seller payment configuration: receiver wallet address + PayPal email.
 *
 * Resolution order per product:
 *   1. Product-level `receiverWalletId` → wallet address
 *   2. Company-level `defaultReceivingWalletId` (if product belongs to a company)
 *   3. User-level `defaultReceivingWalletId` (product owner's default)
 *
 * For PayPal, check company-level first, then user-level. Only verified emails.
 *
 * This is called by the BUYER during checkout — no seller ownership check needed.
 */

const ResolveCheckoutPaymentSchema = z.object({
  productIds: z.array(z.string().min(1).max(30)).min(1).max(50),
});

export type CheckoutSellerPayment = {
  /** Product ID → resolved payment info */
  products: Record<string, {
    sellerId: string;
    sellerName: string | null;
    companyId: string | null;
    companyName: string | null;
    receiverWalletAddress: string | null;
    receiverWalletId: string | null;
    receiverWalletsByFamily: Record<'EVM' | 'SOLANA', string | null>;
    receiverWalletsByToken: Record<string, string>;
    paypalEmail: string | null;
  }>;
  /** If all products resolve to the same wallet, this is that address. Otherwise null. */
  unifiedReceiverWallet: string | null;
  unifiedReceiverWalletByFamily: Record<'EVM' | 'SOLANA', string | null>;
  unifiedReceiverWalletByToken: Record<string, string>;
  /** If all products resolve to the same PayPal email, this is that email. Otherwise null. */
  unifiedPaypalEmail: string | null;
  /** True when products come from multiple different sellers */
  multiSeller: boolean;
};

export async function resolveCheckoutPayment(
  values: z.infer<typeof ResolveCheckoutPaymentSchema>
): Promise<{ error: string } | { data: CheckoutSellerPayment }> {
  const parsed = ResolveCheckoutPaymentSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };

  const auth = await authAndRateLimit();
  if ('error' in auth) return auth;
  const { dbUser } = auth;

  try {
    const { productIds } = parsed.data;

    // Load products with their owner + company + wallet info
    const products = await dbPrisma.product.findMany({
      where: { id: { in: productIds } },
      select: {
        id: true,
        receiverWalletId: true,
        userId: true,
        companyId: true,
        Wallet: { select: { id: true, address: true, verifiedAt: true } },
        ProductAcceptedToken: {
          select: {
            family: true,
            symbol: true,
            receiverAddress: true,
            ReceiverWallet: { select: { id: true, address: true, verifiedAt: true } },
          },
        },
        User: {
          select: {
            id: true,
            name: true,
            paypalEmail: true,
            paypalEmailVerifiedAt: true,
            defaultReceivingWalletId: true,
            defaultReceivingWallet: { select: { id: true, address: true, verifiedAt: true } },
          },
        },
        Company: {
          select: {
            id: true,
            name: true,
            paypalEmail: true,
            paypalEmailVerifiedAt: true,
            defaultReceivingWalletId: true,
            defaultReceivingWallet: { select: { id: true, address: true, verifiedAt: true } },
          },
        },
      },
    });

    const result: CheckoutSellerPayment['products'] = {};
    const walletAddresses = new Set<string>();
    const familyWalletAddresses: Record<'EVM' | 'SOLANA', Set<string>> = {
      EVM: new Set<string>(),
      SOLANA: new Set<string>(),
    };
    const tokenWalletAddresses = new Map<string, Set<string>>();
    const paypalEmails = new Set<string>();
    const sellerIds = new Set<string>();

    for (const p of products) {
      // Resolve wallet: product-level → company-level → user-level
      let walletAddr: string | null = null;
      let walletId: string | null = null;

      if (p.Wallet?.verifiedAt && p.Wallet.address) {
        walletAddr = p.Wallet.address;
        walletId = p.Wallet.id;
      } else if (p.Company?.defaultReceivingWallet?.verifiedAt && p.Company.defaultReceivingWallet.address) {
        walletAddr = p.Company.defaultReceivingWallet.address;
        walletId = p.Company.defaultReceivingWallet.id;
      } else if (p.User?.defaultReceivingWallet?.verifiedAt && p.User.defaultReceivingWallet.address) {
        walletAddr = p.User.defaultReceivingWallet.address;
        walletId = p.User.defaultReceivingWallet.id;
      }

      const receiverWalletsByFamily: Record<'EVM' | 'SOLANA', string | null> = {
        EVM: null,
        SOLANA: null,
      };
      const receiverWalletsByToken: Record<string, string> = {};

      for (const token of p.ProductAcceptedToken ?? []) {
        if (token.family !== 'EVM' && token.family !== 'SOLANA') continue;
        const tokenReceiver =
          token.ReceiverWallet?.verifiedAt && token.ReceiverWallet.address
            ? token.ReceiverWallet.address
            : token.receiverAddress?.trim() || null;

        if (!tokenReceiver) continue;

        const tokenKey = `${token.family}:${token.symbol.toUpperCase()}`;
        receiverWalletsByToken[tokenKey] = tokenReceiver;
        if (!receiverWalletsByFamily[token.family]) {
          receiverWalletsByFamily[token.family] = tokenReceiver;
        }
        familyWalletAddresses[token.family].add(tokenReceiver);
        if (!tokenWalletAddresses.has(tokenKey)) {
          tokenWalletAddresses.set(tokenKey, new Set<string>());
        }
        tokenWalletAddresses.get(tokenKey)?.add(tokenReceiver);
      }

      if (!receiverWalletsByFamily.EVM && walletAddr) {
        receiverWalletsByFamily.EVM = walletAddr;
        familyWalletAddresses.EVM.add(walletAddr);
      }

      // Resolve PayPal: company-level → user-level (only verified)
      let paypal: string | null = null;
      if (p.Company?.paypalEmailVerifiedAt && p.Company.paypalEmail) {
        paypal = p.Company.paypalEmail;
      } else if (p.User?.paypalEmailVerifiedAt && p.User.paypalEmail) {
        paypal = p.User.paypalEmail;
      }

      result[p.id] = {
        sellerId: p.userId,
        sellerName: p.User?.name ?? null,
        companyId: p.companyId,
        companyName: p.Company?.name ?? null,
        receiverWalletAddress: walletAddr,
        receiverWalletId: walletId,
        receiverWalletsByFamily,
        receiverWalletsByToken,
        paypalEmail: paypal,
      };

      if (walletAddr) walletAddresses.add(walletAddr);
      if (paypal) paypalEmails.add(paypal);
      sellerIds.add(p.userId);
    }

    const data: CheckoutSellerPayment = {
      products: result,
      unifiedReceiverWallet: walletAddresses.size === 1 ? [...walletAddresses][0] : null,
      unifiedReceiverWalletByFamily: {
        EVM: familyWalletAddresses.EVM.size === 1 ? [...familyWalletAddresses.EVM][0] : null,
        SOLANA: familyWalletAddresses.SOLANA.size === 1 ? [...familyWalletAddresses.SOLANA][0] : null,
      },
      unifiedReceiverWalletByToken: Object.fromEntries(
        [...tokenWalletAddresses.entries()]
          .filter(([, addresses]) => addresses.size === 1)
          .map(([key, addresses]) => [key, [...addresses][0]])
      ),
      unifiedPaypalEmail: paypalEmails.size === 1 ? [...paypalEmails][0] : null,
      multiSeller: sellerIds.size > 1,
    };

    log.info('resolveCheckoutPayment', {
      buyerId: dbUser.id,
      productCount: productIds.length,
      sellerCount: sellerIds.size,
      hasUnifiedWallet: !!data.unifiedReceiverWallet,
    });

    return { data };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to resolve seller payment';
    log.error('resolveCheckoutPayment failed', { userId: dbUser.id, error: msg });
    return { error: 'Failed to load seller payment info. Please try again.' };
  }
}
