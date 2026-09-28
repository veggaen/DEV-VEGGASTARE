'use server';
import * as z from 'zod'
import bcrypt from 'bcryptjs';

import { signIn } from '@/auth';
import { AuthError } from 'next-auth';
import { DEFAULT_LOGIN_REDIRECT } from '@/routes';
import { getUserByEmail } from '@/data/user';
import { MyAuthLoginSchema } from '@/schemas'
import { sendVerificationEmail, sendTwoFactorTokenEmail } from '@/lib/mail';
import { generateVerificationToken, generateTwoFactorToken } from '@/lib/tokens';
import { allowAuthAttempt, AUTH_RETRY_MESSAGE } from '@/lib/auth-rate-limit';
import { safeAuthRedirect } from '@/lib/auth-navigation';

type LoginResult =
  | { error: string }
  | { success: string }
  | { success: string; redirectUrl: string }
  | { twoFactor: true };

export const MyLoginAction = async (values: z.infer<typeof MyAuthLoginSchema>, callbackUrl?: string | null): Promise<LoginResult> => {
    const validateFields = MyAuthLoginSchema.safeParse(values);

    if (!validateFields.success){
        return { error: 'Invalid fields'}
    }

    const { email, password, code } = validateFields.data;
    if (!await allowAuthAttempt('login-form', email)) return { error: AUTH_RETRY_MESSAGE };

    const existingUser = await getUserByEmail(email);

    // SECURITY: Always run bcrypt.compare to prevent timing attacks
    // For non-existent users, compare against a dummy hash to ensure
    // consistent response times (prevents username/email enumeration)
    const dummyHash = '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';
    const passwordToCompare = existingUser?.password || dummyHash;
    
    const passwordMatch = await bcrypt.compare(password, passwordToCompare);
    
    // Use generic error message for both "user not found" and "wrong password"
    // to prevent email enumeration attacks
    if (!existingUser || !existingUser.email || !existingUser.password || !passwordMatch) {
      return { error: 'Invalid credentials' };
    }

    if (!existingUser.emailVerified){
      try {
        const verificationToken = await generateVerificationToken(existingUser.email);
        await sendVerificationEmail(verificationToken.email, verificationToken.token);
        return {success: 'Confirmation email sent!'};
      } catch {
        return { error: 'We could not send your verification email. Please try again shortly.' };
      }
    }
    
    if (existingUser.isTwoFactorEnabled && existingUser.email){
      if (!code) {
        try {
          const token = await generateTwoFactorToken(existingUser.email);
          await sendTwoFactorTokenEmail(token.email, token.token);
          return { twoFactor: true };
        } catch {
          return { error: 'We could not send your sign-in code. Please try again shortly.' };
        }
      }
    }

    try {
      const result = await signIn('credentials', {
        email,
        password,
        ...(code ? { code } : {}),
        redirect: false, // Use redirect: false to handle the redirect manually
      });
  
      if (result?.error) {
        throw new AuthError(result.error);
      }
  
      return { success: 'Signed in successfully!', redirectUrl: safeAuthRedirect(callbackUrl, DEFAULT_LOGIN_REDIRECT) };
    } catch(error){
      if (error instanceof AuthError){
        switch (error.type){
          case 'CredentialsSignin':
            return { error: 'Invalid credentials'}
          default:
            return { error: 'Something went wrong'}
        }
      }  

      throw error;
    }
};
