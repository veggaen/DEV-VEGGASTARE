import { Resend } from 'resend';
import { SecurityActionType } from '@prisma/client';

const resend = new Resend(process.env.RESEND_API_KEY);
// Simplified environment detection (no trailing slash; callers add leading '/')
const whatENV =
  process.env.NODE_ENV === "development"
    ? "http://localhost:3000"
    : "https://www.veggat.com";

console.log('whatENV:', whatENV);

export const sendTwoFactorTokenEmail = async (email: string, token: string): Promise<void> => {
  await resend.emails.send({
    from: 'Veggat-Security@veggat.com',
    to: email,
    subject: 'Your Veggat 2FA Code',
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Two-Factor Authentication</h2>
        <p>Your verification code is:</p>
        <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
          <span style="font-size: 32px; font-weight: bold; letter-spacing: 4px;">${token}</span>
        </div>
        <p style="color: #666; font-size: 14px;">This code expires in 5 minutes. If you didn't request this, please ignore this email.</p>
      </div>
    `
  });
}

/** 
 * @param {string} email 
 * @param {string} token
 * @returns {Promise<void>}
 * @description Send a password reset email -V3gga-
 * @example
 * import { Resend } from 'resend';
*/
export const sendPasswordResetEmail = async (email: string, token: string): Promise<void> => {
	const resetLink = `${whatENV}/auth/new-password?token=${token}`;
  await resend.emails.send({
    from: 'Veggat-PasswordReset@veggat.com',
    to: email,
    subject: 'Reset Your Veggat Password',
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Password Reset Request</h2>
        <p>We received a request to reset your password. Click the button below to create a new password:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetLink}" style="background: #0070f3; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500;">Reset Password</a>
        </div>
        <p style="color: #666; font-size: 14px;">This link expires in 60 minutes. If you didn't request this, you can safely ignore this email.</p>
      </div>
    `
  });
}

/** 
 * @param {string} email 
 * @param {string} token
 * @returns {Promise<void>}
 * @description Send a verification email -V3gga-
 * @example
 * import { Resend } from 'resend';
*/
export const sendVerificationEmail = async (email: string, token: string): Promise<void> => {
	const confirmLink = `${whatENV}/auth/new-verification?token=${token}`;
  await resend.emails.send({
    from: 'Veggat-Registration@veggat.com',
    to: email,
    subject: 'Welcome to Veggat - Confirm Your Email',
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Welcome to Veggat! 🎉</h2>
        <p>Thanks for signing up. Please confirm your email address to get started:</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${confirmLink}" style="background: #0070f3; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500;">Confirm Email</a>
        </div>
        <p style="color: #666; font-size: 14px;">This link expires in 60 minutes. If you didn't create an account, you can safely ignore this email.</p>
      </div>
    `
  });
}

export const sendSecurityActionEmail = async (
  email: string,
  token: string,
  action: SecurityActionType
): Promise<void> => {
  const actionLabel =
    action === "WEB3_MODE_ENABLE" ? "Enable Web3 Mode" : "Disable Web3 Mode";
  const confirmLink = `${whatENV}/auth/security-action?token=${token}`;

  await resend.emails.send({
    from: "Veggat-Security@veggat.com",
    to: email,
    subject: `Confirm: ${actionLabel}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #333;">Security Action Required</h2>
        <p>You requested to <strong>${actionLabel.toLowerCase()}</strong> on your Veggat account.</p>
        <div style="text-align: center; margin: 30px 0;">
          <a href="${confirmLink}" style="background: #0070f3; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 500;">${actionLabel}</a>
        </div>
        <p style="color: #666; font-size: 14px;">This link expires in 15 minutes. If you didn't request this, please secure your account immediately.</p>
      </div>
    `,
  });
};