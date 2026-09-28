'use server';

import * as z from 'zod';
import bcrypt from 'bcryptjs';

import { MyAuthRegisterSchema } from '@/schemas';
import { dbPrisma } from '@/lib/db';
import { getUserByEmail } from '@/data/user';
import { generateVerificationToken } from '@/lib/tokens';
import { sendVerificationEmail } from '@/lib/mail';
import { allowAuthAttempt, AUTH_RETRY_MESSAGE } from '@/lib/auth-rate-limit';

type RegisterResult = { error: string } | { success: string };

export const MyRegisterAction = async (values: z.infer<typeof MyAuthRegisterSchema>): Promise<RegisterResult> => {
  const validateFields = MyAuthRegisterSchema.safeParse(values);

  if (!validateFields.success) {
    return { error: 'Invalid fields' };
  }

  const { email, password, name, referredBy, image } = validateFields.data;
  if (!await allowAuthAttempt('register', email)) return { error: AUTH_RETRY_MESSAGE };
  const success = 'Check your email to confirm your account. If you already registered, sign in or reset your password.';
  try {
  const hashedPassword = await bcrypt.hash(password, 12);

  const existingUser = await getUserByEmail(email);
  if (existingUser) {
    return { success };
  }

  await dbPrisma.user.create({
    data: {
      name,
      email,
      password: hashedPassword,
      referredBy: referredBy,
      image: image || null, // Store the image URL if provided
      web3ModeEnabled: false,
      emailDisplayMode: 'HIDE',
    },
  });
  const verificationToken = await generateVerificationToken(email);
  await sendVerificationEmail(verificationToken.email, verificationToken.token);

  return { success };
  } catch {
    return { error: 'Registration could not finish. If you already registered, sign in to resend verification. Otherwise try again shortly.' };
  }
};
