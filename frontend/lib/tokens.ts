import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

import { dbPrisma } from './db';
import { getVerificationTokenByEmail } from '@/data/verificiation-token';
import { getPasswordResetTokenByEmail } from '@/data/password-reset-token';
import { getTwoFactortokenByEmail } from '@/data/two-factor-token';
import { SecurityActionType, TwoFactorToken, PasswordResetToken, VerificationToken, EmailLoginToken, SecurityActionToken } from '@/generated/prisma/browser';

export const generateTwoFactorToken = async (email: string): Promise<TwoFactorToken> => {
  const token = crypto.randomInt(100_000, 1_000_000).toString();
  const tokenExpiresTimer = 5; // minutes
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

export const generatePasswordResetToken = async (email: string): Promise<PasswordResetToken> => {
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

export const generateVerificationToken = async (email: string): Promise<VerificationToken> => {
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

// Generate a one-time login token for magic-link auto-login after email verification
export const generateEmailLoginToken = async (email: string): Promise<EmailLoginToken> => {
  const token = uuidv4();
  const tokenExpiresTimer = 5; // 5 minutes - short-lived for security
  const expires = new Date(new Date().getTime() + (60 * tokenExpiresTimer) * 1000);

  // Delete any existing login token for this email
  await dbPrisma.emailLoginToken.deleteMany({
    where: { email }
  });

  const emailLoginToken = await dbPrisma.emailLoginToken.create({
    data: {
      email,
      token,
      expires
    }
  });

  return emailLoginToken;
};

// Get email login token by token
export const getEmailLoginTokenByToken = async (token: string): Promise<EmailLoginToken | null> => {
  try {
    const loginToken = await dbPrisma.emailLoginToken.findUnique({
      where: { token }
    });
    return loginToken;
  } catch {
    return null;
  }
};

export const generateSecurityActionToken = async (params: {
  userId: string;
  email: string;
  action: SecurityActionType;
}): Promise<SecurityActionToken> => {
  const token = uuidv4();
  const tokenExpiresTimer = 15; // minutes
  const expires = new Date(new Date().getTime() + (60 * tokenExpiresTimer) * 1000);

  // Keep at most one active token per user+action.
  await dbPrisma.securityActionToken.deleteMany({
    where: {
      userId: params.userId,
      action: params.action,
    },
  });

  const actionToken = await dbPrisma.securityActionToken.create({
    data: {
      userId: params.userId,
      email: params.email,
      token,
      action: params.action,
      expires,
    },
  });

  return actionToken;
};