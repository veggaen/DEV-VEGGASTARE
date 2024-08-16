import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
// Simplified environment detection
const whatENV = process.env.NODE_ENV === 'development' 
? 'http://localhost:3000/' 
: '/';

console.log('whatENV:', whatENV);
const getBaseUrl = () => {
  // Fallback to localhost if NEXT_PUBLIC_BASE_URL is not defined
  return whatENV;
}

export const sendTwoFactorTokenEmail = async (email: string, token: string) => {
  await resend.emails.send({
    from: 'whatever@veggat.com',
    to: email,
    subject: '2FA Code',
    html: `<p>Your two factor authentication code is: ${token}</p>`
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
export const sendPasswordResetEmail = async (email: string, token: string) => {
  const resetLink = `${getBaseUrl()}/auth/new-password?token=${token}`;
  await resend.emails.send({
    from: 'whatever@veggat.com',
    to: email,
    subject: 'Reset your password',
    html: `<p>Click <a href="${resetLink}">here</a> to reset your password</p>`
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
export const sendVerificationEmail = async (email: string, token: string) => {
  const confirmLink = `${getBaseUrl()}/auth/new-verification?token=${token}`;
  await resend.emails.send({
    from: 'whatever@veggat.com',
    to: email,
    subject: 'Confirm your email',
    html: `<p>Click <a href="${confirmLink}">here</a> to confirm your email</p>`
  });
}