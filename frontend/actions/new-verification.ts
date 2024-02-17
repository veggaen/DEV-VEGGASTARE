'use server'

import { dbPrisma } from "@/lib/db"
import { getUserByEmail } from "@/data/user"
import { getVerificationTokenByToken } from "@/data/verificiation-token"

export const MyNewVerificationAction = async (token: string) => {
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
  }
  
  return { success: "Email verified!"}
}