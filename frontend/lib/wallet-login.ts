/** @fileOverview Browser-bound EOA login; identity, 2FA and nonce commit together. @stability evolving */
import { createHash, randomBytes } from 'node:crypto';
import { getAddress, verifyMessage, type Hex } from 'viem';
import { createSiweMessage, parseSiweMessage } from 'viem/siwe';
import type { Prisma } from '@/generated/prisma/client';
import { dbPrisma } from '@/lib/db';
import { isDemoUserId } from '@/lib/demo-policy';
import { WalletLinkError } from '@/lib/wallet-link';
import { walletActionCode } from '@/lib/wallet-action-code';
import { lockWalletIdentity } from '@/lib/wallet-identity-lock';

export const WALLET_LOGIN_TTL = 10 * 60_000;
const failure = () => new WalletLinkError('Wallet sign-in expired or could not be verified. Start again.', 401);
const digest = (value: string) => createHash('sha256').update(value).digest('hex');
type Context = { origin: string; browser: string };
type Proof = Context & { challengeId: string; signature: Hex; code?: string };
const userSelect = { id: true, name: true, email: true, image: true } as const;

function message(input: Context & { address: string; chainId: number; nonce: string; createdAt: Date; expires: Date }) {
  const origin = new URL(input.origin);
  if (!/^https?:$/.test(origin.protocol) || origin.origin !== input.origin || !/^[a-f0-9]{64}$/.test(input.browser)) throw failure();
  return createSiweMessage({
    domain: origin.host, scheme: origin.protocol.slice(0, -1), uri: `${origin.origin}/auth/login`,
    address: getAddress(input.address), chainId: input.chainId, version: '1', nonce: input.nonce,
    issuedAt: input.createdAt, expirationTime: input.expires, requestId: digest(input.browser),
    statement: 'Sign in to Veggat. No transaction or gas fee. This does not change your receiving wallet.',
  });
}
export async function createWalletLoginChallenge(input: Context & { address: string; chainId: number }) {
  if (!Number.isInteger(input.chainId) || input.chainId <= 0 || input.chainId > 2147483647) throw failure();
  const address = getAddress(input.address), createdAt = new Date();
  const expires = new Date(createdAt.getTime() + WALLET_LOGIN_TTL), nonce = randomBytes(16).toString('hex');
  const issued = message({ ...input, address, createdAt, expires, nonce });
  // Other browsers' unexpired challenges must remain usable.
  const challenge = await dbPrisma.walletLoginNonce.create({ data: { address: address.toLowerCase(), createdAt, expires, nonce, message: issued } });
  await dbPrisma.$executeRaw`DELETE FROM "WalletLoginNonce" WHERE "id" IN (SELECT "id" FROM "WalletLoginNonce" WHERE "expires" < CURRENT_TIMESTAMP - INTERVAL '1 day' LIMIT 100)`;
  return { challengeId: challenge.id, message: issued, expires: expires.toISOString() };
}
async function verifyProof(input: Proof) {
  const challenge = await dbPrisma.walletLoginNonce.findUnique({ where: { id: input.challengeId } });
  if (!challenge || challenge.usedAt || challenge.expires.getTime() <= Date.now()
    || challenge.createdAt.getTime() > Date.now()
    || challenge.expires.getTime() - challenge.createdAt.getTime() !== WALLET_LOGIN_TTL) throw failure();
  const { chainId } = parseSiweMessage(challenge.message);
  if (!chainId || !Number.isInteger(chainId) || chainId <= 0 || chainId > 2147483647
    || challenge.message !== message({ ...challenge, ...input, chainId })) throw failure();
  let valid = false;
  try { valid = await verifyMessage({ address: getAddress(challenge.address), message: challenge.message, signature: input.signature }); } catch { /* fail closed */ }
  if (!valid) throw failure();
  return { ...challenge, chainId };
}
async function lockedOwner(tx: Prisma.TransactionClient, address: string) {
  const where = { family: 'EVM' as const, ownerCompanyId: null, ownerUserId: { not: null }, verifiedAt: { not: null }, address: { equals: address, mode: 'insensitive' as const } };
  const wallets = await tx.wallet.findMany({ where, select: { ownerUserId: true } });
  const owners = [...new Set(wallets.map(w => w.ownerUserId!))];
  if (owners.length > 1) throw failure(); // legacy ambiguity must never pick an arbitrary account
  if (!owners.length) return null;
  await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${owners[0]} FOR UPDATE`;
  // Unlinking takes the same User lock; don't authenticate a removed identity.
  if (!await tx.wallet.findFirst({ where: { ...where, ownerUserId: owners[0] }, select: { id: true } })) throw failure();
  const user = await tx.user.findUnique({ where: { id: owners[0] }, select: { ...userSelect, web3ModeEnabled: true, isTwoFactorEnabled: true, emailVerified: true } });
  if (!user || !user.web3ModeEnabled || isDemoUserId(user.id)) throw failure();
  if (user.isTwoFactorEnabled && (!user.email || !user.emailVerified)) throw failure();
  return user;
}
const codeScope = (userId: string, input: Proof) => `wallet-login:${userId}:${input.origin}:${input.challengeId}:${digest(input.browser)}`;
export async function prepareWalletLogin(input: Proof) {
  const challenge = await verifyProof(input);
  return dbPrisma.$transaction(async tx => {
    await lockWalletIdentity(tx, challenge.address);
    const user = await lockedOwner(tx, challenge.address);
    const current = await tx.walletLoginNonce.findFirst({ where: { id: challenge.id, usedAt: null, expires: { gt: new Date() } }, select: { id: true } });
    if (!current) throw failure();
    if (user?.isTwoFactorEnabled) return walletActionCode(tx, user, codeScope(user.id, input));
    return null;
  });
}
export async function authenticateWalletLogin(input: Proof) {
  const challenge = await verifyProof(input);
  return dbPrisma.$transaction(async tx => {
    await lockWalletIdentity(tx, challenge.address);
    const user = await lockedOwner(tx, challenge.address);
    if (user?.isTwoFactorEnabled) {
      if (!input.code) throw failure(); // authorize never sends mail or bypasses the code gate
      await walletActionCode(tx, user, codeScope(user.id, input), input.code);
    }
    const consumed = await tx.walletLoginNonce.updateMany({ where: {
      id: challenge.id, message: challenge.message, usedAt: null, expires: { gt: new Date() },
    }, data: { usedAt: new Date() } });
    if (consumed.count !== 1) throw failure();
    if (user) return { id: user.id, name: user.name, email: user.email, image: user.image };
    // Never claim a manually-entered address or a company's payment wallet.
    return tx.user.create({ data: {
      name: `${challenge.address.slice(0, 6)}…${challenge.address.slice(-4)}`,
      verificationTier: 'WALLET_ONLY', web3ModeEnabled: true,
      Wallet: { create: { label: 'Wallet', family: 'EVM', address: getAddress(challenge.address), chainId: challenge.chainId,
        verifiedAt: new Date(), connectorType: 'wallet-login', riskTier: 'fresh', isDefault: false } },
    }, select: userSelect });
  });
}
