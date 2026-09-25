/** @fileOverview One-use wallet linking; proof and wallet writes commit together. @stability evolving */
import { createHash, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { getAddress, verifyMessage, type Hex } from 'viem';
import type { Prisma } from '@/generated/prisma/client';
import { dbPrisma } from '@/lib/db';
import { isDemoUserId } from '@/lib/demo-policy';
import { walletLinkMessage, WALLET_LINK_TTL } from '@/lib/wallet-link-message';

export class WalletLinkError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}
const codeDigest = (scope: string, code: string) => createHash('sha256').update(`${scope}:${code}`).digest('hex');
export async function lockedWalletUser(tx: Prisma.TransactionClient, userId: string) {
  await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`;
  const user = await tx.user.findUnique({ where: { id: userId }, select: {
    id: true, email: true, name: true, web3ModeEnabled: true,
    isTwoFactorEnabled: true, defaultReceivingWalletId: true,
  } });
  if (!user) throw new WalletLinkError('Sign in again to manage your wallets.', 401);
  if (isDemoUserId(userId)) throw new WalletLinkError('Wallet changes are unavailable in the demo.', 403);
  if (!user.web3ModeEnabled) throw new WalletLinkError('Enable Web3 mode first.', 403);
  return user;
}

export async function createWalletLinkChallenge(input: {
  userId: string; origin: string; address: string; chainId: number; code?: string | null;
}) {
  const address = getAddress(input.address);
  return dbPrisma.$transaction(async tx => {
    const user = await lockedWalletUser(tx, input.userId);
    if (user.isTwoFactorEnabled) {
      if (!user.email) throw new WalletLinkError('Add a verified email before linking your wallet.', 403);
      // Purpose/account/host scoped: a login code cannot authorize wallet linking.
      const tokenScope = `wallet-link:${user.id}:${input.origin}`;
      if (!input.code) {
        await tx.twoFactorToken.deleteMany({ where: { email: tokenScope } });
        const code = randomInt(100_000, 1_000_000).toString();
        await tx.twoFactorToken.create({ data: {
          email: tokenScope, token: codeDigest(tokenScope, code), expires: new Date(Date.now() + 5 * 60_000),
        } });
        return { twoFactor: true as const, email: user.email, code };
      }
      const token = await tx.twoFactorToken.findFirst({ where: { email: tokenScope } });
      // Do not pad codes: 123456 and 1234560 must never compare equal.
      if (!token || !/^\d{6}$/.test(input.code) || !/^[a-f0-9]{64}$/.test(token.token)
        || !timingSafeEqual(Buffer.from(codeDigest(tokenScope, input.code)), Buffer.from(token.token))) {
        throw new WalletLinkError('Incorrect code. Check the six digits in your email.');
      }
      const used = await tx.twoFactorToken.deleteMany({ where: { id: token.id, token: token.token, expires: { gt: new Date() } } });
      if (used.count !== 1) throw new WalletLinkError('Code expired or already used. Request a new code.');
    }
    const createdAt = new Date(), expires = new Date(createdAt.getTime() + WALLET_LINK_TTL);
    const nonce = randomBytes(16).toString('hex');
    const message = walletLinkMessage({ ...input, address, nonce, createdAt, expires, twoFactor: user.isTwoFactorEnabled });
    // Sequential inside the user lock: never delete the freshly-created challenge.
    await tx.walletVerificationChallenge.deleteMany({ where: { userId: user.id, family: 'EVM', address, usedAt: null } });
    const challenge = await tx.walletVerificationChallenge.create({ data: {
      userId: user.id, family: 'EVM', address, chainId: input.chainId, nonce, message, createdAt, expires,
    } });
    return { challengeId: challenge.id, message, expires: expires.toISOString() };
  });
}

export async function verifyWalletLink(input: {
  userId: string; origin: string; challengeId: string; signature: Hex;
  label?: string; connectorType?: string; authProvider?: string; socialEmail?: string;
}) {
  // EOA proof is local computation; no RPC/network request or wallet transaction.
  const challenge = await dbPrisma.walletVerificationChallenge.findUnique({ where: { id: input.challengeId } });
  if (!challenge || challenge.userId !== input.userId) throw new WalletLinkError('Challenge not found. Start verification again.', 404);
  if (challenge.family !== 'EVM' || !challenge.chainId) throw new WalletLinkError('Start a new wallet verification.');
  if (challenge.usedAt || challenge.expires.getTime() <= Date.now()) throw new WalletLinkError('Challenge expired or already used. Start again.', 409);
  let valid = false;
  try { valid = await verifyMessage({ address: getAddress(challenge.address), message: challenge.message, signature: input.signature }); } catch { /* invalid proof */ }
  if (!valid) throw new WalletLinkError('Signature did not match. Check the selected wallet and try again.');
  return dbPrisma.$transaction(async tx => {
    const user = await lockedWalletUser(tx, input.userId);
    const expected = walletLinkMessage({ ...challenge, origin: input.origin, chainId: challenge.chainId!, twoFactor: user.isTwoFactorEnabled });
    if (challenge.message !== expected || challenge.createdAt.getTime() > Date.now()
      || challenge.expires.getTime() - challenge.createdAt.getTime() !== WALLET_LINK_TTL) {
      throw new WalletLinkError('Account or site changed. Start verification again.', 403);
    }
    const consumed = await tx.walletVerificationChallenge.updateMany({ where: {
      id: challenge.id, userId: user.id, usedAt: null, message: challenge.message, expires: { gt: new Date() },
    }, data: { usedAt: new Date() } });
    if (consumed.count !== 1) throw new WalletLinkError('Challenge expired or already used. Start again.', 409);
    const where = { family: 'EVM' as const, ownerUserId: user.id, ownerCompanyId: null };
    const existing = await tx.wallet.findFirst({ where: { ...where, address: { equals: challenge.address, mode: 'insensitive' } },
      orderBy: [{ isDefault: 'desc' }, { verifiedAt: 'desc' }, { createdAt: 'desc' }] });
    const primary = await tx.wallet.findFirst({ where: { ...where, isDefault: true, verifiedAt: { not: null } }, select: { id: true } });
    const makeDefault = !user.defaultReceivingWalletId && !primary;
    if (makeDefault) await tx.wallet.updateMany({ where, data: { isDefault: false } });
    // Connector metadata is display-only, never identity/authorization evidence.
    const metadata = {
      ...(input.connectorType ? { connectorType: input.connectorType } : {}),
      ...(input.authProvider ? { authProvider: input.authProvider } : {}),
      ...(input.socialEmail ? { socialEmail: input.socialEmail } : {}),
    };
    const label = existing?.label || input.label || `Wallet ${challenge.address.slice(0, 6)}…${challenge.address.slice(-4)}`;
    const data = { label, chainId: challenge.chainId, verifiedAt: new Date(), ...metadata, ...(makeDefault ? { isDefault: true } : {}) };
    const wallet = existing
      ? await tx.wallet.update({ where: { id: existing.id }, data })
      : await tx.wallet.create({ data: { ...where, ...data, address: challenge.address } });
    if (makeDefault) await tx.user.update({ where: { id: user.id }, data: { defaultReceivingWalletId: wallet.id }, select: { id: true } });
    return { wallet, user };
  });
}
