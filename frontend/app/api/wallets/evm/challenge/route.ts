/** @fileOverview Issue server-bound wallet ownership challenges. @stability evolving */
import { NextRequest } from 'next/server';
import { z } from 'zod';
import { isAddress } from 'viem';
import { createWalletLinkChallenge } from '@/lib/wallet-link';
import { walletLinkRequest, walletLinkResponse, walletLinkFailure } from '@/lib/wallet-link-request';
import { sendTwoFactorTokenEmail } from '@/lib/mail';

const schema = z.object({
  address: z.string().refine(isAddress), chainId: z.number().int().positive().max(2147483647),
  code: z.string().regex(/^\d{6}$/).nullable().optional(),
}).strict();
export async function POST(req: NextRequest) {
  try {
    const auth = await walletLinkRequest(req);
    if (auth instanceof Response) return auth;
    const parsed = schema.safeParse(await req.json().catch(() => null));
    if (!parsed.success) return walletLinkResponse({ error: 'Check your wallet address, network and six-digit code.' }, 400);
    const result = await createWalletLinkChallenge({ ...auth, ...parsed.data });
    if (result.twoFactor === true) {
      await sendTwoFactorTokenEmail(result.email, result.code);
      return walletLinkResponse({ twoFactor: true });
    }
    return walletLinkResponse(result, 201);
  } catch (error) { return walletLinkFailure(error); }
}
