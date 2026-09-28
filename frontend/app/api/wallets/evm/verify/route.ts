/** @fileOverview Consume a server challenge and persist proof atomically. @stability evolving */
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { verifyWalletLink } from '@/lib/wallet-link';
import { walletLinkRequest, walletLinkResponse, walletLinkFailure } from '@/lib/wallet-link-request';
import { recalculateVerificationTier } from '@/lib/verification-recalc';
import { sendWalletLinkedEmail } from '@/lib/mail';

const schema = z.object({
  challengeId: z.string().min(1).max(200), signature: z.string().regex(/^0x(?:[0-9a-fA-F]{128}|[0-9a-fA-F]{130})$/),
  label: z.string().trim().min(1).max(64).optional(), connectorType: z.string().trim().max(32).optional(),
  authProvider: z.string().trim().max(32).optional(), socialEmail: z.string().email().max(256).optional(),
}).strict();
export async function POST(req: NextRequest) {
  try {
    const auth = await walletLinkRequest(req);
    if (auth instanceof Response) return auth;
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return walletLinkResponse({ error: 'Start a new wallet verification and sign its request.' }, 400);
    const { wallet, user } = await verifyWalletLink({ ...auth, ...parsed.data, signature: parsed.data.signature as `0x${string}` });
    // Only the transaction winner reaches notifications. Cache refresh cannot
    // turn a committed wallet link into a false failure.
    await recalculateVerificationTier(user.id).catch(() => null);
    if (user.email) void sendWalletLinkedEmail(user.email, {
      walletAddress: wallet.address, chainFamily: 'EVM', chainId: wallet.chainId, action: 'linked', userName: user.name,
    }).catch(() => console.error('[wallet-link] Confirmation email failed'));
    return walletLinkResponse({ ok: true, wallet: {
      id: wallet.id, label: wallet.label, family: wallet.family, chainId: wallet.chainId,
      solanaCluster: wallet.solanaCluster, address: wallet.address, isDefault: wallet.isDefault,
      ownerUserId: wallet.ownerUserId, ownerCompanyId: wallet.ownerCompanyId,
      createdAt: wallet.createdAt.toISOString(), updatedAt: wallet.updatedAt.toISOString(),
      verifiedAt: wallet.verifiedAt?.toISOString() ?? null,
    } });
  } catch (error) { return walletLinkFailure(error); }
}
