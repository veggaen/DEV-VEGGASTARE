"use client";
/** @fileOverview Shared fiat (crypto) display; never a payment quote or eligibility check. @stability stable */
import type { ReactNode } from 'react';
import { useCurrencyRates } from '@/hooks/useCurrencyRates';
import { useUiPreferences } from '@/components/providers/ui-preferences';
import { priceDisplay, type PriceDisplayParts } from '@/lib/price-display';

interface PriceAmountProps {
  usd?: number;
  amount?: number;
  currency?: string | null;
  /** Legacy payment metadata; intentionally does not control display preferences. */
  acceptsWeb3?: boolean;
  acceptedCryptos?: string[];
  displayFiat?: string;
  displayCrypto?: string;
  /** @deprecated Prices always display fiat first. */
  allowCryptoPrimary?: boolean;
  /** @deprecated Source currency belongs in transaction details, not price parentheses. */
  showOriginalAmount?: boolean;
  render?: (parts: PriceDisplayParts) => ReactNode;
}

/** Sum mixed listing currencies only for presentation; unknown currency fails closed. */
export function PriceTotal({ entries }: { entries: { amount: number; currency?: string | null }[] }) {
  const rates = useCurrencyRates();
  const total = entries.reduce((sum, entry) => sum + priceDisplay({ ...entry, fiat: 'USD', crypto: 'NONE', fiatRates: rates.fiatRates, cryptoPrices: {}, loading: rates.isLoading && !rates.lastUpdated }).fiatAmount, 0);
  return <PriceAmount usd={total} />;
}

export default function PriceAmount({ usd, amount, currency = 'USD', displayFiat, displayCrypto, render }: PriceAmountProps) {
  const { prefs } = useUiPreferences();
  const rates = useCurrencyRates();
  const parts = priceDisplay({
    amount: usd ?? amount ?? Number.NaN,
    currency: usd != null ? 'USD' : currency,
    fiat: displayFiat ?? prefs.preferredFiatCurrency,
    crypto: displayCrypto ?? prefs.preferredCryptoCurrency,
    fiatRates: rates.fiatRates,
    cryptoPrices: rates.cryptoPrices,
    loading: rates.isLoading && !rates.lastUpdated,
    stale: rates.isFiatStale || rates.isCryptoStale,
  });
  if (render) return <>{render(parts)}</>;
  return <span data-price-display className="inline-block max-w-full tabular-nums" title={parts.isEstimate ? `Display estimate${parts.isStale ? ' using last available rates' : ''}. Payment totals are confirmed at checkout.` : undefined}>
    <span className="whitespace-nowrap">{parts.primaryText}</span>
    {parts.secondaryText && <> <span className="inline-block text-xs font-normal text-muted-foreground">{parts.secondaryText}</span></>}
  </span>;
}
