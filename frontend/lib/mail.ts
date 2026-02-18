import { Resend } from 'resend';
import { SecurityActionType } from '@/generated/prisma/browser';

const resend = new Resend(process.env.RESEND_API_KEY);
const LOG_PREFIX = '[mail.ts]';

if (!process.env.RESEND_API_KEY) {
  console.error(`${LOG_PREFIX} Missing RESEND_API_KEY. Email sending will fail.`);
}

async function sendEmailViaResend(payload: Parameters<typeof resend.emails.send>[0]): Promise<void> {
  const { data, error } = await resend.emails.send(payload);

  if (error) {
    const msg = typeof error.message === 'string' ? error.message : 'Unknown Resend error';
    throw new Error(`Resend send failed: ${msg}`);
  }

  if (!data?.id) {
    throw new Error('Resend send failed: missing message id in response');
  }
}
// Simplified environment detection (no trailing slash; callers add leading '/')
const whatENV =
  process.env.NODE_ENV === "development"
    ? "http://localhost:3000"
    : "https://www.veggat.com";

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

// ─── OAuth Link Confirmation Email (pending → verified) ─────────────────────

/**
 * Sent when a user links a new OAuth provider.
 * They must click the button to actually confirm the link — the flag stays
 * false (yellow in UI) until they do. This prevents a rogue session from
 * silently linking an attacker's account.
 */
export const sendOauthLinkConfirmationEmail = async (
  email: string,
  data: {
    provider: 'google' | 'github' | 'discord';
    userName?: string | null;
    token: string;
  }
): Promise<void> => {
  const providerLabel = data.provider === 'google'
    ? 'Google'
    : data.provider === 'github'
      ? 'GitHub'
      : 'Discord';

  const confirmUrl = `${whatENV}/api/auth/confirm-oauth-link?token=${encodeURIComponent(data.token)}`;
  const denyUrl   = `${whatENV}/api/auth/confirm-oauth-link?token=${encodeURIComponent(data.token)}&deny=1`;

  await sendEmailViaResend({
    from: 'Veggat-Security@veggat.com',
    to: email,
    subject: `🔐 Confirm ${providerLabel} account link — Veggat`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #1e40af, #0ea5e9); padding: 24px; border-radius: 8px 8px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 20px;">🔐 Confirm Account Link</h1>
        </div>

        <div style="padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
          <p style="color: #333;">Hi${data.userName ? ` ${data.userName}` : ''},</p>

          <p style="color: #555;">
            Someone just linked a <strong>${providerLabel}</strong> account to your Veggat profile.
            <br/>Before this takes effect, you need to confirm it was you.
          </p>

          <div style="background: #fef9c3; border: 1px solid #fde047; padding: 14px; border-radius: 8px; margin: 16px 0;">
            <p style="margin: 0; color: #78350f; font-size: 14px; font-weight: 600;">⚠️ If this wasn't you, click "Deny &amp; Secure" below immediately.</p>
          </div>

          <div style="text-align: center; margin: 28px 0;">
            <a href="${confirmUrl}"
               style="background: #16a34a; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600; display: inline-block;">
              ✅ Yes, confirm this link
            </a>
            <a href="${denyUrl}"
               style="background: #dc2626; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600; display: inline-block; margin-left: 12px;">
              ❌ Deny &amp; Secure
            </a>
          </div>

          <p style="color: #9ca3af; font-size: 13px; text-align: center;">
            This confirmation link expires in <strong>24 hours</strong>.
            Until confirmed, the ${providerLabel} account is <em>pending</em> and does not count toward your verification score.
          </p>
        </div>
      </div>
    `,
  });
};

export const sendOauthProviderLinkedEmail = async (
  email: string,
  data: {
    provider: 'google' | 'github' | 'discord';
    userName?: string | null;
  }
): Promise<void> => {
  const providerLabel = data.provider === 'google'
    ? 'Google'
    : data.provider === 'github'
      ? 'GitHub'
      : 'Discord';

  await sendEmailViaResend({
    from: 'Veggat-Security@veggat.com',
    to: email,
    subject: `🔐 ${providerLabel} account linked to your Veggat profile`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #2563eb, #0ea5e9); padding: 24px; border-radius: 8px 8px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 20px;">🔐 OAuth Account Linked</h1>
        </div>

        <div style="padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
          <p style="color: #333;">Hi${data.userName ? ` ${data.userName}` : ''},</p>
          <p style="color: #555;">Your <strong>${providerLabel}</strong> account was linked to your Veggat account.</p>

          <div style="background: #f8fafc; border: 1px solid #dbeafe; padding: 14px; border-radius: 8px; margin: 16px 0;">
            <p style="margin: 0; color: #334155; font-size: 14px;"><strong>Provider:</strong> ${providerLabel}</p>
            <p style="margin: 6px 0 0; color: #334155; font-size: 14px;"><strong>Time:</strong> ${new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}</p>
          </div>

          <p style="color: #666; font-size: 14px;">
            If this was you, no action is needed. You can now sign in with ${providerLabel} in addition to your other linked providers.
          </p>

          <p style="color: #666; font-size: 14px;">
            If this was <strong>not</strong> you, change your password immediately and review your account security settings.
          </p>

          <div style="text-align: center; margin: 24px 0;">
            <a href="${whatENV}/settings?section=security" style="background: #1d4ed8; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: 500; margin-right: 10px; display: inline-block;">
              Review Security
            </a>
            <a href="${whatENV}/settings?section=verification" style="background: #0f766e; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: 500; display: inline-block;">
              View Linked Methods
            </a>
          </div>
        </div>
      </div>
    `,
  });
};

// ─── Company Organization Verification Email ───────────────────────────────

export const sendCompanyOrgVerificationEmail = async (
  email: string,
  data: {
    companyName: string;
    orgNumber: string;
    legalName?: string | null;
    token: string;
    expiresHours?: number;
  }
): Promise<void> => {
  const confirmUrl = `${whatENV}/api/companies/verify-org?token=${encodeURIComponent(data.token)}`;
  const denyUrl = `${whatENV}/api/companies/verify-org?token=${encodeURIComponent(data.token)}&deny=1`;
  const expiresHours = data.expiresHours ?? 48;

  await sendEmailViaResend({
    from: 'Veggat-Security@veggat.com',
    to: email,
    subject: `Confirm organization link for ${data.companyName} (${data.orgNumber})`,
    html: `
      <div style="font-family: sans-serif; max-width: 640px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #0f766e, #10b981); padding: 24px; border-radius: 8px 8px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 20px;">🏢 Confirm Organization Connection</h1>
        </div>

        <div style="padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
          <p style="color: #334155;">A Veggat company profile requested verification against this organization:</p>
          <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 8px; padding: 14px; margin: 14px 0;">
            <p style="margin: 0; color: #0f172a;"><strong>Company profile:</strong> ${data.companyName}</p>
            <p style="margin: 6px 0 0; color: #0f172a;"><strong>Organization number:</strong> ${data.orgNumber}</p>
            <p style="margin: 6px 0 0; color: #0f172a;"><strong>Registered legal name:</strong> ${data.legalName || 'Unknown'}</p>
          </div>

          <p style="color: #475569;">If this connection is legitimate, confirm below. If not, deny it.</p>

          <div style="text-align: center; margin: 28px 0;">
            <a href="${confirmUrl}" style="background: #16a34a; color: white; padding: 12px 22px; border-radius: 6px; text-decoration: none; font-weight: 600; display: inline-block;">✅ Confirm organization</a>
            <a href="${denyUrl}" style="background: #dc2626; color: white; padding: 12px 22px; border-radius: 6px; text-decoration: none; font-weight: 600; display: inline-block; margin-left: 10px;">❌ Deny</a>
          </div>

          <p style="color: #64748b; font-size: 13px;">
            Link expires in ${expiresHours} hours. Until confirmed, Veggat will treat this profile as unverified and keep org details disconnected.
          </p>
        </div>
      </div>
    `,
  });
};

// ─── Wallet Linked / Unlinked Confirmation ───────────────────────────────────

export const sendWalletLinkedEmail = async (
  email: string,
  data: {
    walletAddress: string;
    chainFamily: string;
    chainId?: number | null;
    action: 'linked' | 'unlinked';
    userName?: string | null;
  }
): Promise<void> => {
  const actionVerb = data.action === 'linked' ? 'linked to' : 'unlinked from';
  const actionPast = data.action === 'linked' ? 'connected' : 'removed';
  const iconEmoji = data.action === 'linked' ? '🔗' : '🔓';
  const trimmedAddr = `${data.walletAddress.slice(0, 6)}…${data.walletAddress.slice(-4)}`;
  const chainLabel = data.chainFamily === 'EVM'
    ? `EVM (Chain ${data.chainId ?? 'unknown'})`
    : data.chainFamily;

  await resend.emails.send({
    from: 'Veggat-Security@veggat.com',
    to: email,
    subject: `${iconEmoji} Wallet ${data.action === 'linked' ? 'Linked' : 'Unlinked'}: ${trimmedAddr}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #7c3aed, #4f46e5); padding: 24px; border-radius: 8px 8px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 20px;">${iconEmoji} Wallet ${data.action === 'linked' ? 'Linked' : 'Unlinked'}</h1>
        </div>
        
        <div style="padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
          <p style="color: #333;">Hi${data.userName ? ` ${data.userName}` : ''},</p>
          <p style="color: #555;">A wallet was just ${actionVerb} your Veggat account.</p>
          
          <div style="background: #f8f9fa; padding: 16px; border-radius: 8px; margin: 20px 0;">
            <table style="width: 100%; font-size: 14px;">
              <tr>
                <td style="color: #888; padding: 4px 0;">Address:</td>
                <td style="color: #333; font-weight: 500; font-family: monospace;">${data.walletAddress}</td>
              </tr>
              <tr>
                <td style="color: #888; padding: 4px 0;">Network:</td>
                <td style="color: #333;">${chainLabel}</td>
              </tr>
              <tr>
                <td style="color: #888; padding: 4px 0;">Action:</td>
                <td style="color: ${data.action === 'linked' ? '#059669' : '#dc2626'}; font-weight: 500;">
                  ${data.action === 'linked' ? '✅ Wallet linked' : '❌ Wallet removed'}
                </td>
              </tr>
              <tr>
                <td style="color: #888; padding: 4px 0;">Time:</td>
                <td style="color: #333;">${new Date().toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' })}</td>
              </tr>
            </table>
          </div>

          ${data.action === 'linked' ? `
            <div style="background: #ecfdf5; border: 1px solid #a7f3d0; padding: 12px 16px; border-radius: 8px; margin: 16px 0;">
              <p style="color: #065f46; margin: 0; font-size: 14px;">
                <strong>🎉 Auth level upgraded!</strong> Your trust tier may have improved. 
                <a href="${whatENV}/settings?section=verification" style="color: #2563eb;">Check your verification dashboard →</a>
              </p>
            </div>
          ` : ''}

          <p style="color: #666; font-size: 13px; margin-top: 24px;">
            If you did not perform this action, please secure your account immediately by changing your password and enabling 2FA.
          </p>
          
          <div style="text-align: center; margin: 24px 0;">
            <a href="${whatENV}/settings?section=wallet" style="background: #4f46e5; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: 500;">
              Review Wallet Settings
            </a>
          </div>
        </div>

        <div style="text-align: center; padding: 12px; color: #999; font-size: 11px;">
          THORSEN SOFTWARE ENK | Org.nr: 937051107
        </div>
      </div>
    `,
  });
};

// ─── Auth Level Change Notification ──────────────────────────────────────────

export const sendAuthLevelChangeEmail = async (
  email: string,
  data: {
    userName?: string | null;
    previousTier: string;
    newTier: string;
    newScore: number;
    newMultiplier: number;
    triggerAction: string;
  }
): Promise<void> => {
  const improved = data.newScore > 0;

  await resend.emails.send({
    from: 'Veggat-Security@veggat.com',
    to: email,
    subject: `🔐 Account Auth Level Updated: ${data.newTier}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #059669, #0891b2); padding: 24px; border-radius: 8px 8px 0 0;">
          <h1 style="color: white; margin: 0; font-size: 20px;">🔐 Auth Level Updated</h1>
        </div>
        
        <div style="padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px;">
          <p style="color: #333;">Hi${data.userName ? ` ${data.userName}` : ''},</p>
          <p style="color: #555;">Your account verification level has been updated.</p>
          
          <div style="display: flex; align-items: center; justify-content: center; gap: 12px; margin: 24px 0;">
            <div style="text-align: center; padding: 16px 24px; background: #f3f4f6; border-radius: 8px;">
              <div style="font-size: 12px; color: #888; margin-bottom: 4px;">Previous</div>
              <div style="font-size: 16px; font-weight: bold; color: #6b7280;">${data.previousTier}</div>
            </div>
            <div style="font-size: 24px; color: #10b981;">→</div>
            <div style="text-align: center; padding: 16px 24px; background: #ecfdf5; border: 2px solid #a7f3d0; border-radius: 8px;">
              <div style="font-size: 12px; color: #059669; margin-bottom: 4px;">Current</div>
              <div style="font-size: 16px; font-weight: bold; color: #059669;">${data.newTier}</div>
            </div>
          </div>

          <div style="background: #f8f9fa; padding: 16px; border-radius: 8px; margin: 20px 0;">
            <table style="width: 100%; font-size: 14px;">
              <tr>
                <td style="color: #888; padding: 4px 0;">Trust Score:</td>
                <td style="color: #333; font-weight: 500;">${data.newScore} points</td>
              </tr>
              <tr>
                <td style="color: #888; padding: 4px 0;">Reach Multiplier:</td>
                <td style="color: #333; font-weight: 500;">${data.newMultiplier}x</td>
              </tr>
              <tr>
                <td style="color: #888; padding: 4px 0;">Triggered by:</td>
                <td style="color: #333;">${data.triggerAction}</td>
              </tr>
            </table>
          </div>

          <div style="text-align: center; margin: 24px 0;">
            <a href="${whatENV}/settings?section=verification" style="background: #059669; color: white; padding: 10px 20px; border-radius: 6px; text-decoration: none; font-weight: 500;">
              View Verification Dashboard
            </a>
          </div>
          
          <p style="color: #666; font-size: 13px; text-align: center;">
            Higher trust levels unlock additional features and increase your content visibility.
          </p>
        </div>

        <div style="text-align: center; padding: 12px; color: #999; font-size: 11px;">
          THORSEN SOFTWARE ENK | Org.nr: 937051107
        </div>
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
  // Phase 2: shipping method + tracking
  shippingMethodName?: string;
  shippingCost?: number;
  trackingNumber?: string;
  trackingUrl?: string;
  estimatedDelivery?: string;
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
      ${data.shippingMethodName ? `<p style="margin: 8px 0 0; color: #333;"><strong>Fraktmetode:</strong> ${data.shippingMethodName}</p>` : ''}
      ${data.shippingCost != null && data.shippingCost > 0 ? `<p style="margin: 4px 0 0; color: #666;">Fraktkostnad: $${data.shippingCost.toFixed(2)}</p>` : ''}
      ${data.estimatedDelivery ? `<p style="margin: 4px 0 0; color: #10b981;"><strong>Estimert levering:</strong> ${new Date(data.estimatedDelivery).toLocaleDateString('nb-NO', { weekday: 'short', day: 'numeric', month: 'short' })}</p>` : ''}
    </div>
    ${data.trackingNumber ? `
    <div style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); padding: 16px; border-radius: 8px; margin-top: 12px;">
      <p style="color: white; margin: 0; font-size: 14px; font-weight: bold;">📍 Sporing</p>
      <p style="color: #d1fae5; margin: 8px 0 0; font-size: 13px;">Sporingsnummer: <strong style="color: white;">${data.trackingNumber}</strong></p>
      ${data.trackingUrl ? `<a href="${data.trackingUrl}" style="display: inline-block; margin-top: 12px; background: white; color: #059669; padding: 8px 16px; border-radius: 6px; text-decoration: none; font-weight: 600; font-size: 13px;">Spor pakken hos Bring →</a>` : ''}
    </div>
    ` : ''}
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
              ${data.shippingCost != null && data.shippingCost > 0 ? `
              <tr style="background: #f8f9fa;">
                <td colspan="3" style="padding: 8px 12px; text-align: right; color: #666;">Frakt${data.shippingMethodName ? ` (${data.shippingMethodName})` : ''}:</td>
                <td style="padding: 8px 12px; text-align: right; color: #666;">$${data.shippingCost.toFixed(2)}</td>
              </tr>
              ` : ''}
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