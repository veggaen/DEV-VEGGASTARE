/**
 * @fileOverview  What happens after an OAuth provider is attached to a user:
 *                backfill the provider's profile fields (never overwrite what
 *                the user set), mark the email verified, and either flag the
 *                provider verified straight away (dev) or open a pending link
 *                that the user confirms from their inbox. Shared by Auth.js'
 *                linkAccount event and the "link to the signed-in user" path.
 * @stability     evolving
 */

import { dbPrisma } from '@/lib/db';
import { recalculateVerificationTier } from '@/lib/verification-recalc';
import { sendOauthLinkConfirmationEmail } from '@/lib/mail';

const isDev = process.env.NODE_ENV !== 'production';
export const requireOauthEmailConfirmation =
  process.env.OAUTH_LINK_REQUIRE_EMAIL_CONFIRMATION === 'true' ||
  (!isDev && process.env.OAUTH_LINK_REQUIRE_EMAIL_CONFIRMATION !== 'false');

export type OauthLinkProvider = 'google' | 'github' | 'discord';
export const isLinkableProvider = (provider: string): provider is OauthLinkProvider =>
  provider === 'google' || provider === 'github' || provider === 'discord';

const FLAG: Record<OauthLinkProvider, 'hasGoogleAuth' | 'hasGithubAuth' | 'hasDiscordAuth'> = {
  google: 'hasGoogleAuth', github: 'hasGithubAuth', discord: 'hasDiscordAuth',
};
const str = (value: unknown) => (typeof value === 'string' && value ? value : undefined);

export async function applyOauthLinkEffects({ userId, userEmail, userName, userImage, provider, profile }: {
  userId: string | undefined;
  userEmail: string | null | undefined;
  userName: string | null | undefined;
  userImage: string | null | undefined;
  provider: string;
  profile: Record<string, unknown> | null | undefined;
}): Promise<void> {
  if (!userId) return;
  const p = profile ?? {};
  const providerProfileName = str(p.name) ?? userName ?? undefined;
  const providerProfileImage = str(p.image) ?? str(p.picture) ?? str(p.avatar_url) ?? userImage ?? undefined;
  const providerProfileEmail = str(p.email) ?? userEmail ?? undefined;

  // A different provider email does not verify the account's primary email.
  // users may have customised name/avatar/email in settings. Only backfill.
  const current = await dbPrisma.user.findUnique({ where: { id: userId }, select: { name: true, image: true, email: true } });
  const primaryEmail = current?.email ?? userEmail;
  const matchesPrimary = Boolean(primaryEmail && providerProfileEmail &&
    primaryEmail.trim().toLowerCase() === providerProfileEmail.trim().toLowerCase() &&
    p.email_verified !== false && p.verified !== false);
  await dbPrisma.user.update({
    where: { id: userId },
    data: {
      ...(matchesPrimary ? { emailVerified: new Date() } : {}),
      name: current?.name ?? userName ?? str(p.name) ?? undefined,
      image: current?.image ?? str(p.image) ?? userImage ?? undefined,
      email: current?.email ?? userEmail ?? undefined,
      ...(provider === 'google' ? { googleProfileName: providerProfileName, googleProfileImage: providerProfileImage, googleProfileEmail: providerProfileEmail } : {}),
      ...(provider === 'github' ? { githubProfileName: providerProfileName, githubProfileImage: providerProfileImage, githubProfileEmail: providerProfileEmail } : {}),
      ...(provider === 'discord' ? { discordProfileName: providerProfileName, discordProfileImage: providerProfileImage, discordProfileEmail: providerProfileEmail } : {}),
    },
  });

  if (!primaryEmail || !isLinkableProvider(provider)) return;

  // hasXxxAuth only flips after the user confirms from their inbox (unless confirmation is off).
  if (!requireOauthEmailConfirmation) {
    await dbPrisma.user.update({ where: { id: userId }, data: { [FLAG[provider]]: true } });
    await dbPrisma.pendingOAuthLink.deleteMany({ where: { userId, provider } });
    await recalculateVerificationTier(userId);
    return;
  }

  // Upsert: replace any existing pending record for this provider (re-linking).
  const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const pending = await dbPrisma.pendingOAuthLink.upsert({
    where: { userId_provider: { userId, provider } },
    update: { token: crypto.randomUUID(), expires },
    create: { userId, provider, expires },
  });
  try {
    await sendOauthLinkConfirmationEmail(primaryEmail, { provider, userName: current?.name ?? userName ?? undefined, token: pending.token });
  } catch {
    console.error('[oauth-link-effects] confirmation email unavailable');
  }
}
