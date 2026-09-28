/** @fileOverview Atomic personal/company receiving choices with fresh ownership and approval. @stability evolving */
import { dbPrisma } from '@/lib/db';
import { lockedWalletUser, WalletLinkError } from '@/lib/wallet-link';
import { walletActionCode } from '@/lib/wallet-action-code';
export type PayoutTarget = { target: 'user' } | { target: 'company'; companyId: string };
export type PayoutChoice = { action: 'set'; walletId: string; expectedWalletId: string | null } | { action: 'clear'; expectedWalletId: string };
export async function changePayoutWallet(input: PayoutTarget & PayoutChoice & { userId: string; origin: string; code?: string | null }) {
  return dbPrisma.$transaction(async tx => {
    const user = await lockedWalletUser(tx, input.userId);
    let current = user.defaultReceivingWalletId;
    if (input.target === 'company') {
      await tx.$queryRaw`SELECT "id" FROM "Company" WHERE "id" = ${input.companyId} FOR UPDATE`;
      const company = await tx.company.findUnique({ where: { id: input.companyId }, select: { ownerId: true, defaultReceivingWalletId: true } });
      if (!company || company.ownerId !== user.id) throw new WalletLinkError('Only the current company owner can change its receiving wallet.', 403);
      current = company.defaultReceivingWalletId;
    }
    if (current !== input.expectedWalletId) {
      throw new WalletLinkError('The receiving wallet changed. Refresh and review the current choice.', 409);
    }
    const walletId = input.action === 'set' ? input.walletId : input.expectedWalletId;
    await tx.$queryRaw`SELECT "id" FROM "Wallet" WHERE "id" = ${walletId} FOR UPDATE`;
    const wallet = await tx.wallet.findUnique({ where: { id: walletId }, select: { id: true, address: true, family: true, verifiedAt: true, ownerUserId: true, ownerCompanyId: true } });
    if (!wallet) throw new WalletLinkError('Wallet not found. Refresh the available wallets.', 404);
    const personal = wallet.ownerUserId === user.id && wallet.ownerCompanyId === null;
    const companyOwned = input.target === 'company' && wallet.ownerCompanyId === input.companyId && wallet.ownerUserId === null;
    // Clearing a pointer is allowed even after a company ownership transfer.
    // It cannot select an address or modify the former owner's wallet flags.
    if (input.action === 'set' && !personal && !companyOwned) throw new WalletLinkError('This wallet does not belong to you or this company.', 403);
    if (input.action === 'set' && !wallet.verifiedAt) throw new WalletLinkError('Verify ownership before choosing this wallet.', 409);
    const targetId = input.target === 'company' ? input.companyId : user.id;
    const gate = await walletActionCode(tx, user, `payout-choice:${user.id}:${input.origin}:${input.target}:${targetId}:${input.action}:${walletId}:${current ?? 'none'}`, input.code);
    if (gate) return gate;
    const nextId = input.action === 'set' ? wallet.id : null;
    if (input.target === 'company') {
      // A company using its owner's personal wallet must not change that
      // person's default. Only company-owned flags and its pointer are changed.
      await tx.wallet.updateMany({ where: { ownerCompanyId: input.companyId, ownerUserId: null }, data: { isDefault: false } });
      if (nextId && companyOwned) await tx.wallet.update({ where: { id: wallet.id }, data: { isDefault: true }, select: { id: true } });
      await tx.company.update({ where: { id: input.companyId }, data: { defaultReceivingWalletId: nextId }, select: { id: true } });
    } else {
      await tx.wallet.updateMany({ where: { ownerUserId: user.id, ownerCompanyId: null }, data: { isDefault: false } });
      if (nextId) await tx.wallet.update({ where: { id: wallet.id }, data: { isDefault: true }, select: { id: true } });
      await tx.user.update({ where: { id: user.id }, data: { defaultReceivingWalletId: nextId }, select: { id: true } });
    }
    return { ok: true as const };
  });
}
