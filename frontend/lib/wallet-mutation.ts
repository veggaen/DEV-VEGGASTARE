/** @fileOverview Explicit wallet changes with one-use, action-bound email codes. @stability evolving */
import { dbPrisma } from '@/lib/db';
import { lockedWalletUser, WalletLinkError } from '@/lib/wallet-link';
import { walletActionCode } from '@/lib/wallet-action-code';
import { isAddress } from 'viem';

type Mutation = { action: 'rename'; label: string } | { action: 'setPrimary' | 'unlink'; code?: string | null };

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
      if (wallet.verifiedAt) {
        const account = await tx.user.findUnique({ where: { id: user.id }, select: {
          password: true, emailVerified: true, Account: { where: { provider: { in: ['google', 'github', 'discord'] } }, select: { id: true } },
        } });
        if (!(account?.password && account.emailVerified) && !account?.Account.length) {
          const alternatives = await tx.wallet.findMany({ where: { id: { not: wallet.id }, ownerUserId: user.id, ownerCompanyId: null, family: 'EVM', verifiedAt: { not: null } }, select: { address: true } });
          let canSignIn = false;
          for (const alternative of alternatives) {
            if (!isAddress(alternative.address)) continue;
            const ambiguous = await tx.wallet.findFirst({ where: { family: 'EVM', ownerCompanyId: null, ownerUserId: { not: user.id }, verifiedAt: { not: null }, address: { equals: alternative.address, mode: 'insensitive' } }, select: { id: true } });
            if (!ambiguous) { canSignIn = true; break; }
          }
          if (!canSignIn) throw new WalletLinkError('Add another sign-in method before unlinking your last sign-in wallet.', 409);
        }
      }
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
    const gate = await walletActionCode(tx, user, `wallet-change:${user.id}:${input.origin}:${input.action}:${wallet.id}`, input.code);
    if (gate) return gate;
    if (input.action === 'setPrimary') {
      await tx.wallet.updateMany({ where: { ownerUserId: user.id, ownerCompanyId: null }, data: { isDefault: false } });
      await tx.wallet.update({ where: { id: wallet.id }, data: { isDefault: true }, select: { id: true } });
      await tx.user.update({ where: { id: user.id }, data: { defaultReceivingWalletId: wallet.id }, select: { id: true } });
    } else {
      if (user.defaultReceivingWalletId === wallet.id) {
        await tx.user.update({ where: { id: user.id }, data: { defaultReceivingWalletId: null }, select: { id: true } });
        await tx.wallet.updateMany({ where: { ownerUserId: user.id, ownerCompanyId: null }, data: { isDefault: false } });
      }
      // Never choose a replacement address without the owner's explicit action.
      await tx.wallet.delete({ where: { id: wallet.id }, select: { id: true } });
    }
    return { ok: true as const, user, wallet };
  });
}
