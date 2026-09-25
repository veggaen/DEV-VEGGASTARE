/** @fileOverview Explicit wallet changes with one-use, action-bound email codes. @stability evolving */
import { createHash, randomInt, timingSafeEqual } from 'node:crypto';
import { dbPrisma } from '@/lib/db';
import { lockedWalletUser, WalletLinkError } from '@/lib/wallet-link';

type Mutation = { action: 'rename'; label: string } | { action: 'setPrimary' | 'unlink'; code?: string | null };
const digest = (scope: string, code: string) => createHash('sha256').update(`${scope}:${code}`).digest('hex');

export async function mutateWallet(input: { userId: string; origin: string; walletId: string } & Mutation) {
  return dbPrisma.$transaction(async tx => {
    const user = await lockedWalletUser(tx, input.userId);
    // Lock before checking references: a concurrent FK assignment must not be
    // silently cleared by a delete after the checks below.
    await tx.$queryRaw`SELECT "id" FROM "Wallet" WHERE "id" = ${input.walletId} FOR UPDATE`;
    const wallet = await tx.wallet.findFirst({ where: {
      id: input.walletId, ownerUserId: user.id, ownerCompanyId: null, family: 'EVM',
    } });
    if (!wallet) throw new WalletLinkError('Wallet not found.', 404);
    if (input.action === 'rename') {
      await tx.wallet.update({ where: { id: wallet.id }, data: { label: input.label }, select: { id: true } });
      return { ok: true as const, user, wallet };
    }
    if (input.action === 'setPrimary' && !wallet.verifiedAt) {
      throw new WalletLinkError('Verify this wallet before using it for sales.', 409);
    }
    if (input.action === 'unlink') {
      const references = await tx.wallet.findUnique({ where: { id: wallet.id }, select: { _count: { select: {
        Product: true, AcceptedTokenReceivers: true, Donation: true, DefaultWalletForCompanies: true,
        DefaultWalletForUsers: { where: { id: { not: user.id } } },
      } } } });
      const counts = references!._count;
      if (counts.Product || counts.AcceptedTokenReceivers || counts.DefaultWalletForCompanies || counts.DefaultWalletForUsers) {
        throw new WalletLinkError('This wallet is used by a product or business. Choose another receiving wallet there first.', 409);
      }
      if (counts.Donation) throw new WalletLinkError('This wallet has donation records and must remain linked to preserve that history.', 409);
    }
    if (user.isTwoFactorEnabled) {
      if (!user.email) throw new WalletLinkError('Add an email before changing your wallet settings.', 403);
      // Cannot reuse a login/link code, change the target wallet, switch actions,
      // or submit a Preview code to production. Only the digest is persisted.
      const scope = `wallet-change:${user.id}:${input.origin}:${input.action}:${wallet.id}`;
      if (!input.code) {
        const code = randomInt(100_000, 1_000_000).toString();
        await tx.twoFactorToken.deleteMany({ where: { email: scope } });
        await tx.twoFactorToken.create({ data: { email: scope, token: digest(scope, code), expires: new Date(Date.now() + 300_000) } });
        return { twoFactor: true as const, email: user.email, code };
      }
      const token = await tx.twoFactorToken.findFirst({ where: { email: scope } });
      if (!token || !/^\d{6}$/.test(input.code) || !/^[a-f0-9]{64}$/.test(token.token)
        || !timingSafeEqual(Buffer.from(digest(scope, input.code)), Buffer.from(token.token))) {
        throw new WalletLinkError('Incorrect code. Use the six digits for this wallet action.');
      }
      const consumed = await tx.twoFactorToken.deleteMany({ where: { id: token.id, token: token.token, expires: { gt: new Date() } } });
      if (consumed.count !== 1) throw new WalletLinkError('Code expired or already used. Request a new code.');
    }
    if (input.action === 'setPrimary') {
      await tx.wallet.updateMany({ where: { ownerUserId: user.id, ownerCompanyId: null, family: 'EVM' }, data: { isDefault: false } });
      await tx.wallet.update({ where: { id: wallet.id }, data: { isDefault: true }, select: { id: true } });
      await tx.user.update({ where: { id: user.id }, data: { defaultReceivingWalletId: wallet.id }, select: { id: true } });
    } else {
      if (user.defaultReceivingWalletId === wallet.id) {
        await tx.user.update({ where: { id: user.id }, data: { defaultReceivingWalletId: null }, select: { id: true } });
        await tx.wallet.updateMany({ where: { ownerUserId: user.id, ownerCompanyId: null, family: 'EVM' }, data: { isDefault: false } });
      }
      // Never choose a replacement address without the owner's explicit action.
      await tx.wallet.delete({ where: { id: wallet.id }, select: { id: true } });
    }
    return { ok: true as const, user, wallet };
  });
}
