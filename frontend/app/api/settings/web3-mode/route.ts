/** @fileOverview Read current Web3 state; explicitly approve account-bound changes. @stability evolving */
import { z } from 'zod';
import { MyLibUserAuth } from '@/lib/user-auth';
import { dbPrisma } from '@/lib/db';
import { isDemoUserId } from '@/lib/demo-policy';
import { allowAuthAttempt, AUTH_RETRY_MESSAGE } from '@/lib/auth-rate-limit';
import { changeWeb3Mode } from '@/lib/web3-mode';
import { walletLinkResponse as reply, walletLinkFailure } from '@/lib/wallet-link-request';
import { sendTwoFactorTokenEmail } from '@/lib/mail';
const bodySchema = z.object({ enabled: z.boolean(), expectedEnabled: z.boolean(), code: z.string().regex(/^\d{6}$/).optional() }).strict();
export async function GET() {
  try {
    const session = await MyLibUserAuth();
    if (!session?.id) return reply({ error: 'Sign in to view Web3 settings.' }, 401);
    const user = await dbPrisma.user.findUnique({ where: { id: session.id }, select: { web3ModeEnabled: true } });
    return user ? reply(user) : reply({ error: 'Sign in again to view Web3 settings.' }, 401);
  } catch (error) { return walletLinkFailure(error, 'Web3 settings could not load. Please retry.'); }
}
export async function PATCH(request: Request) {
  try {
    const origin = new URL(request.url).origin;
    if (request.headers.get('origin') !== origin) return reply({ error: 'Open Web3 settings on this site and try again.' }, 403);
    const session = await MyLibUserAuth();
    if (!session?.id) return reply({ error: 'Sign in to change Web3 settings.' }, 401);
    if (isDemoUserId(session.id)) return reply({ error: 'Web3 settings cannot be changed in the demo.' }, 403);
    if (!await allowAuthAttempt('web3-mode', session.id, request)) return reply({ error: AUTH_RETRY_MESSAGE }, 429);
    const parsed = bodySchema.safeParse(await request.json().catch(() => null));
    if (!parsed.success) return reply({ error: 'Refresh Web3 settings and check the six-digit code, if requested.' }, 400);
    const result = await changeWeb3Mode({ ...parsed.data, userId: session.id, origin });
    if ('twoFactor' in result) {
      await sendTwoFactorTokenEmail(result.email, result.code);
      return reply({ twoFactor: true });
    }
    return reply(result);
  } catch (error) { return walletLinkFailure(error, 'Could not confirm the change. Refresh Web3 settings before trying again.'); }
}
