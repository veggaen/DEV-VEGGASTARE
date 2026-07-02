/**
 * Payment Provider Abstraction Layer
 *
 * Unified interface for all payment methods (fiat + crypto).
 * Each provider implements createSession → redirect/widget → webhook confirm.
 */

// ─── Types ────────────────────────────────────────────────────

export type PaymentProviderType = 'vipps' | 'klarna' | 'paypal' | 'crypto';

export interface PaymentSessionRequest {
  orderId: string;
  amount: number;           // In smallest unit (øre for NOK, cents for USD)
  currency: string;         // 'NOK', 'USD', 'EUR'
  description: string;
  customerEmail?: string;
  customerPhone?: string;
  returnUrl: string;        // Where to redirect after payment
  callbackUrl: string;      // Webhook URL for server-to-server
  metadata?: Record<string, string>;
  /** Seller’s verified PayPal email — routes payment directly to seller via PayPal payee. */
  sellerEmail?: string;
}

export interface PaymentSession {
  provider: PaymentProviderType;
  sessionId: string;
  redirectUrl?: string;     // For redirect-based flows (Vipps, PayPal)
  clientToken?: string;     // For widget-based flows (Klarna)
  expiresAt?: string;
}

export interface PaymentStatus {
  provider: PaymentProviderType;
  sessionId: string;
  status: 'PENDING' | 'AUTHORIZED' | 'CAPTURED' | 'CANCELLED' | 'REFUNDED' | 'FAILED';
  transactionId?: string;
  amount: number;
  currency: string;
  paidAt?: string;
  metadata?: Record<string, string>;
}

export interface PaymentProvider {
  type: PaymentProviderType;
  name: string;
  displayName: string;
  icon: string;             // Emoji or icon path
  currencies: string[];
  isAvailable: boolean;
  createSession(req: PaymentSessionRequest): Promise<PaymentSession>;
  getStatus(sessionId: string): Promise<PaymentStatus>;
  capturePayment?(sessionId: string, amount?: number): Promise<PaymentStatus>;
  cancelPayment?(sessionId: string): Promise<PaymentStatus>;
  refundPayment?(sessionId: string, amount?: number): Promise<PaymentStatus>;
}

// ─── Vipps Provider ───────────────────────────────────────────

export class VippsProvider implements PaymentProvider {
  type: PaymentProviderType = 'vipps';
  name = 'vipps';
  displayName = 'Vipps';
  icon = '📱';
  currencies = ['NOK'];
  isAvailable: boolean;

  private clientId: string;
  private clientSecret: string;
  private subscriptionKey: string;
  private merchantSerialNumber: string;
  private baseUrl: string;

  constructor() {
    this.clientId = process.env.VIPPS_CLIENT_ID ?? '';
    this.clientSecret = process.env.VIPPS_CLIENT_SECRET ?? '';
    this.subscriptionKey = process.env.VIPPS_SUBSCRIPTION_KEY ?? '';
    this.merchantSerialNumber = process.env.VIPPS_MSN ?? '';
    this.baseUrl = process.env.VIPPS_API_URL ?? 'https://apitest.vipps.no';
    this.isAvailable = !!(this.clientId && this.clientSecret && this.subscriptionKey);
  }

  private async getAccessToken(): Promise<string> {
    const res = await fetch(`${this.baseUrl}/accesstoken/get`, {
      method: 'POST',
      headers: {
        'client_id': this.clientId,
        'client_secret': this.clientSecret,
        'Ocp-Apim-Subscription-Key': this.subscriptionKey,
        'Merchant-Serial-Number': this.merchantSerialNumber,
      },
    });
    if (!res.ok) throw new Error(`Vipps auth failed: ${res.status}`);
    const data = await res.json();
    return data.access_token;
  }

  async createSession(req: PaymentSessionRequest): Promise<PaymentSession> {
    const token = await this.getAccessToken();
    const reference = `order-${req.orderId}-${Date.now()}`;

    const res = await fetch(`${this.baseUrl}/epayment/v1/payments`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'Ocp-Apim-Subscription-Key': this.subscriptionKey,
        'Merchant-Serial-Number': this.merchantSerialNumber,
        'Idempotency-Key': reference,
      },
      body: JSON.stringify({
        amount: {
          currency: 'NOK',
          value: req.amount, // In øre (100 = 1 NOK)
        },
        paymentMethod: { type: 'WALLET' },
        reference,
        returnUrl: req.returnUrl,
        userFlow: 'WEB_REDIRECT',
        paymentDescription: req.description,
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Vipps create payment failed: ${err}`);
    }

    const data = await res.json();
    return {
      provider: 'vipps',
      sessionId: data.reference,
      redirectUrl: data.redirectUrl,
    };
  }

  async getStatus(sessionId: string): Promise<PaymentStatus> {
    const token = await this.getAccessToken();
    const res = await fetch(`${this.baseUrl}/epayment/v1/payments/${sessionId}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Ocp-Apim-Subscription-Key': this.subscriptionKey,
        'Merchant-Serial-Number': this.merchantSerialNumber,
      },
    });

    if (!res.ok) throw new Error(`Vipps status check failed`);
    const data = await res.json();

    const statusMap: Record<string, PaymentStatus['status']> = {
      CREATED: 'PENDING',
      AUTHORIZED: 'AUTHORIZED',
      CAPTURED: 'CAPTURED',
      CANCELLED: 'CANCELLED',
      REFUNDED: 'REFUNDED',
      FAILED: 'FAILED',
      EXPIRED: 'CANCELLED',
    };

    return {
      provider: 'vipps',
      sessionId,
      status: statusMap[data.state] ?? 'PENDING',
      transactionId: data.pspReference,
      amount: data.amount?.value ?? 0,
      currency: 'NOK',
    };
  }
}

// ─── Klarna Provider ──────────────────────────────────────────

export class KlarnaProvider implements PaymentProvider {
  type: PaymentProviderType = 'klarna';
  name = 'klarna';
  displayName = 'Klarna';
  icon = '💳';
  currencies = ['NOK', 'SEK', 'EUR', 'USD', 'GBP'];
  isAvailable: boolean;

  private username: string;
  private password: string;
  private baseUrl: string;

  constructor() {
    this.username = process.env.KLARNA_API_USERNAME ?? '';
    this.password = process.env.KLARNA_API_PASSWORD ?? '';
    this.baseUrl = process.env.KLARNA_API_URL ?? 'https://api.playground.klarna.com';
    this.isAvailable = !!(this.username && this.password);
  }

  private get authHeader(): string {
    return `Basic ${Buffer.from(`${this.username}:${this.password}`).toString('base64')}`;
  }

  async createSession(req: PaymentSessionRequest): Promise<PaymentSession> {
    const res = await fetch(`${this.baseUrl}/payments/v1/sessions`, {
      method: 'POST',
      headers: {
        'Authorization': this.authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        purchase_country: 'NO',
        purchase_currency: req.currency,
        locale: 'nb-NO',
        order_amount: req.amount,
        order_lines: [{
          type: 'physical',
          name: req.description,
          quantity: 1,
          unit_price: req.amount,
          total_amount: req.amount,
        }],
        merchant_urls: {
          confirmation: req.returnUrl,
          notification: req.callbackUrl,
        },
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Klarna session failed: ${err}`);
    }

    const data = await res.json();
    return {
      provider: 'klarna',
      sessionId: data.session_id,
      clientToken: data.client_token,
    };
  }

  async getStatus(sessionId: string): Promise<PaymentStatus> {
    const res = await fetch(`${this.baseUrl}/payments/v1/sessions/${sessionId}`, {
      headers: { 'Authorization': this.authHeader },
    });

    if (!res.ok) throw new Error(`Klarna status check failed`);
    const data = await res.json();

    return {
      provider: 'klarna',
      sessionId,
      status: data.status === 'complete' ? 'CAPTURED' : 'PENDING',
      amount: data.order_amount ?? 0,
      currency: data.purchase_currency ?? 'NOK',
    };
  }
}

// ─── PayPal Provider ──────────────────────────────────────────

export class PayPalProvider implements PaymentProvider {
  type: PaymentProviderType = 'paypal';
  name = 'paypal';
  displayName = 'PayPal';
  icon = '🅿️';
  currencies = ['USD', 'NOK', 'EUR', 'GBP'];
  isAvailable: boolean;

  private clientId: string;
  private clientSecret: string;
  private baseUrl: string;

  constructor() {
    this.clientId = process.env.PAYPAL_CLIENT_ID ?? '';
    this.clientSecret = process.env.PAYPAL_CLIENT_SECRET ?? '';
    this.baseUrl = process.env.PAYPAL_API_URL ?? 'https://api-m.sandbox.paypal.com';
    this.isAvailable = !!(this.clientId && this.clientSecret);
  }

  private async getAccessToken(): Promise<string> {
    const res = await fetch(`${this.baseUrl}/v1/oauth2/token`, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${this.clientId}:${this.clientSecret}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });
    if (!res.ok) {
      const details = await res.text().catch(() => '');
      throw new Error(`PayPal auth failed${details ? `: ${details}` : ''}`);
    }
    const data = await res.json();
    return data.access_token;
  }

  private withQueryParam(url: string, key: string, value: string): string {
    const parsed = new URL(url);
    parsed.searchParams.set(key, value);
    return parsed.toString();
  }

  async createSession(req: PaymentSessionRequest): Promise<PaymentSession> {
    const token = await this.getAccessToken();
    const enableSellerPayeeRouting = process.env.PAYPAL_ENABLE_SELLER_PAYEE_ROUTING === 'true';

    const res = await fetch(`${this.baseUrl}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [{
          reference_id: req.orderId,
          description: req.description,
          amount: {
            currency_code: req.currency,
            value: (req.amount / 100).toFixed(2), // PayPal uses major units
          },
          // Route payment to seller if their verified PayPal email is provided
          ...(enableSellerPayeeRouting && req.sellerEmail ? {
            payee: {
              email_address: req.sellerEmail,
            },
          } : {}),
        }],
        application_context: {
          return_url: req.returnUrl,
          cancel_url: this.withQueryParam(req.returnUrl, 'cancelled', 'true'),
          brand_name: 'VeggaStare',
          user_action: 'PAY_NOW',
        },
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`PayPal order creation failed: ${err}`);
    }

    const data = await res.json();
    const approveLink = data.links?.find((l: { rel: string }) => l.rel === 'approve');
    if (!approveLink?.href) {
      throw new Error(`PayPal order creation did not return an approval URL for order ${req.orderId}`);
    }

    return {
      provider: 'paypal',
      sessionId: data.id,
      redirectUrl: approveLink?.href,
    };
  }

  async getStatus(sessionId: string): Promise<PaymentStatus> {
    const token = await this.getAccessToken();
    const res = await fetch(`${this.baseUrl}/v2/checkout/orders/${sessionId}`, {
      headers: { 'Authorization': `Bearer ${token}` },
    });

    if (!res.ok) throw new Error('PayPal status check failed');
    const data = await res.json();

    const statusMap: Record<string, PaymentStatus['status']> = {
      CREATED: 'PENDING',
      APPROVED: 'AUTHORIZED',
      COMPLETED: 'CAPTURED',
      VOIDED: 'CANCELLED',
    };

    return {
      provider: 'paypal',
      sessionId,
      status: statusMap[data.status] ?? 'PENDING',
      transactionId: data.id,
      amount: parseFloat(data.purchase_units?.[0]?.amount?.value ?? '0') * 100,
      currency: data.purchase_units?.[0]?.amount?.currency_code ?? 'USD',
    };
  }

  async capturePayment(sessionId: string): Promise<PaymentStatus> {
    const token = await this.getAccessToken();
    const res = await fetch(`${this.baseUrl}/v2/checkout/orders/${sessionId}/capture`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      const err = await res.text().catch(() => '');
      throw new Error(`PayPal capture failed${err ? `: ${err}` : ''}`);
    }
    const data = await res.json();

    return {
      provider: 'paypal',
      sessionId,
      status: data.status === 'COMPLETED' ? 'CAPTURED' : 'FAILED',
      transactionId: data.purchase_units?.[0]?.payments?.captures?.[0]?.id,
      amount: parseFloat(data.purchase_units?.[0]?.amount?.value ?? '0') * 100,
      currency: data.purchase_units?.[0]?.amount?.currency_code ?? 'USD',
    };
  }
}

// ─── Provider Registry ────────────────────────────────────────

let _providers: Map<PaymentProviderType, PaymentProvider> | null = null;

export function getPaymentProviders(): Map<PaymentProviderType, PaymentProvider> {
  if (_providers) return _providers;

  _providers = new Map();
  const vipps = new VippsProvider();
  const klarna = new KlarnaProvider();
  const paypal = new PayPalProvider();

  if (vipps.isAvailable) _providers.set('vipps', vipps);
  if (klarna.isAvailable) _providers.set('klarna', klarna);
  if (paypal.isAvailable) _providers.set('paypal', paypal);

  return _providers;
}

export function getPaymentProvider(type: PaymentProviderType): PaymentProvider | undefined {
  return getPaymentProviders().get(type);
}

/**
 * Get all available payment methods for display
 */
export function getAvailablePaymentMethods(): {
  type: PaymentProviderType;
  name: string;
  displayName: string;
  icon: string;
  currencies: string[];
}[] {
  const providers = getPaymentProviders();
  const methods = [];

  // Always show crypto as available
  methods.push({
    type: 'crypto' as PaymentProviderType,
    name: 'crypto',
    displayName: 'Crypto (ETH/SOL/PLS)',
    icon: '⛓️',
    currencies: ['USD', 'ETH', 'SOL', 'PLS'],
  });

  for (const [, provider] of providers) {
    methods.push({
      type: provider.type,
      name: provider.name,
      displayName: provider.displayName,
      icon: provider.icon,
      currencies: provider.currencies,
    });
  }

  return methods;
}
