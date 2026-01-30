'use server'

import * as z from 'zod'
import { MyAuthResetSchema } from "@/schemas"
import { getUserByEmail } from "@/data/user"
import { sendPasswordResetEmail } from "@/lib/mail"
import { generatePasswordResetToken } from "@/lib/tokens"

type ResetResult = { error: string } | { success: string };

export const MyResetAction = async (values: z.infer<typeof MyAuthResetSchema>): Promise<ResetResult> => {
  const validatedFields = MyAuthResetSchema.safeParse(values);

  if (!validatedFields.success){
    return { error: 'Invalid email!' };
  }
  const { email } = validatedFields.data;
  
  const existingUser = await getUserByEmail(email);
  if (!existingUser) {
    return { error: 'Email not found!' };
  }


  const passwordResetToken = await generatePasswordResetToken(email);
    await sendPasswordResetEmail(passwordResetToken.email, passwordResetToken.token);

  return { success: 'Reset email sent!'};
}