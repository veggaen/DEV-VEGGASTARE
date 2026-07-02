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
import { randomBytes, timingSafeEqual } from 'crypto';
import { sendPaypalVerificationEmail } from '@/lib/mail';
import { checkRateLimit } from '@/lib/rate-limit';
import { createLogger } from '@/lib/logger';

const log = createLogger('seller-payment');

// ─── Zod schemas ────────────────────────────────────────────────────────────

/** CUID pattern — 25 lowercase alphanumerics starting with 'c'. */
const CUID_RE = /^c[a-z0-9]{24}$/;

const TargetSchema = z.discriminatedUnion('target', [
  z.object({ target: z.literal('user') }),
  z.object({
    target: z.literal('company'),
    companyId: z.string().min(1).max(30).regex(CUID_RE, 'Invalid company ID'),
  }),
]);

const SavePaypalEmailSchema = z.object({
  paypalEmail: z.string().email('Invalid PayPal email').max(254, 'Email too long'),
}).and(TargetSchema);

/** Token is 32 random bytes → 64 hex chars. */
const VerifyPaypalEmailSchema = z.object({
  token: z.string().length(64, 'Invalid token format').regex(/^[0-9a-f]+$/, 'Invalid token format'),
}).and(TargetSchema);

const RemovePaypalEmailSchema = TargetSchema;

const SetDefaultWalletSchema = z.object({
  walletId: z.string().min(1).max(30).regex(CUID_RE, 'Invalid wallet ID'),
}).and(TargetSchema);

const RemoveDefaultWalletSchema = TargetSchema;

// ─── Helpers ────────────────────────────────────────────────────────────────

type Result = { error: string } | { success: string };

/** Authenticate + rate limit in one call. Returns the DB user or an error. */
async function authAndRateLimit(): Promise<{ error: string } | { dbUser: { id: string } }> {
  const me = await MyLibUserAuth();
  if (!me?.id) return { error: 'Unauthorized' };

  const rl = await checkRateLimit(me.id, 'payment');
  if (!rl.success) return { error: 'Too many requests. Please try again shortly.' };

  const dbUser = await getUserById(me.id);
  if (!dbUser) return { error: 'Unauthorized' };

  return { dbUser };
}

/** Assert the authenticated user is the owner of the target company. */
async function assertCompanyOwner(userId: string, companyId: string) {
  const company = await dbPrisma.company.findUnique({
    where: { id: companyId },
    select: { ownerId: true },
  });
  if (!company) throw new Error('Company not found');
  if (company.ownerId !== userId) throw new Error('Only the company owner can manage payment settings');
}

/**
 * Normalize email: lowercase + trim.  Prevents bypass via casing tricks.
 * RFC 5321: local-part is case-sensitive in theory, but PayPal treats them
 * as case-insensitive — normalizing is safe and expected.
 */
function normalizeEmail(raw: string): string {
  return raw.toLowerCase().trim();
}

/**
 * Timing-safe comparison of two hex token strings.
 * Prevents timing side-channel attacks on token verification.
 */
function safeTokenEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));
}

/** Create a verification token and send it to the PayPal email. */
async function sendVerification(email: string, entityType: 'user' | 'company', entityId: string) {
  const token = randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24h

  // Upsert a PaypalVerificationToken record
  await dbPrisma.paypalVerificationToken.upsert({
    where: { entityType_entityId: { entityType, entityId } },
    create: { token, email, entityType, entityId, expires },
    update: { token, email, expires },
  });

  await sendPaypalVerificationEmail(email, token, entityType, entityId);

  // Opportunistically clean up expired tokens from other entities
  dbPrisma.paypalVerificationToken.deleteMany({
    where: { expires: { lt: new Date() } },
  }).catch(() => { /* best-effort cleanup */ });
}

// ─── Save PayPal Email (sends verification) ─────────────────────────────────

export async function savePaypalEmail(values: z.infer<typeof SavePaypalEmailSchema>): Promise<Result> {
  const parsed = SavePaypalEmailSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };

  const auth = await authAndRateLimit();
  if ('error' in auth) return auth;
  const { dbUser } = auth;

  const paypalEmail = normalizeEmail(parsed.data.paypalEmail);

  try {
    if (parsed.data.target === 'company') {
      const { companyId } = parsed.data;
      await assertCompanyOwner(dbUser.id, companyId);

      await dbPrisma.company.update({
        where: { id: companyId },
        data: { paypalEmail, paypalEmailVerifiedAt: null },
      });
      await sendVerification(paypalEmail, 'company', companyId);
      log.info('PayPal email saved (company)', { companyId, userId: dbUser.id });
    } else {
      await dbPrisma.user.update({
        where: { id: dbUser.id },
        data: { paypalEmail, paypalEmailVerifiedAt: null },
      });
      await sendVerification(paypalEmail, 'user', dbUser.id);
      log.info('PayPal email saved (user)', { userId: dbUser.id });
    }

    return { success: `Verification email sent to ${paypalEmail}` };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to save PayPal email';
    log.error('savePaypalEmail failed', { userId: dbUser.id, error: msg });
    return { error: 'Failed to save PayPal email. Please try again.' };
  }
}

// ─── Verify PayPal Email (confirm token) ─────────────────────────────────────

export async function verifyPaypalEmail(values: z.infer<typeof VerifyPaypalEmailSchema>): Promise<Result> {
  const parsed = VerifyPaypalEmailSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };

  const { token } = parsed.data;
  const entityType = parsed.data.target === 'company' ? 'company' : 'user';
  const entityId = parsed.data.target === 'company' ? parsed.data.companyId : undefined;

  const auth = await authAndRateLimit();
  if ('error' in auth) return auth;
  const { dbUser } = auth;

  const resolvedEntityId = entityType === 'company' ? entityId! : dbUser.id;

  try {
    const record = await dbPrisma.paypalVerificationToken.findUnique({
      where: { entityType_entityId: { entityType, entityId: resolvedEntityId } },
    });

    // Use generic message for not-found / invalid to prevent enumeration
    const GENERIC_FAIL = 'Verification failed or expired. Please request a new one.';

    if (!record) return { error: GENERIC_FAIL };
    if (record.expires < new Date()) {
      // Clean up the expired token
      await dbPrisma.paypalVerificationToken.delete({
        where: { entityType_entityId: { entityType, entityId: resolvedEntityId } },
      }).catch(() => {});
      return { error: GENERIC_FAIL };
    }

    // Timing-safe comparison prevents side-channel leakage
    if (!safeTokenEqual(record.token, token)) {
      log.warn('Invalid token attempt', { entityType, entityId: resolvedEntityId, userId: dbUser.id });
      return { error: GENERIC_FAIL };
    }

    // Confirm — for company target, assert ownership
    if (entityType === 'company') {
      await assertCompanyOwner(dbUser.id, resolvedEntityId);
    }

    const now = new Date();

    if (entityType === 'company') {
      await dbPrisma.company.update({
        where: { id: resolvedEntityId },
        data: { paypalEmailVerifiedAt: now },
      });
    } else {
      await dbPrisma.user.update({
        where: { id: resolvedEntityId },
        data: { paypalEmailVerifiedAt: now },
      });
    }

    // Clean up token
    await dbPrisma.paypalVerificationToken.delete({
      where: { entityType_entityId: { entityType, entityId: resolvedEntityId } },
    });

    log.info('PayPal email verified', { entityType, entityId: resolvedEntityId, userId: dbUser.id });
    return { success: 'PayPal email verified!' };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Verification failed';
    log.error('verifyPaypalEmail failed', { userId: dbUser.id, error: msg });
    return { error: 'Verification failed. Please try again.' };
  }
}

// ─── Remove PayPal Email ─────────────────────────────────────────────────────

export async function removePaypalEmail(values: z.infer<typeof RemovePaypalEmailSchema>): Promise<Result> {
  const parsed = RemovePaypalEmailSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };

  const auth = await authAndRateLimit();
  if ('error' in auth) return auth;
  const { dbUser } = auth;

  try {
    if (parsed.data.target === 'company') {
      const { companyId } = parsed.data;
      await assertCompanyOwner(dbUser.id, companyId);
      await dbPrisma.company.update({
        where: { id: companyId },
        data: { paypalEmail: null, paypalEmailVerifiedAt: null },
      });
    } else {
      await dbPrisma.user.update({
        where: { id: dbUser.id },
        data: { paypalEmail: null, paypalEmailVerifiedAt: null },
      });
    }

    // Also clean up any pending token
    const entityType = parsed.data.target === 'company' ? 'company' : 'user';
    const entityId = parsed.data.target === 'company' ? parsed.data.companyId : dbUser.id;
    await dbPrisma.paypalVerificationToken.deleteMany({
      where: { entityType, entityId },
    });

    log.info('PayPal email removed', { entityType, entityId, userId: dbUser.id });
    return { success: 'PayPal email removed' };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to remove PayPal email';
    log.error('removePaypalEmail failed', { userId: dbUser.id, error: msg });
    return { error: 'Failed to remove PayPal email. Please try again.' };
  }
}

// ─── Set Default Receiving Wallet ────────────────────────────────────────────

export async function setDefaultReceivingWallet(values: z.infer<typeof SetDefaultWalletSchema>): Promise<Result> {
  const parsed = SetDefaultWalletSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };

  const auth = await authAndRateLimit();
  if ('error' in auth) return auth;
  const { dbUser } = auth;

  const { walletId } = parsed.data;

  try {
    // Verify wallet exists and belongs to the right owner
    const wallet = await dbPrisma.wallet.findUnique({
      where: { id: walletId },
      select: { id: true, ownerUserId: true, ownerCompanyId: true, verifiedAt: true, address: true },
    });

    if (!wallet) return { error: 'Wallet not found' };

    // Only verified wallets can be used as default receiving wallets
    if (!wallet.verifiedAt) {
      return { error: 'Only verified wallets can be set as default. Please verify this wallet first.' };
    }

    if (parsed.data.target === 'company') {
      const { companyId } = parsed.data;
      await assertCompanyOwner(dbUser.id, companyId);

      // Wallet must belong to the company OR to the owner user
      if (wallet.ownerCompanyId !== companyId && wallet.ownerUserId !== dbUser.id) {
        return { error: 'Wallet does not belong to this company or you' };
      }

      await dbPrisma.company.update({
        where: { id: companyId },
        data: { defaultReceivingWalletId: walletId },
      });
      log.info('Default receiving wallet set (company)', { companyId, walletId, userId: dbUser.id });
    } else {
      // Wallet must belong to the authenticated user
      if (wallet.ownerUserId !== dbUser.id) {
        return { error: 'Wallet does not belong to you' };
      }

      await dbPrisma.user.update({
        where: { id: dbUser.id },
        data: { defaultReceivingWalletId: walletId },
      });
      log.info('Default receiving wallet set (user)', { walletId, userId: dbUser.id });
    }

    return { success: `Default receiving wallet set to ${wallet.address.slice(0, 6)}…${wallet.address.slice(-4)}` };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to set wallet';
    log.error('setDefaultReceivingWallet failed', { userId: dbUser.id, error: msg });
    return { error: 'Failed to set wallet. Please try again.' };
  }
}

// ─── Remove Default Receiving Wallet ─────────────────────────────────────────

export async function removeDefaultReceivingWallet(values: z.infer<typeof RemoveDefaultWalletSchema>): Promise<Result> {
  const parsed = RemoveDefaultWalletSchema.safeParse(values);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? 'Invalid input' };

  const auth = await authAndRateLimit();
  if ('error' in auth) return auth;
  const { dbUser } = auth;

  try {
    if (parsed.data.target === 'company') {
      const { companyId } = parsed.data;
      await assertCompanyOwner(dbUser.id, companyId);
      await dbPrisma.company.update({
        where: { id: companyId },
        data: { defaultReceivingWalletId: null },
      });
    } else {
      await dbPrisma.user.update({
        where: { id: dbUser.id },
        data: { defaultReceivingWalletId: null },
      });
    }

    log.info('Default receiving wallet removed', {
      target: parsed.data.target,
      userId: dbUser.id,
      ...(parsed.data.target === 'company' ? { companyId: parsed.data.companyId } : {}),
    });
    return { success: 'Default receiving wallet removed' };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to remove wallet';
    log.error('removeDefaultReceivingWallet failed', { userId: dbUser.id, error: msg });
    return { error: 'Failed to remove wallet. Please try again.' };
  }
}

// ─── Get Seller Payment Status ───────────────────────────────────────────────

const GetPaymentStatusSchema = TargetSchema;

export type SellerPaymentStatus = {
  paypalEmail: string | null;
  paypalEmailVerified: boolean;
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
    if (parsed.data.target === 'company') {
      const { companyId } = parsed.data;
      await assertCompanyOwner(dbUser.id, companyId);

      const company = await dbPrisma.company.findUnique({
        where: { id: companyId },
        select: {
          paypalEmail: true,
          paypalEmailVerifiedAt: true,
          defaultReceivingWalletId: true,
          defaultReceivingWallet: { select: { address: true } },
        },
      });
      if (!company) return { error: 'Company not found' };

      return {
        data: {
          paypalEmail: company.paypalEmail,
          paypalEmailVerified: !!company.paypalEmailVerifiedAt,
          defaultReceivingWalletId: company.defaultReceivingWalletId,
          defaultReceivingWalletAddress: company.defaultReceivingWallet?.address ?? null,
        },
      };
    } else {
      const user = await dbPrisma.user.findUnique({
        where: { id: dbUser.id },
        select: {
          paypalEmail: true,
          paypalEmailVerifiedAt: true,
          defaultReceivingWalletId: true,
          defaultReceivingWallet: { select: { address: true } },
        },
      });
      if (!user) return { error: 'User not found' };

      return {
        data: {
          paypalEmail: user.paypalEmail,
          paypalEmailVerified: !!user.paypalEmailVerifiedAt,
          defaultReceivingWalletId: user.defaultReceivingWalletId,
          defaultReceivingWalletAddress: user.defaultReceivingWallet?.address ?? null,
        },
      };
    }
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : 'Failed to fetch payment status';
    log.error('getSellerPaymentStatus failed', { userId: dbUser.id, error: msg });
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
