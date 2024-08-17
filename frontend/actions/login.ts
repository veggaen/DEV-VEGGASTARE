'use server';
import * as z from 'zod'

import { signIn } from '@/auth';
import { AuthError } from 'next-auth';
import { DEFAULT_LOGIN_REDIRECT } from '@/routes';
import { getUserByEmail } from '@/data/user';
import { getTwoFactortokenByEmail } from '@/data/two-factor-token';
import { MyAuthLoginSchema } from '@/schemas'
import { sendVerificationEmail, sendTwoFactorTokenEmail } from '@/lib/mail';
import { generateVerificationToken, generateTwoFactorToken } from '@/lib/tokens';
import { dbPrisma } from '@/lib/db';
import { getTwoFactorConfirmationByUserId } from '@/data/two-factor-confirmation';

export const MyLoginAction = async (values: z.infer<typeof MyAuthLoginSchema>, callbackUrl?: string | null,) => {
    console.log('MyLoginAction', values);
    const validateFields = MyAuthLoginSchema.safeParse(values);

    if (!validateFields.success){
        return { error: 'Invalid fields'}
    }

    const { email, password, code } = validateFields.data;

    const existingUser = await getUserByEmail(email);

    if (!existingUser || !existingUser.email || !existingUser.password) {
      return { error: "Email does not exist!" }
    }

    if (!existingUser.emailVerified){
        // Can 'login' to user without correct password at this moment. but does not login, it just stops here and sends a confirmation email. TODO: check password match before this check
      const verificationToken = await generateVerificationToken(existingUser.email);
      await sendVerificationEmail(verificationToken.email, verificationToken.token);
      return {success: 'Confirmation email sent!'}
    }
    
    if (existingUser.isTwoFactorEnabled && existingUser.email){
      if (code) {
        const twoFactorToken = await getTwoFactortokenByEmail(existingUser.email)

        if (!twoFactorToken) {
          return { error: 'Invalid code!'}
        };

        if ( twoFactorToken.token !== code ){
          return { error: 'Invalid code!'}
        };

        const hasExpired = new Date(twoFactorToken.expires) < new Date();

        if (hasExpired){
          return { error: 'Code has expired!'}
        };

        await dbPrisma.twoFactorToken.delete({
          where: { id: twoFactorToken.id }
        });

        const existingConfirmation = await getTwoFactorConfirmationByUserId(existingUser.id);

        if (existingConfirmation){
          await dbPrisma.twoFactorConfirmation.delete({
            where: { id: existingConfirmation.id }
          });
        };

        await dbPrisma.twoFactorConfirmation.create({
          data: {
            userId: existingUser.id
          }
        });
        
      } else {
        const twoFactorToken = await generateTwoFactorToken(existingUser.email);
        await sendTwoFactorTokenEmail(twoFactorToken.email, twoFactorToken.token);
  
        return { twoFactor: true };
      }
    }

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false, // Use redirect: false to handle the redirect manually
      });
  
      if (result?.error) {
        throw new AuthError(result.error);
      }
  
      return { success: 'Signed in successfully!', redirectUrl: callbackUrl || DEFAULT_LOGIN_REDIRECT };
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