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

interface DownloadLink {
  productTitle: string;
  downloadUrl: string;
  fileName: string;
  expiresAt: Date | null;
  maxDownloads: number;
}

interface OrderConfirmationData {
  orderId: string;
  name: string;
  items: { title: string; quantity: number; priceAtTime: number }[];
  totalAmount: number;
  shippingAddress: string;
  shippingCity: string;
  shippingPostalCode: string;
  shippingCountry: string;
  transactionId?: string;
  downloadLinks?: DownloadLink[];
}

export const sendOrderConfirmationEmail = async (
  email: string,
  data: OrderConfirmationData
): Promise<void> => {
  const itemsHtml = data.items.map((item) => `
    <tr>
      <td style="padding: 12px; border-bottom: 1px solid #eee;">${item.title}</td>
      <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
      <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: right;">$${item.priceAtTime.toFixed(2)}</td>
      <td style="padding: 12px; border-bottom: 1px solid #eee; text-align: right;">$${(item.priceAtTime * item.quantity).toFixed(2)}</td>
    </tr>
  `).join('');

  // Generate download links section if there are digital products
  const downloadLinksHtml = data.downloadLinks && data.downloadLinks.length > 0 ? `
    <h3 style="color: #333; border-bottom: 2px solid #eee; padding-bottom: 8px; margin-top: 24px;">📥 Dine nedlastinger</h3>
    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 20px; border-radius: 8px; margin: 16px 0;">
      <p style="color: white; margin: 0 0 16px 0; font-size: 14px;">
        Klikk på knappene under for å laste ned dine digitale produkter:
      </p>
      ${data.downloadLinks.map(link => `
        <div style="background: white; padding: 16px; border-radius: 8px; margin-bottom: 12px;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
              <p style="margin: 0; font-weight: bold; color: #333;">${link.productTitle}</p>
              <p style="margin: 4px 0 0; color: #666; font-size: 12px;">Fil: ${link.fileName}</p>
              <p style="margin: 4px 0 0; color: #999; font-size: 11px;">
                Maks ${link.maxDownloads} nedlastinger${link.expiresAt ? ` • Utløper: ${new Date(link.expiresAt).toLocaleDateString('nb-NO')}` : ''}
              </p>
            </div>
          </div>
          <a href="${whatENV}${link.downloadUrl}" 
             style="display: inline-block; margin-top: 12px; background: #2563eb; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: 500;">
            Last ned
          </a>
        </div>
      `).join('')}
    </div>
    <p style="color: #666; font-size: 12px; margin-top: 8px;">
      💡 Tips: Ta vare på denne e-posten - du kan bruke nedlastingslenkene flere ganger (inntil grensen er nådd).
    </p>
  ` : '';

  // Only show shipping section if there's an address (physical products)
  const shippingHtml = data.shippingAddress ? `
    <h3 style="color: #333; border-bottom: 2px solid #eee; padding-bottom: 8px; margin-top: 24px;">Leveringsadresse</h3>
    <div style="background: #f8f9fa; padding: 16px; border-radius: 8px;">
      <p style="margin: 0; color: #333;">${data.name}</p>
      <p style="margin: 4px 0 0; color: #666;">${data.shippingAddress}</p>
      <p style="margin: 4px 0 0; color: #666;">${data.shippingPostalCode} ${data.shippingCity}</p>
      <p style="margin: 4px 0 0; color: #666;">${data.shippingCountry}</p>
    </div>
  ` : '';

  await resend.emails.send({
    from: 'Veggat-Orders@veggat.com',
    to: email,
    subject: `Ordrebekreftelse - ${data.orderId}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; background: #fff;">
        <div style="background: linear-gradient(to right, #2563eb, #7c3aed); padding: 24px; border-radius: 8px 8px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 24px;">Takk for din bestilling! 🎉</h1>
        </div>
        
        <div style="padding: 24px;">
          <p style="color: #333; font-size: 16px;">Hei ${data.name},</p>
          <p style="color: #666;">Vi har mottatt din bestilling og behandler den nå.</p>
          
          <div style="background: #f8f9fa; padding: 16px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0; color: #333;"><strong>Ordre-ID:</strong> ${data.orderId}</p>
            ${data.transactionId ? `<p style="margin: 8px 0 0; color: #666; font-size: 14px;"><strong>Transaksjons-ID:</strong> ${data.transactionId}</p>` : ''}
          </div>

          <h3 style="color: #333; border-bottom: 2px solid #eee; padding-bottom: 8px;">Bestilte produkter</h3>
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr style="background: #f8f9fa;">
                <th style="padding: 12px; text-align: left;">Produkt</th>
                <th style="padding: 12px; text-align: center;">Antall</th>
                <th style="padding: 12px; text-align: right;">Pris</th>
                <th style="padding: 12px; text-align: right;">Sum</th>
              </tr>
            </thead>
            <tbody>
              ${itemsHtml}
            </tbody>
            <tfoot>
              <tr style="background: #f8f9fa; font-weight: bold;">
                <td colspan="3" style="padding: 12px; text-align: right;">Totalsum:</td>
                <td style="padding: 12px; text-align: right;">$${data.totalAmount.toFixed(2)}</td>
              </tr>
            </tfoot>
          </table>

          ${downloadLinksHtml}
          ${shippingHtml}

          <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #eee;">
            <p style="color: #666; font-size: 14px;">
              Har du spørsmål? Svar på denne e-posten eller kontakt oss på 
              <a href="mailto:support@veggat.com" style="color: #2563eb;">support@veggat.com</a>
            </p>
          </div>
        </div>

        <div style="background: #f8f9fa; padding: 16px; text-align: center; border-radius: 0 0 8px 8px;">
          <p style="margin: 0; color: #999; font-size: 12px;">
            THORSEN SOFTWARE ENK | Org.nr: 937051107 | Blåskjellveien 5B, 4310 Hommersåk
          </p>
          <p style="margin: 8px 0 0; color: #999; font-size: 12px;">
            <a href="${whatENV}/terms" style="color: #666;">Kjøpsvilkår</a> | 
            <a href="${whatENV}/privacy" style="color: #666;">Personvernerklæring</a>
          </p>
        </div>
      </div>
    `,
  });
};