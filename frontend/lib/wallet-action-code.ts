/** @fileOverview Consume scoped wallet approval codes inside the mutation transaction. @stability evolving */
import { createHash, randomInt, timingSafeEqual } from 'node:crypto';
import type { Prisma } from '@/generated/prisma/client';
import { WalletLinkError } from '@/lib/wallet-link';
const digest = (scope: string, code: string) => createHash('sha256').update(`${scope}:${code}`).digest('hex');
export async function walletActionCode(tx: Prisma.TransactionClient, user: { isTwoFactorEnabled: boolean; email: string | null }, scope: string, code?: string | null) {
  if (!user.isTwoFactorEnabled) return null;
  if (!user.email) throw new WalletLinkError('Add an email before changing your wallet settings.', 403);
  if (!code) {
    const nextCode = randomInt(100_000, 1_000_000).toString();
    await tx.twoFactorToken.deleteMany({ where: { email: scope } });
    await tx.twoFactorToken.create({ data: { email: scope, token: digest(scope, nextCode), expires: new Date(Date.now() + 300_000) } });
    return { twoFactor: true as const, email: user.email, code: nextCode };
  }
  const token = await tx.twoFactorToken.findFirst({ where: { email: scope } });
  if (!token || !/^\d{6}$/.test(code) || !/^[a-f0-9]{64}$/.test(token.token)
    || !timingSafeEqual(Buffer.from(digest(scope, code)), Buffer.from(token.token))) {
    throw new WalletLinkError('Incorrect code. Use the six digits for this wallet action.');
  }
  const consumed = await tx.twoFactorToken.deleteMany({ where: { id: token.id, token: token.token, expires: { gt: new Date() } } });
  if (consumed.count !== 1) throw new WalletLinkError('Code expired or already used. Request a new code.');
  return null;
}
