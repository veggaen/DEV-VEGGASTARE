"use client";

import React, { useMemo } from "react";
import { useCurrencyRates } from "@/hooks/useCurrencyRates";
import { useUiPreferences } from "@/components/providers/ui-preferences";

function sanitizeNumberText(input: string) {
  return String(input ?? "")
    .replace(/\u00B7/g, ".")
    .replace(/\u2219/g, ".")
    .replace(/\.{2,}/g, ".")
    .trim();
}

function formatDecimal(value: number, maxFractionDigits: number) {
  try {
    if (!Number.isFinite(value)) return "0";
    const nf = new Intl.NumberFormat("en-US", {
      maximumFractionDigits: maxFractionDigits,
      minimumFractionDigits: 0,
      useGrouping: true,
    });
    return sanitizeNumberText(nf.format(value));
  } catch {
    return sanitizeNumberText(String(value));
  }
}

function formatCurrency(value: number, currency: string) {
  try {
    if (!Number.isFinite(value)) return `${currency} 0`;
    const nf = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency,
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    });
    return sanitizeNumberText(nf.format(value));
  } catch {
    return `${currency} ${formatDecimal(value, 2)}`;
  }
}

// Crypto symbol display names
const CRYPTO_SYMBOLS: Record<string, string> = {
  ETH: "ETH",
  BTC: "BTC", 
  SOL: "SOL",
  USDC: "USDC",
  USDT: "USDT",
};

interface PriceAmountProps {
  /** Price in USD (deprecated - use amount + currency instead) */
  usd?: number;
  /** Price in the original currency */
  amount?: number;
  /** Original currency code (USD, NOK, EUR, GBP) */
  currency?: string;
  /** Whether the product/company accepts web3 payments */
  acceptsWeb3?: boolean;
  /** Specific accepted crypto symbols (e.g., ["ETH", "SOL"]) */
  acceptedCryptos?: string[];
  /** Override user's preferred fiat (for specific displays) */
  displayFiat?: string;
  /** Override user's preferred crypto (for specific displays) */
  displayCrypto?: string;
  /** Allow crypto to become the primary display when the user preference asks for it. */
  allowCryptoPrimary?: boolean;
  /** Show the source/listing currency as secondary when it differs from the selected fiat. */
  showOriginalAmount?: boolean;
  /** Custom render function */
  render?: (parts: {
    primaryText: string;
    secondaryText: string;
    cryptoAmount?: number;
    cryptoSymbol?: string;
    fiatAmount: number;
    fiatCurrency: string;
    originalAmount?: number;
    originalCurrency?: string;
    isStale?: boolean;
  }) => React.ReactNode;
}

export default function PriceAmount({
  usd,
  amount,
  currency = 'USD',
  acceptsWeb3 = false,
  acceptedCryptos,
  displayFiat,
  displayCrypto,
  allowCryptoPrimary = false,
  showOriginalAmount = true,
  render,
}: PriceAmountProps) {
  const { prefs } = useUiPreferences();
  const { 
    convertToUSD, 
    convertFromUSD, 
    convertUSDToCrypto,
    isFiatStale,
    isCryptoStale,
  } = useCurrencyRates();
  
  // Determine which currencies to display
  const targetFiat = displayFiat ?? prefs.preferredFiatCurrency;
  const targetCrypto = displayCrypto ?? prefs.preferredCryptoCurrency;
  const showCryptoFirst = allowCryptoPrimary && prefs.showCryptoFirst && acceptsWeb3 && targetCrypto !== 'NONE';
  
  // Check if the selected crypto is accepted by the product
  const isCryptoAccepted = useMemo(() => {
    if (!acceptsWeb3) return false;
    if (!acceptedCryptos || acceptedCryptos.length === 0) return true; // Accept all if not specified
    return acceptedCryptos.some(c => c.toUpperCase() === targetCrypto);
  }, [acceptsWeb3, acceptedCryptos, targetCrypto]);
  
  // Calculate USD value from original amount
  const usdValue = useMemo(() => {
    if (usd != null) return usd;
    if (amount != null && currency) {
      return convertToUSD(amount, currency);
    }
    return 0;
  }, [usd, amount, currency, convertToUSD]);
  
  // Calculate display amounts
  const fiatAmount = useMemo(() => {
    if (targetFiat === 'USD') return usdValue;
    return convertFromUSD(usdValue, targetFiat);
  }, [usdValue, targetFiat, convertFromUSD]);
  
  const cryptoAmount = useMemo(() => {
    if (!acceptsWeb3 || targetCrypto === 'NONE' || !isCryptoAccepted) return undefined;
    return convertUSDToCrypto(usdValue, targetCrypto);
  }, [usdValue, acceptsWeb3, targetCrypto, isCryptoAccepted, convertUSDToCrypto]);

  if (!Number.isFinite(usdValue)) return <span>—</span>;

  // Format display strings
  const fiatText = formatCurrency(fiatAmount, targetFiat);
  const cryptoText = cryptoAmount != null 
    ? `${formatDecimal(cryptoAmount, 6)} ${CRYPTO_SYMBOLS[targetCrypto] ?? targetCrypto}`
    : null;
  
  // Original currency display (if different from target)
  const showOriginal = showOriginalAmount && amount != null && currency !== targetFiat;
  const originalText = showOriginal ? formatCurrency(amount, currency) : null;

  // Build primary and secondary text based on preferences
  let primaryText: string;
  let secondaryText: string;
  
  if (showCryptoFirst && cryptoText && isCryptoAccepted) {
    // Web3 enabled: "0.257 ETH (NOK 8,500,-)"
    primaryText = cryptoText;
    secondaryText = showOriginal && originalText 
      ? `(${originalText} ≈ ${fiatText})`
      : `(≈ ${fiatText})`;
  } else {
    // Fiat first: "$773.50 (NOK 8,500,-)"
    primaryText = fiatText;
    if (showOriginal && originalText && originalText !== fiatText) {
      secondaryText = cryptoText && isCryptoAccepted
        ? `(${originalText} ≈ ${cryptoText})`
        : `(${originalText})`;
    } else if (cryptoText && isCryptoAccepted) {
      secondaryText = `(≈ ${cryptoText})`;
    } else {
      secondaryText = '';
    }
  }

  if (render) {
    return (
      <>
        {render({
          primaryText,
          secondaryText,
          cryptoAmount: cryptoAmount,
          cryptoSymbol: isCryptoAccepted ? targetCrypto : undefined,
          fiatAmount,
          fiatCurrency: targetFiat,
          originalAmount: amount,
          originalCurrency: currency,
          isStale: isFiatStale || isCryptoStale,
        })}
      </>
    );
  }

  return (
    <span>
      {primaryText}
      {secondaryText && <span className="text-xs opacity-70 ml-1">{secondaryText}</span>}
    </span>
  );
}
