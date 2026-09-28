'use server'

import * as z from 'zod'
import { MyAuthResetSchema } from "@/schemas"
import { getUserByEmail } from "@/data/user"
import { sendPasswordResetEmail } from "@/lib/mail"
import { generatePasswordResetToken } from "@/lib/tokens"
import { allowAuthAttempt, AUTH_RETRY_MESSAGE } from '@/lib/auth-rate-limit';

type ResetResult = { error: string } | { success: string };

export const MyResetAction = async (values: z.infer<typeof MyAuthResetSchema>): Promise<ResetResult> => {
  const validatedFields = MyAuthResetSchema.safeParse(values);

  if (!validatedFields.success){
    return { error: 'Invalid email!' };
  }
  const { email } = validatedFields.data;
  if (!await allowAuthAttempt('reset-request', email)) return { error: AUTH_RETRY_MESSAGE };
  const success = 'If an account matches this email, a reset link will arrive shortly. Check your spam folder too.';
  
  const existingUser = await getUserByEmail(email);
  if (!existingUser?.password || !existingUser.email) {
    return { success };
  }


  try {
    const token = await generatePasswordResetToken(existingUser.email);
    await sendPasswordResetEmail(token.email, token.token);
  } catch {
    // Keep the same response so mail failures cannot reveal account existence.
    console.warn('[auth] Password reset delivery failed');
  }
  return { success };
}
