import type { Hex } from 'viem';
import { allowAuthAttempt, AUTH_RETRY_MESSAGE } from '@/lib/auth-rate-limit';
import { prepareWalletLogin } from '@/lib/wallet-login';
import { walletLoginContext, walletLoginProofSchema, walletLoginResponse, walletLoginFailure } from '@/lib/wallet-login-request';
import { sendTwoFactorTokenEmail } from '@/lib/mail';
export async function POST(request: Request) {
  try {
    const context = walletLoginContext(request);
    const parsed = walletLoginProofSchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return walletLoginResponse({ error: 'Start wallet sign-in again.' }, 400);
    if (!await allowAuthAttempt('wallet-login-prepare', parsed.data.challengeId, request)) return walletLoginResponse({ error: AUTH_RETRY_MESSAGE }, 429);
    const gate = await prepareWalletLogin({ ...context, ...parsed.data, signature: parsed.data.signature as Hex });
    if (gate) {
      await sendTwoFactorTokenEmail(gate.email, gate.code);
      return walletLoginResponse({ twoFactor: true });
    }
    return walletLoginResponse({ ready: true });
  } catch (error) { return walletLoginFailure(error); }
}
