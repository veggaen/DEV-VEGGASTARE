/** @fileOverview Owner-bound, one-use PayPal email verification. @stability evolving */
import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { Prisma } from '@/generated/prisma/client';
import { dbPrisma } from '@/lib/db';
import { isDemoUserId } from '@/lib/demo-policy';

export type PaypalEmailTarget = { target: 'user' } | { target: 'company'; companyId: string };
type Identity = PaypalEmailTarget & { userId: string; origin: string };
export class PaypalEmailError extends Error {}
const invalidLink = () => new PaypalEmailError('Verification failed or expired. Request a new link in payment settings.');

async function lockTarget(tx: Prisma.TransactionClient, input: Identity) {
  // Match the payout lock order. Ownership and the write share this lock.
  await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${input.userId} FOR UPDATE`;
  const user = await tx.user.findUnique({ where: { id: input.userId }, select: { id: true, paypalEmail: true, paypalEmailVerifiedAt: true, web3ModeEnabled: true } });
  if (!user || isDemoUserId(input.userId)) throw new PaypalEmailError('Sign in to your own account to change payment settings.');
  if (input.target === 'user') return { id: user.id, email: user.paypalEmail, walletChangesAllowed: user.web3ModeEnabled };
  await tx.$queryRaw`SELECT "id" FROM "Company" WHERE "id" = ${input.companyId} FOR UPDATE`;
  const company = await tx.company.findUnique({ where: { id: input.companyId }, select: { ownerId: true, paypalEmail: true } });
  if (!company || company.ownerId !== user.id) throw new PaypalEmailError('Only the current company owner can manage payment settings.');
  return { id: input.companyId, email: company.paypalEmail, walletChangesAllowed: user.web3ModeEnabled };
}

function digest(input: Identity, current: string | null, email: string, token: string) {
  return 'sha256:' + createHash('sha256').update(JSON.stringify([
    'paypal-email-v1', input.userId, input.origin, input.target,
    input.target === 'company' ? input.companyId : input.userId, current, email, token,
  ])).digest('hex');
}

export async function preparePaypalEmail(input: Identity & { email: string; expectedEmail: string | null }) {
  return dbPrisma.$transaction(async tx => {
    const current = await lockTarget(tx, input);
    if (current.email !== input.expectedEmail) throw new PaypalEmailError('The receiving email changed. Refresh payment settings and review it.');
    const token = randomBytes(32).toString('hex');
    const tokenHash = digest(input, current.email, input.email, token);
    await tx.paypalVerificationToken.upsert({
      where: { entityType_entityId: { entityType: input.target, entityId: current.id } },
      create: { entityType: input.target, entityId: current.id, token: tokenHash, email: input.email, expires: new Date(Date.now() + 86_400_000) },
      update: { token: tokenHash, email: input.email, expires: new Date(Date.now() + 86_400_000) },
    });
    // No receiving address changes until its inbox link is confirmed.
    return { token, tokenHash, entityId: current.id };
  });
}

export async function discardPaypalEmailRequest(entityType: 'user' | 'company', entityId: string, tokenHash: string) {
  // A failed/slow mail request must never delete a newer verification link.
  await dbPrisma.paypalVerificationToken.deleteMany({ where: { entityType, entityId, token: tokenHash } });
}

export async function checkPaypalEmail(input: Identity & { token: string }, consume: boolean) {
  return dbPrisma.$transaction(async tx => {
    const current = await lockTarget(tx, input);
    const record = await tx.paypalVerificationToken.findUnique({ where: { entityType_entityId: { entityType: input.target, entityId: current.id } } });
    if (!record || record.expires.getTime() <= Date.now()) throw invalidLink();
    const expected = digest(input, current.email, record.email, input.token);
    if (expected.length !== record.token.length || !timingSafeEqual(Buffer.from(expected), Buffer.from(record.token))) throw invalidLink();
    if (consume) {
      const used = await tx.paypalVerificationToken.deleteMany({ where: { id: record.id, token: expected, expires: { gt: new Date() } } });
      if (used.count !== 1) throw invalidLink();
      const data = { paypalEmail: record.email, paypalEmailVerifiedAt: new Date() };
      if (input.target === 'company') await tx.company.update({ where: { id: current.id }, data, select: { id: true } });
      else await tx.user.update({ where: { id: current.id }, data, select: { id: true } });
    }
    return { email: record.email };
  });
}

export async function clearPaypalEmail(input: Identity & { expectedEmail: string | null; expectedPendingEmail: string | null }) {
  return dbPrisma.$transaction(async tx => {
    const current = await lockTarget(tx, input);
    const pending = await tx.paypalVerificationToken.findUnique({ where: { entityType_entityId: { entityType: input.target, entityId: current.id } } });
    const pendingEmail = pending && pending.expires.getTime() > Date.now() ? pending.email : null;
    if (current.email !== input.expectedEmail || pendingEmail !== input.expectedPendingEmail) {
      throw new PaypalEmailError('The receiving email changed. Refresh payment settings and review it.');
    }
    const data = { paypalEmail: null, paypalEmailVerifiedAt: null };
    if (input.target === 'company') await tx.company.update({ where: { id: current.id }, data, select: { id: true } });
    else await tx.user.update({ where: { id: current.id }, data, select: { id: true } });
    await tx.paypalVerificationToken.deleteMany({ where: { entityType: input.target, entityId: current.id } });
  });
}

export async function readPaypalPaymentStatus(input: Identity) {
  return dbPrisma.$transaction(async tx => {
    const current = await lockTarget(tx, input);
    const select = { paypalEmail: true, paypalEmailVerifiedAt: true, defaultReceivingWalletId: true, defaultReceivingWallet: { select: { address: true } } } as const;
    const row = input.target === 'company'
      ? await tx.company.findUniqueOrThrow({ where: { id: current.id }, select })
      : await tx.user.findUniqueOrThrow({ where: { id: current.id }, select });
    const pending = await tx.paypalVerificationToken.findUnique({ where: { entityType_entityId: { entityType: input.target, entityId: current.id } } });
    const wallets = current.walletChangesAllowed ? await tx.wallet.findMany({
      where: { verifiedAt: { not: null }, OR: [
        { ownerUserId: input.userId, ownerCompanyId: null },
        ...(input.target === 'company' ? [{ ownerCompanyId: input.companyId, ownerUserId: null }] : []),
      ] },
      select: { id: true, label: true, address: true, family: true, verifiedAt: true, ownerCompanyId: true },
      orderBy: [{ label: 'asc' }, { id: 'asc' }],
    }) : [];
    return {
      paypalEmail: row.paypalEmail, paypalEmailVerified: !!row.paypalEmailVerifiedAt,
      pendingPaypalEmail: pending && pending.expires.getTime() > Date.now() ? pending.email : null,
      defaultReceivingWalletId: row.defaultReceivingWalletId,
      defaultReceivingWalletAddress: row.defaultReceivingWallet?.address ?? null,
      walletChangesAllowed: current.walletChangesAllowed,
      receivingWallets: wallets.map(wallet => ({ id: wallet.id, label: wallet.label, address: wallet.address,
        family: wallet.family, verifiedAt: wallet.verifiedAt!.toISOString(),
        scope: wallet.ownerCompanyId ? 'company' as const : 'personal' as const })),
    };
  });
}
