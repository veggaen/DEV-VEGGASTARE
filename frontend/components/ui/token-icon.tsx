"use client";

/**
 * @fileOverview  TokenIcon — Reusable token logo with cascading fallbacks.
 *
 *  Resolution chain:
 *    1. Provided `logo` prop (pre-resolved data URI or URL)
 *    2. Trust Wallet CDN (real logos for 6000+ tokens)
 *    3. Inline SVG by symbol (common tokens)
 *    4. Generated coloured circle with first letter (any token)
 *
 * @stability     stable
 */

import { useState, useCallback, useMemo, useEffect } from "react";
import { getAddress } from "viem";
import {
  getTrustWalletLogoUrl,
  TOKEN_LOGO_FALLBACKS,
  generateLetterIcon,
} from "@/lib/token-icons";

interface TokenIconProps {
  /** Token contract address (or "0x0" for native) */
  address?: string;
  /** Chain ID for Trust Wallet CDN lookup */
  chainId?: number;
  /** Token symbol — used for SVG fallback + letter icon */
  symbol: string;
  /** Optional pre-resolved logo URL (tried first) */
  logo?: string;
  /** Pixel size (width = height). Default 20. */
  size?: number;
  /** Extra Tailwind classes */
  className?: string;
}

export function TokenIcon({
  address,
  chainId,
  symbol,
  logo,
  size = 20,
  className = "",
}: TokenIconProps) {
  // Build ordered source list
  const sources = useMemo(() => {
    const list: string[] = [];

    // 1. Pre-resolved logo (data URI or existing URL)
    if (logo) list.push(logo);

    // 2. Trust Wallet CDN (needs checksummed address)
    if (address && chainId) {
      let checksummed = address;
      try {
        if (address !== "0x0") checksummed = getAddress(address);
      } catch {
        // Invalid address — skip TW CDN
      }
      const twUrl = getTrustWalletLogoUrl(checksummed, chainId);
      if (twUrl) list.push(twUrl);
    }

    // 3. Inline SVG fallback by symbol
    const svgFallback = TOKEN_LOGO_FALLBACKS[symbol.toUpperCase()];
    if (svgFallback) list.push(svgFallback);

    // 4. Generated letter icon (always works)
    list.push(generateLetterIcon(symbol));

    return list;
  }, [address, chainId, symbol, logo]);

  const [srcIndex, setSrcIndex] = useState(0);

  // Reset index when token identity changes
  useEffect(() => {
    setSrcIndex(0);
  }, [address, chainId, symbol]);

  const handleError = useCallback(() => {
    setSrcIndex((prev) => Math.min(prev + 1, sources.length - 1));
  }, [sources.length]);

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={sources[srcIndex]}
      alt={symbol}
      width={size}
      height={size}
      className={`rounded-full shrink-0 ${className}`}
      onError={handleError}
      loading="lazy"
    />
  );
}
