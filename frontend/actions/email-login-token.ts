'use server';

import { signIn } from '@/auth';
import { AuthError } from 'next-auth';
import { DEFAULT_LOGIN_REDIRECT } from '@/routes';

export const emailLoginTokenAction = async (email: string, loginToken: string) => {
  try {
    const result = await signIn('email-login-token', {
      email,
      loginToken,
      redirect: false,
    });

    if (result?.error) {
      throw new AuthError(result.error);
    }

    return { success: 'Signed in successfully!', redirectUrl: DEFAULT_LOGIN_REDIRECT };
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: 'Auto-login failed. Please login manually.' };
    }
    throw error;
  }
};
