'use server'

import { dbPrisma } from "@/lib/db"
import { getUserByEmail } from "@/data/user"
import { getVerificationTokenByToken } from "@/data/verificiation-token"
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { allowAuthAttempt, AUTH_RETRY_MESSAGE } from '@/lib/auth-rate-limit';

type VerificationResult =
  | { error: string }
  | { success: string }
  | { success: string; loginToken: string; email: string };

export const MyNewVerificationAction = async (token: string): Promise<VerificationResult> => {
  if (!z.string().uuid().safeParse(token).success) return { error: 'This verification link is invalid or expired.' };
  if (!await allowAuthAttempt('verify-complete', token)) return { error: AUTH_RETRY_MESSAGE };
  const existingToken = await getVerificationTokenByToken(token);
  if (!existingToken){
    return { error: "Token does not exist!" };
  }

  const hasExpired = new Date(existingToken.expires) < new Date();
  if (hasExpired){
    return { error: "Token has expired!" };
  }

  const existingUser = await getUserByEmail(existingToken.email);
  if (!existingUser){
    return { error: "Email does not exist!" };
  }
  
  try {
    return await dbPrisma.$transaction(async tx => {
      const consumed = await tx.verificationToken.deleteMany({ where: { id: existingToken.id, expires: { gt: new Date() } } });
      if (consumed.count !== 1) return { error: 'This verification link is expired or already used.' };
      const user = await tx.user.update({ where: { id: existingUser.id }, data: { emailVerified: new Date() } });
      // Email verification must not replace an existing second factor.
      if (user.isTwoFactorEnabled) return { success: 'Email verified! Sign in to complete two-factor authentication.' };
      await tx.emailLoginToken.deleteMany({ where: { email: existingToken.email } });
      const loginToken = await tx.emailLoginToken.create({ data: { email: existingToken.email, token: randomUUID(), expires: new Date(Date.now() + 5 * 60_000) } });
      return { success: 'Email verified!', loginToken: loginToken.token, email: existingToken.email };
    });
  } catch {
    return { error: 'Verification is temporarily unavailable. Please try again.' };
  }
}
