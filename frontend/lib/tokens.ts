import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

import { dbPrisma } from './db';
import { getVerificationTokenByEmail } from '@/data/verificiation-token';
import { getPasswordResetTokenByEmail } from '@/data/password-reset-token';
import { getTwoFactortokenByEmail } from '@/data/two-factor-token';

export const generateTwoFactorToken = async (email: string) => {
  const token = crypto.randomInt(100_000, 1_000_000).toString();
  const tokenExpiresTimer = 5; // minutes
  // TODO: later change to 5 min...
  const expires = new Date(new Date().getTime() + (60 * tokenExpiresTimer) * 1000)

  const existingToken = await getTwoFactortokenByEmail(email);
  if (existingToken?.id) {
    await dbPrisma.twoFactorToken.delete({
      where: { id: existingToken.id}
    })
  };

  const twoFactorToken = await dbPrisma.twoFactorToken.create({
    data: {
      email,
      token,
      expires
    }
  });

  return twoFactorToken;
}

export const generatePasswordResetToken = async (email: string) => {
  const token = uuidv4();
  const tokenExpiresTimer = 60; // minutes
  const expires = new Date(new Date().getTime() + (60 * tokenExpiresTimer) * 1000)  

  const existingToken = await getPasswordResetTokenByEmail(email);
  if (existingToken?.id) {
    await dbPrisma.passwordResetToken.delete({
      where: {id: existingToken.id}
    });
  };

  const passwordResetToken = await dbPrisma.passwordResetToken.create({
    data: {
      email,
      token,
      expires
    }
  });  

  return passwordResetToken;
};

export const generateVerificationToken = async (email: string) => {
  const token = uuidv4();
  const tokenExpiresTimer = 60; // minutes
  const expires = new Date(new Date().getTime() + (60 * tokenExpiresTimer ) * 1000 );

  const existingToken = await getVerificationTokenByEmail(email);
  if (existingToken?.id){
    await dbPrisma.verificationToken.delete({
      where:{ id: existingToken.id},
    });
  };

  const verificationToken = await dbPrisma.verificationToken.create({
    data: {
      email,
      token,
      expires
    }
  });

  return verificationToken
};