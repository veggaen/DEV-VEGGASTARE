import { randomBytes } from 'node:crypto';
import { z } from 'zod';
import { isAddress } from 'viem';
import { allowAuthAttempt, AUTH_RETRY_MESSAGE } from '@/lib/auth-rate-limit';
import { createWalletLoginChallenge, WALLET_LOGIN_TTL } from '@/lib/wallet-login';
import { walletLoginContext, walletLoginCookieName, walletLoginFailure, walletLoginResponse } from '@/lib/wallet-login-request';

const schema = z.object({ address: z.string().refine(isAddress), chainId: z.number().int().positive().max(2147483647) }).strict();
export async function POST(request: Request) {
  try {
    const context = walletLoginContext(request, false);
    const parsed = schema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return walletLoginResponse({ error: 'Choose a wallet and network.' }, 400);
    if (!await allowAuthAttempt('wallet-login-nonce', parsed.data.address, request)) return walletLoginResponse({ error: AUTH_RETRY_MESSAGE }, 429);
    const browser = context.browser || randomBytes(32).toString('hex');
    const challenge = await createWalletLoginChallenge({ ...context, browser, ...parsed.data });
    const response = walletLoginResponse(challenge, 201);
    response.cookies.set(walletLoginCookieName(context.origin), browser, { httpOnly: true, secure: context.origin.startsWith('https:'), sameSite: 'lax', path: '/', maxAge: WALLET_LOGIN_TTL / 1000 });
    return response;
  } catch (error) { return walletLoginFailure(error); }
}
