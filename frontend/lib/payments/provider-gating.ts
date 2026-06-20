/**
 * @fileOverview Payment provider gating rules for runtime mode and production safety checks.
 * @stability stable
 */

import type { PaymentProviderType } from '@/lib/payments/providers';
import type { RuntimeConfigSnapshot } from '@/lib/runtime-config';

export type ProviderGateResult = {
  enabled: boolean;
  reason?: string;
  missingEnv: string[];
};

const REQUIRED_ENV: Record<Exclude<PaymentProviderType, 'crypto'>, string[]> = {
  vipps: ['VIPPS_CLIENT_ID', 'VIPPS_CLIENT_SECRET', 'VIPPS_SUBSCRIPTION_KEY', 'VIPPS_WEBHOOK_SECRET'],
  klarna: ['KLARNA_API_USERNAME', 'KLARNA_API_PASSWORD', 'KLARNA_WEBHOOK_SECRET'],
  paypal: ['PAYPAL_CLIENT_ID', 'PAYPAL_CLIENT_SECRET', 'PAYPAL_WEBHOOK_ID'],
};

function isConfigured(key: string): boolean {
  const value = process.env[key];
  return typeof value === 'string' && value.trim().length > 0;
}

export function getProviderGate(
  provider: Exclude<PaymentProviderType, 'crypto'>,
  runtime: RuntimeConfigSnapshot,
): ProviderGateResult {
  const missingEnv = REQUIRED_ENV[provider].filter((key) => !isConfigured(key));
  const inProduction = process.env.NODE_ENV === 'production';
  const allowLocalPaypalTest =
    !inProduction &&
    provider === 'paypal' &&
    missingEnv.length === 0;

  if (!runtime.paymentsLiveEnabled && !allowLocalPaypalTest) {
    return {
      enabled: false,
      reason: 'Payments live mode disabled by owner',
      missingEnv,
    };
  }

  if (inProduction && missingEnv.length > 0) {
    return {
      enabled: false,
      reason: `Missing required production configuration: ${missingEnv.join(', ')}`,
      missingEnv,
    };
  }

  return {
    enabled: missingEnv.length === 0 || !inProduction,
    reason: missingEnv.length > 0 ? `Missing configuration: ${missingEnv.join(', ')}` : undefined,
    missingEnv,
  };
}

export function getEnabledPaymentProviders(runtime: RuntimeConfigSnapshot): Exclude<PaymentProviderType, 'crypto'>[] {
  const providers: Array<Exclude<PaymentProviderType, 'crypto'>> = ['vipps', 'klarna', 'paypal'];
  return providers.filter((provider) => getProviderGate(provider, runtime).enabled);
}
