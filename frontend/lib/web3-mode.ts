/** @fileOverview Web3 changes share the account lock with wallet and OAuth mutations. @stability evolving */
import { dbPrisma } from '@/lib/db';
import { isDemoUserId } from '@/lib/demo-policy';
import { WalletLinkError } from '@/lib/wallet-link';
import { walletActionCode } from '@/lib/wallet-action-code';
export function configuredWeb2Providers(env: NodeJS.ProcessEnv = process.env) {
  return [
    ['google', env.AUTH_GOOGLE_ID || env.GOOGLE_CLIENT_ID, env.AUTH_GOOGLE_SECRET || env.GOOGLE_CLIENT_SECRET],
    ['github', env.AUTH_GITHUB_ID || env.GITHUB_ID || env.GITHUB_CLIENT_ID, env.AUTH_GITHUB_SECRET || env.GITHUB_SECRET || env.GITHUB_CLIENT_SECRET],
    ['discord', env.AUTH_DISCORD_ID || env.DISCORD_CLIENT_ID, env.AUTH_DISCORD_SECRET || env.DISCORD_CLIENT_SECRET],
  ].filter(([, id, secret]) => id && secret).map(([provider]) => provider!);
}
export async function changeWeb3Mode(input: { userId: string; origin: string; enabled: boolean; expectedEnabled: boolean; code?: string }) {
  if (isDemoUserId(input.userId)) throw new WalletLinkError('Web3 settings cannot be changed in the demo.', 403);
  if (input.enabled === input.expectedEnabled) throw new WalletLinkError('Choose a different Web3 setting.');
  return dbPrisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${input.userId} FOR UPDATE`;
    const user = await tx.user.findUnique({ where: { id: input.userId }, select: {
      id: true, email: true, emailVerified: true, password: true, web3ModeEnabled: true, isTwoFactorEnabled: true,
      Account: { where: { provider: { in: configuredWeb2Providers() } }, select: { id: true } },
    } });
    if (!user) throw new WalletLinkError('Sign in again to change Web3 settings.', 401);
    if (user.web3ModeEnabled !== input.expectedEnabled) throw new WalletLinkError('Web3 settings changed in another tab. Refresh before trying again.', 409);
    if (!input.enabled && !(user.password && user.email && user.emailVerified) && !user.Account.length) {
      throw new WalletLinkError('Add an email/password or another working sign-in method before disabling wallet sign-in.', 409);
    }
    if (user.isTwoFactorEnabled && (!user.email || !user.emailVerified)) throw new WalletLinkError('Verify your email before changing Web3 settings.', 403);
    const prefix = `web3-mode:${user.id}:`;
    const scope = `${prefix}${input.origin}:${input.expectedEnabled}:${input.enabled}:${user.email ?? ''}`;
    const gate = await walletActionCode(tx, user, scope, input.code);
    if (gate) return gate;
    await tx.user.update({ where: { id: user.id }, data: { web3ModeEnabled: input.enabled }, select: { id: true } });
    await tx.twoFactorToken.deleteMany({ where: { email: { startsWith: prefix } } });
    return { success: true as const, web3ModeEnabled: input.enabled };
  });
}
