import 'server-only';
import bcrypt from 'bcryptjs';
import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { dbPrisma } from '@/lib/db';
import { isDemoUserId } from '@/lib/demo-policy';
import { sendAccountSecurityCode } from '@/lib/mail';
import { accountSettingsSchema, type AccountSettingsResult } from './account-settings-policy';
import type { Prisma } from '@/generated/prisma/client';

export class AccountSettingsError extends Error {}
const select = { id: true, email: true, emailVerified: true, password: true, role: true, updatedAt: true,
  tokenVersion: true, isTwoFactorEnabled: true } satisfies Prisma.UserSelect;
function deny(message: string): never { throw new AccountSettingsError(message); }
const digest = (secret: string, value: string) => createHmac('sha256', secret).update(value).digest('hex');

/** Internal service; userId/origin must come from the authenticated action. */
export async function saveAccountSettings(userId: string, origin: string, raw: unknown): Promise<AccountSettingsResult> {
  if (isDemoUserId(userId)) deny('Use your own account to change account settings.');
  const parsed = accountSettingsSchema.safeParse(raw);
  if (!parsed.success) deny('Review the fields and reload Settings if this form is out of date.');
  const input = parsed.data;
  const current = await dbPrisma.user.findUnique({ where: { id: userId }, select });
  if (!current) deny('Sign in again to update your settings.');
  if (input.role !== undefined && input.role !== current.role) deny('Account roles cannot be changed in personal settings.');
  // Registration verification does not bind a replacement address to this user.
  // Never send that old, unsafe link or claim that it changed their account.
  if (input.email !== undefined && input.email !== current.email?.toLowerCase()) deny('Email changes need a separate verified account-change flow. Your email has not changed.');
  if (input.isTwoFactorEnabled !== undefined && input.expectedTwoFactorEnabled !== current.isTwoFactorEnabled) deny('Your security settings changed. Reload this page and review them again.');
  const factorChanged = input.isTwoFactorEnabled !== undefined && input.isTwoFactorEnabled !== current.isTwoFactorEnabled;
  const sensitive = !!input.newPassword || factorChanged;
  if (input.newPassword && !current.password) deny('Use password recovery to set a password for this account.');
  if (sensitive && current.password && (!input.password || !await bcrypt.compare(input.password, current.password))) deny('Enter your correct current password to change security settings.');
  if (input.password && !sensitive) deny('Choose a new password or change the security setting before submitting your current password.');
  const codeRequired = sensitive && (current.isTwoFactorEnabled || !current.password || input.isTwoFactorEnabled === true);
  if (codeRequired && (!current.email || !current.emailVerified)) deny('Verify your account email before changing security settings.');
  const secret = process.env.AUTH_SECRET || process.env.NEXTAUTH_SECRET;
  if (codeRequired && !secret) deny('Security confirmation is temporarily unavailable. Try again later.');
  // Host, account, exact change and saved security state are all bound to the
  // confirmation. No password or recipient is stored in the token scope.
  const scope = `account-settings:${userId}:${digest(secret || 'not-used', JSON.stringify({ origin, version: current.tokenVersion,
    updated: current.updatedAt.toISOString(), newPassword: input.newPassword || '', factor: input.isTwoFactorEnabled }))}`;
  const newHash = input.newPassword ? await bcrypt.hash(input.newPassword, 12) : undefined;
  const result = await dbPrisma.$transaction(async tx => {
    await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`;
    const latest = await tx.user.findUnique({ where: { id: userId }, select });
    if (!latest || latest.updatedAt.getTime() !== current.updatedAt.getTime() || latest.password !== current.password
      || latest.tokenVersion !== current.tokenVersion || latest.role !== current.role || latest.email !== current.email
      || latest.isTwoFactorEnabled !== current.isTwoFactorEnabled) deny('Your account changed. Reload Settings and review the change again.');
    if (codeRequired) {
      if (!input.securityCode) {
        const code = randomInt(100_000, 1_000_000).toString();
        await tx.twoFactorToken.deleteMany({ where: { email: scope } });
        const token = await tx.twoFactorToken.create({ data: { email: scope, token: digest(secret!, `${scope}:${code}`), expires: new Date(Date.now() + 300_000) }, select: { id: true } });
        return { challenge: true as const, code, tokenId: token.id };
      }
      const token = await tx.twoFactorToken.findFirst({ where: { email: scope } });
      const candidate = digest(secret!, `${scope}:${input.securityCode}`);
      if (!token || !/^[a-f0-9]{64}$/.test(token.token) || !timingSafeEqual(Buffer.from(candidate), Buffer.from(token.token))) deny('Incorrect or expired code. Request a new security code.');
      const consumed = await tx.twoFactorToken.deleteMany({ where: { id: token.id, token: candidate, expires: { gt: new Date() } } });
      if (consumed.count !== 1) deny('Code expired or already used. Request a new security code.');
    }
    // Explicit allowlist. Never spread caller data into a Prisma update.
    const data: Prisma.UserUpdateInput = {};
    if (input.name !== undefined) data.name = input.name;
    if (input.identityNameSource !== undefined) data.identityNameSource = input.identityNameSource;
    if (input.identityImageSource !== undefined) data.identityImageSource = input.identityImageSource;
    if (input.emailDisplayMode !== undefined) data.emailDisplayMode = input.emailDisplayMode;
    if (newHash) data.password = newHash;
    if (factorChanged) data.isTwoFactorEnabled = input.isTwoFactorEnabled;
    if (sensitive) data.tokenVersion = { increment: 1 };
    if (Object.keys(data).length === 0) deny('No settings changed.');
    data.updatedAt = new Date(Math.max(Date.now(), current.updatedAt.getTime() + 1));
    await tx.user.update({ where: { id: userId }, data, select: { id: true } });
    if (sensitive) {
      if (current.email) {
        await tx.passwordResetToken.deleteMany({ where: { email: current.email } });
        await tx.emailLoginToken.deleteMany({ where: { email: current.email } });
        await tx.twoFactorToken.deleteMany({ where: { email: current.email } });
      }
      await tx.twoFactorToken.deleteMany({ where: { email: { startsWith: `account-settings:${userId}:` } } });
      await tx.twoFactorConfirmation.deleteMany({ where: { userId } });
    }
    return { challenge: false as const };
  }, { timeout: 10_000, maxWait: 5_000 });
  if (result.challenge) {
    try { await sendAccountSecurityCode(current.email!, result.code); }
    catch {
      // Do not revoke a newer request if two sends overlapped.
      await dbPrisma.twoFactorToken.deleteMany({ where: { id: result.tokenId } });
      deny('The security email could not be sent. Nothing changed; try again later.');
    }
    return { twoFactor: true };
  }
  return sensitive ? { success: 'Security settings updated. Sign in again.', signInRequired: true } : { success: 'Settings saved.' };
}
