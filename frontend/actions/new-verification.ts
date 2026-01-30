'use server'

import { dbPrisma } from "@/lib/db"
import { getUserByEmail } from "@/data/user"
import { getVerificationTokenByToken } from "@/data/verificiation-token"
import { generateEmailLoginToken } from "@/lib/tokens"

type VerificationResult =
  | { error: string }
  | { success: string }
  | { success: string; loginToken: string; email: string };

export const MyNewVerificationAction = async (token: string): Promise<VerificationResult> => {
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
  
  if (existingUser.id){
    await dbPrisma.user.update({
      where: { id: existingUser.id },
      data: {
        emailVerified: new Date(),
        email: existingToken.email
      },
    });

    await dbPrisma.verificationToken.delete({
      where: { id: existingToken.id },
    });

    // Generate a one-time login token for auto-login
    const loginToken = await generateEmailLoginToken(existingToken.email);
    
    return { 
      success: "Email verified!", 
      loginToken: loginToken.token,
      email: existingToken.email
    };
  }
  
  return { success: "Email verified!"}
}