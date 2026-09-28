'use server'

import * as z from 'zod'
import bcrypt from 'bcryptjs'
import { MyAuthNewPasswordSchema } from '@/schemas'
import { getPasswordResetTokenByToken } from '@/data/password-reset-token';
import { getUserByEmail } from '@/data/user';
import { dbPrisma } from '@/lib/db';
import { allowAuthAttempt, AUTH_RETRY_MESSAGE } from '@/lib/auth-rate-limit';

type NewPasswordResult = { error: string } | { success: string };

export const MyNewPasswordAction = async (values: z.infer<typeof MyAuthNewPasswordSchema> , token?: string | null ): Promise<NewPasswordResult> => {
    if (!token || !z.string().uuid().safeParse(token).success) return { error: 'This reset link is invalid or expired. Request a new one.' };
    if (!await allowAuthAttempt('reset-complete', token)) return { error: AUTH_RETRY_MESSAGE };

    const validatedFields = MyAuthNewPasswordSchema.safeParse(values);
    if (!validatedFields.success){
        return { error: "Invalid fields!" };
    }  
    const { password } = validatedFields.data;

    const existingToken = await getPasswordResetTokenByToken(token);  
    if (!existingToken){
        return { error: "Token does not exist!" };
    }  
      
    const hasExpired = new Date(existingToken.expires) < new Date();
    if (hasExpired){
        return { error: "Token has expired!" };
    }  
      
    const existingUser = await getUserByEmail(existingToken.email);
    if (!existingUser) {
        return { error: "Email does not exist!" };
    }
    
    try {
      const hashedPassword = await bcrypt.hash(password, 12);
      const changed = await dbPrisma.$transaction(async tx => {
        // Concurrent requests must win a single-use consume before changing the password.
        const consumed = await tx.passwordResetToken.deleteMany({ where: { id: existingToken.id, expires: { gt: new Date() } } });
        if (consumed.count !== 1) return false;
        await tx.user.update({ where: { id: existingUser.id }, data: { password: hashedPassword, tokenVersion: { increment: 1 } } });
        await tx.emailLoginToken.deleteMany({ where: { email: existingToken.email } });
        await tx.twoFactorToken.deleteMany({ where: { email: existingToken.email } });
        return true;
      });
      return changed ? { success: 'Password updated! Sign in with your new password.' } : { error: 'This reset link is invalid or already used. Request a new one.' };
    } catch {
      return { error: 'We could not reset your password. Please try again shortly.' };
    }
};
