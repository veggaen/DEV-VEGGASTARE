/**
 * Phone Verification Service
 * 
 * Supports multiple SMS providers with Norwegian providers as primary options:
 * 
 * PRIMARY (Norway-focused):
 * - Sveve (sveve.no) - Norwegian SMS provider, simple API
 * - Link Mobility (linkmobility.com) - Nordic/European provider
 * 
 * FALLBACK (International):
 * - Twilio - Most popular international provider
 * - Vonage (Nexmo) - International alternative
 * 
 * FUTURE:
 * - Vipps Login - Norwegian Vipps authentication
 * - BankID - Norwegian electronic ID (highest trust)
 */

import crypto from 'crypto';

// ─── Types ───────────────────────────────────────────────────────────────────

export type SmsProvider = 'SVEVE' | 'LINK_MOBILITY' | 'TWILIO' | 'VONAGE';

export interface PhoneVerificationConfig {
  provider: SmsProvider;
  codeLength?: number; // Default 6
  expirationMinutes?: number; // Default 10
  maxAttempts?: number; // Default 3
}

export interface SendCodeResult {
  success: boolean;
  provider: SmsProvider;
  expiresAt: Date;
  messageId?: string;
  error?: string;
}

export interface VerifyCodeResult {
  success: boolean;
  error?: string;
  attemptsRemaining?: number;
}

// ─── Code Generation ─────────────────────────────────────────────────────────

/**
 * Generate a secure random verification code
 */
export function generateVerificationCode(length: number = 6): string {
  // Use crypto for secure random numbers
  const min = Math.pow(10, length - 1);
  const max = Math.pow(10, length) - 1;
  const randomBytes = crypto.randomBytes(4);
  const randomNumber = randomBytes.readUInt32BE(0);
  const code = min + (randomNumber % (max - min + 1));
  return code.toString();
}

/**
 * Hash a verification code for secure storage
 */
export function hashVerificationCode(code: string): string {
  return crypto
    .createHash('sha256')
    .update(code + process.env.NEXTAUTH_SECRET)
    .digest('hex');
}

/**
 * Verify a code against a stored hash
 */
export function verifyCodeHash(code: string, hash: string): boolean {
  const inputHash = hashVerificationCode(code);
  return crypto.timingSafeEqual(Buffer.from(inputHash), Buffer.from(hash));
}

// ─── Phone Number Formatting ─────────────────────────────────────────────────

/**
 * Format phone number to E.164 format (e.g., +4712345678)
 */
export function formatPhoneE164(phone: string, countryCode: string = 'NO'): string {
  // Remove all non-digit characters except leading +
  let cleaned = phone.replace(/[^\d+]/g, '');
  
  // Country code mappings
  const countryCodes: Record<string, string> = {
    NO: '+47',
    SE: '+46',
    DK: '+45',
    FI: '+358',
    US: '+1',
    GB: '+44',
    DE: '+49',
  };
  
  const prefix = countryCodes[countryCode] || '+47';
  
  // If already has country code, return as-is
  if (cleaned.startsWith('+')) {
    return cleaned;
  }
  
  // If starts with 00, replace with +
  if (cleaned.startsWith('00')) {
    return '+' + cleaned.slice(2);
  }
  
  // Add country code
  return prefix + cleaned;
}

/**
 * Validate phone number format
 */
export function isValidPhoneNumber(phone: string): boolean {
  const e164Regex = /^\+[1-9]\d{6,14}$/;
  return e164Regex.test(phone);
}

/**
 * Get country from phone number
 */
export function getCountryFromPhone(phone: string): string | null {
  if (!phone.startsWith('+')) return null;
  
  const prefixMap: [string, string][] = [
    ['+47', 'NO'],
    ['+46', 'SE'],
    ['+45', 'DK'],
    ['+358', 'FI'],
    ['+44', 'GB'],
    ['+49', 'DE'],
    ['+1', 'US'],
  ];
  
  for (const [prefix, country] of prefixMap) {
    if (phone.startsWith(prefix)) {
      return country;
    }
  }
  
  return null;
}

// ─── SMS Provider Implementations ────────────────────────────────────────────

/**
 * Sveve SMS Provider (Norway)
 * API Docs: https://www.sveve.no/apidocs
 */
async function sendViaSveve(phone: string, message: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const username = process.env.SVEVE_USERNAME;
  const password = process.env.SVEVE_PASSWORD;
  const sender = process.env.SVEVE_SENDER || 'VeggaStare';
  
  if (!username || !password) {
    console.error('[PhoneVerification] Sveve credentials not configured');
    return { success: false, error: 'SMS provider not configured' };
  }
  
  try {
    // Sveve uses a simple GET/POST API
    const params = new URLSearchParams({
      user: username,
      passwd: password,
      to: phone.replace('+', ''), // Sveve expects number without +
      from: sender,
      msg: message,
    });
    
    const response = await fetch(`https://sveve.no/SMS/SendMessage?${params.toString()}`, {
      method: 'GET',
    });
    
    const text = await response.text();
    
    // Sveve returns "OK: <messageId>" on success
    if (text.startsWith('OK')) {
      const messageId = text.split(':')[1]?.trim();
      console.log('[PhoneVerification] Sveve SMS sent successfully:', messageId);
      return { success: true, messageId };
    }
    
    console.error('[PhoneVerification] Sveve error:', text);
    return { success: false, error: text };
  } catch (error) {
    console.error('[PhoneVerification] Sveve request failed:', error);
    return { success: false, error: 'Failed to send SMS' };
  }
}

/**
 * Link Mobility SMS Provider (Nordic/European)
 * API Docs: https://developers.linkmobility.com/
 */
async function sendViaLinkMobility(phone: string, message: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const apiKey = process.env.LINK_MOBILITY_API_KEY;
  const sender = process.env.LINK_MOBILITY_SENDER || 'VeggaStare';
  const platformId = process.env.LINK_MOBILITY_PLATFORM_ID;
  const platformPartnerId = process.env.LINK_MOBILITY_PARTNER_ID;
  
  if (!apiKey || !platformId) {
    console.error('[PhoneVerification] Link Mobility credentials not configured');
    return { success: false, error: 'SMS provider not configured' };
  }
  
  try {
    const response = await fetch('https://api.linkmobility.eu/sms/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        platformId,
        platformPartnerId,
        source: sender,
        destination: phone,
        userData: message,
      }),
    });
    
    const data = await response.json();
    
    if (response.ok && data.messageId) {
      console.log('[PhoneVerification] Link Mobility SMS sent:', data.messageId);
      return { success: true, messageId: data.messageId };
    }
    
    console.error('[PhoneVerification] Link Mobility error:', data);
    return { success: false, error: data.message || 'Failed to send SMS' };
  } catch (error) {
    console.error('[PhoneVerification] Link Mobility request failed:', error);
    return { success: false, error: 'Failed to send SMS' };
  }
}

/**
 * Twilio SMS Provider (International)
 */
async function sendViaTwilio(phone: string, message: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const fromNumber = process.env.TWILIO_PHONE_NUMBER;
  
  if (!accountSid || !authToken || !fromNumber) {
    console.error('[PhoneVerification] Twilio credentials not configured');
    return { success: false, error: 'SMS provider not configured' };
  }
  
  try {
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': 'Basic ' + Buffer.from(`${accountSid}:${authToken}`).toString('base64'),
        },
        body: new URLSearchParams({
          To: phone,
          From: fromNumber,
          Body: message,
        }),
      }
    );
    
    const data = await response.json();
    
    if (response.ok && data.sid) {
      console.log('[PhoneVerification] Twilio SMS sent:', data.sid);
      return { success: true, messageId: data.sid };
    }
    
    console.error('[PhoneVerification] Twilio error:', data);
    return { success: false, error: data.message || 'Failed to send SMS' };
  } catch (error) {
    console.error('[PhoneVerification] Twilio request failed:', error);
    return { success: false, error: 'Failed to send SMS' };
  }
}

/**
 * Vonage (Nexmo) SMS Provider (International)
 */
async function sendViaVonage(phone: string, message: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const apiKey = process.env.VONAGE_API_KEY;
  const apiSecret = process.env.VONAGE_API_SECRET;
  const sender = process.env.VONAGE_SENDER || 'VeggaStare';
  
  if (!apiKey || !apiSecret) {
    console.error('[PhoneVerification] Vonage credentials not configured');
    return { success: false, error: 'SMS provider not configured' };
  }
  
  try {
    const response = await fetch('https://rest.nexmo.com/sms/json', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        api_key: apiKey,
        api_secret: apiSecret,
        from: sender,
        to: phone.replace('+', ''),
        text: message,
      }),
    });
    
    const data = await response.json();
    
    if (data.messages?.[0]?.status === '0') {
      console.log('[PhoneVerification] Vonage SMS sent:', data.messages[0]['message-id']);
      return { success: true, messageId: data.messages[0]['message-id'] };
    }
    
    console.error('[PhoneVerification] Vonage error:', data);
    return { success: false, error: data.messages?.[0]?.['error-text'] || 'Failed to send SMS' };
  } catch (error) {
    console.error('[PhoneVerification] Vonage request failed:', error);
    return { success: false, error: 'Failed to send SMS' };
  }
}

// ─── Main Service Functions ──────────────────────────────────────────────────

/**
 * Send verification code via SMS
 */
export async function sendVerificationCode(
  phone: string,
  config: PhoneVerificationConfig = { provider: 'SVEVE' }
): Promise<SendCodeResult & { code: string; codeHash: string }> {
  const { provider, codeLength = 6, expirationMinutes = 10 } = config;
  
  // Generate code
  const code = generateVerificationCode(codeLength);
  const codeHash = hashVerificationCode(code);
  const expiresAt = new Date(Date.now() + expirationMinutes * 60 * 1000);
  
  // Format message
  const message = `Your VeggaStare verification code is: ${code}\n\nThis code expires in ${expirationMinutes} minutes.`;
  
  // Send via selected provider
  let result: { success: boolean; messageId?: string; error?: string };
  
  switch (provider) {
    case 'SVEVE':
      result = await sendViaSveve(phone, message);
      break;
    case 'LINK_MOBILITY':
      result = await sendViaLinkMobility(phone, message);
      break;
    case 'TWILIO':
      result = await sendViaTwilio(phone, message);
      break;
    case 'VONAGE':
      result = await sendViaVonage(phone, message);
      break;
    default:
      result = { success: false, error: 'Unknown provider' };
  }
  
  return {
    ...result,
    provider,
    expiresAt,
    code, // Only for internal use - don't expose to client!
    codeHash, // Store this in DB instead of plain code
  };
}

/**
 * Get the best available SMS provider based on configuration
 */
export function getAvailableProvider(): SmsProvider | null {
  // Check Norwegian providers first
  if (process.env.SVEVE_USERNAME && process.env.SVEVE_PASSWORD) {
    return 'SVEVE';
  }
  
  if (process.env.LINK_MOBILITY_API_KEY) {
    return 'LINK_MOBILITY';
  }
  
  // Fall back to international providers
  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
    return 'TWILIO';
  }
  
  if (process.env.VONAGE_API_KEY && process.env.VONAGE_API_SECRET) {
    return 'VONAGE';
  }
  
  return null;
}

/**
 * Check if phone verification is available
 */
export function isPhoneVerificationAvailable(): boolean {
  return getAvailableProvider() !== null;
}
