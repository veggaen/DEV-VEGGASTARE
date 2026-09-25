/** @fileOverview Owned-wallet rename, receiving choice and removal. @stability evolving */
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { mutateWallet } from '@/lib/wallet-mutation';
import { walletLinkRequest, walletLinkResponse, walletLinkFailure } from '@/lib/wallet-link-request';
import { sendTwoFactorTokenEmail, sendWalletLinkedEmail } from '@/lib/mail';
import { recalculateVerificationTier } from '@/lib/verification-recalc';

const code = z.string().regex(/^\d{6}$/).optional().nullable();
const codeOnly = z.object({ code }).strict();
const patch = z.union([
  z.object({ action: z.literal('rename'), label: z.string().trim().min(1).max(64) }).strict(),
  z.object({ action: z.literal('setPrimary'), code }).strict(),
  // Exact legacy code-only shape for already-open tabs. Invalid rename/unknown
  // fields must never fall through to receiving-wallet changes.
  codeOnly.transform(value => ({ ...value, action: 'setPrimary' as const })),
]);
type Context = { params: Promise<{ walletId: string }> };
async function handle(req: NextRequest, ctx: Context, method: 'PATCH' | 'DELETE') {
  try {
    const auth = await walletLinkRequest(req);
    if (auth instanceof Response) return auth;
    const { walletId } = await ctx.params;
    if (!walletId || walletId.length > 200) return walletLinkResponse({ error: 'Invalid wallet.' }, 400);
    const body: unknown = await req.json().catch(() => null);
    const parsed = method === 'PATCH' ? patch.safeParse(body) : codeOnly.transform(value => ({ ...value, action: 'unlink' as const })).safeParse(body);
    if (!parsed.success) return walletLinkResponse({ error: 'Check the wallet action, label or six-digit code.' }, 400);
    const result = await mutateWallet({ ...auth, walletId, ...parsed.data });
    if (result.twoFactor) {
      await sendTwoFactorTokenEmail(result.email, result.code);
      return walletLinkResponse({ twoFactor: true });
    }
    if (method === 'DELETE') {
      await recalculateVerificationTier(auth.userId).catch(() => null);
      if (result.user.email) void sendWalletLinkedEmail(result.user.email, {
        walletAddress: result.wallet.address, chainFamily: 'EVM', chainId: result.wallet.chainId,
        action: 'unlinked', userName: result.user.name,
      }).catch(() => console.error('[wallet-change] Confirmation email failed'));
    }
    return walletLinkResponse({ ok: true });
  } catch (error) { return walletLinkFailure(error, 'Unable to confirm the wallet change. Refresh your wallets before trying again.'); }
}
export const PATCH = (req: NextRequest, ctx: Context) => handle(req, ctx, 'PATCH');
export const DELETE = (req: NextRequest, ctx: Context) => handle(req, ctx, 'DELETE');
