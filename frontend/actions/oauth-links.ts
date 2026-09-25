/** @fileOverview Authenticated OAuth confirmation, resend and safe unlink actions. @stability stable */
'use server';

import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import type { Prisma } from '@/generated/prisma/client';
import { auth } from '@/auth';
import { dbPrisma } from '@/lib/db';
import { allowAuthAttempt } from '@/lib/auth-rate-limit';
import { isDemoUserId } from '@/lib/demo-policy';
import { OAUTH_PROVIDERS, isOAuthProvider, type OAuthProvider } from '@/lib/oauth-link-state';
import { sendOauthLinkConfirmationEmail } from '@/lib/mail';
import { recalculateVerificationTier } from '@/lib/verification-recalc';

const providerSchema = z.enum(['google', 'github', 'discord']);
const confirmationSchema = z.object({ token: z.string().regex(/^[a-zA-Z0-9-]{20,100}$/), deny: z.boolean() }).strict();
type Result = { ok: true; provider: OAuthProvider; verified?: boolean } | { ok: false; error: string };

async function actor() {
  const session = await auth();
  if (!session?.user?.id || isDemoUserId(session.user.id)) return null;
  if (!await allowAuthAttempt('oauth-link-management', session.user.id)) return null;
  return session.user.id;
}
const retry: Result = { ok: false, error: 'Please sign in to your own account or try again in a few minutes.' };
const stale: Result = { ok: false, error: 'This link is unavailable for this account. Request a new confirmation email.' };

/** Serialize confirmation, resend and unlink, including different providers. */
async function lockUser(tx: Prisma.TransactionClient, userId: string) {
  await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`;
}

export async function resendOauthConfirmation(value: unknown): Promise<Result> {
  const parsed = providerSchema.safeParse(value);
  if (!parsed.success) return { ok: false, error: 'Choose Google, GitHub or Discord.' };
  const userId = await actor();
  if (!userId) return retry;
  const provider = parsed.data, token = randomUUID();
  try {
    const recipient = await dbPrisma.$transaction(async tx => {
      await lockUser(tx, userId);
      const user = await tx.user.findUnique({ where: { id: userId }, select: {
        email: true, name: true, hasGoogleAuth: true, hasGithubAuth: true, hasDiscordAuth: true,
      } });
      const account = await tx.account.findFirst({ where: { userId, provider }, select: { id: true } });
      if (!user?.email || !account) return null;
      if (user[OAUTH_PROVIDERS[provider].flag]) return { verified: true as const };
      const expires = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await tx.pendingOAuthLink.upsert({ where: { userId_provider: { userId, provider } },
        create: { userId, provider, token, expires }, update: { token, expires } });
      return { email: user.email, name: user.name };
    });
    if (!recipient) return { ok: false, error: 'Connect this provider first and check your account email.' };
    if ('verified' in recipient) return { ok: true, provider, verified: true };
    await sendOauthLinkConfirmationEmail(recipient.email, { provider, userName: recipient.name, token });
    return { ok: true, provider };
  } catch {
    // Do not leave a failed send looking delivered or delete a newer request.
    await dbPrisma.pendingOAuthLink.deleteMany({ where: { userId, provider, token } }).catch(() => undefined);
    return { ok: false, error: 'The confirmation email could not be sent. Please try again shortly.' };
  }
}

export async function confirmOauthLink(value: unknown): Promise<Result> {
  const parsed = confirmationSchema.safeParse(value);
  if (!parsed.success) return stale;
  const userId = await actor();
  if (!userId) return retry;
  try {
    const result: Result = await dbPrisma.$transaction(async tx => {
      await lockUser(tx, userId);
      const pending = await tx.pendingOAuthLink.findUnique({ where: { token: parsed.data.token } });
      if (!pending || pending.userId !== userId || pending.expires <= new Date() || !isOAuthProvider(pending.provider)) return stale;
      const provider = pending.provider;
      const account = await tx.account.findFirst({ where: { userId, provider }, select: { id: true } });
      if (!account) return stale;
      if (parsed.data.deny && !await canRemove(tx, userId, provider)) return lastMethod;
      const consumed = await tx.pendingOAuthLink.deleteMany({ where: { id: pending.id, token: parsed.data.token, userId } });
      if (consumed.count !== 1) return stale;
      if (parsed.data.deny) await tx.account.deleteMany({ where: { userId, provider } });
      await tx.user.update({ where: { id: userId }, data: { [OAUTH_PROVIDERS[provider].flag]: !parsed.data.deny }, select: { id: true } });
      return { ok: true, provider, verified: !parsed.data.deny };
    });
    if (result.ok) await recalculateVerificationTier(userId);
    return result;
  } catch { return { ok: false, error: 'The link could not be updated. Please try again.' }; }
}

const lastMethod: Result = { ok: false, error: 'Keep at least one sign-in method. Add a password with a verified email or connect another provider first.' };
async function canRemove(tx: Prisma.TransactionClient, userId: string, provider: OAuthProvider) {
  const user = await tx.user.findUnique({ where: { id: userId }, select: { password: true, emailVerified: true } });
  if (user?.password && user.emailVerified) return true;
  return Boolean(await tx.account.findFirst({ where: { userId, provider: { in: Object.keys(OAUTH_PROVIDERS).filter(p => p !== provider) } }, select: { id: true } }));
}
export async function unlinkOauthProvider(value: unknown): Promise<Result> {
  const parsed = providerSchema.safeParse(value);
  if (!parsed.success) return { ok: false, error: 'Choose Google, GitHub or Discord.' };
  const userId = await actor();
  if (!userId) return retry;
  try {
    const provider = parsed.data;
    const result: Result = await dbPrisma.$transaction(async tx => {
      await lockUser(tx, userId);
      if (!await canRemove(tx, userId, provider)) return lastMethod;
      await tx.account.deleteMany({ where: { userId, provider } });
      await tx.pendingOAuthLink.deleteMany({ where: { userId, provider } });
      await tx.user.update({ where: { id: userId }, data: { [OAUTH_PROVIDERS[provider].flag]: false }, select: { id: true } });
      return { ok: true, provider };
    });
    if (result.ok) await recalculateVerificationTier(userId);
    return result;
  } catch { return { ok: false, error: 'The provider could not be removed. Please try again.' }; }
}
