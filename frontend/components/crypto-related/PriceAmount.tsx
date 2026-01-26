"use client";

import React, { useMemo } from "react";
import { usePricing } from "./PricingContext";

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

function formatUSD(value: number) {
  try {
    if (!Number.isFinite(value)) return "$0";
    const nf = new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 2,
      minimumFractionDigits: 2,
    });
    return sanitizeNumberText(nf.format(value));
  } catch {
    return `$${formatDecimal(value, 2)}`;
  }
}

export default function PriceAmount({
  usd,
  render,
}: {
  usd: number;
  render?: (parts: {
    primaryText: string;
    secondaryText: string;
    nativeSymbol: string;
    primary: number;
    usd: number;
  }) => React.ReactNode;
}) {
  const { nativeSymbol, convertFromUSD } = usePricing();
  const primary = useMemo(() => convertFromUSD(usd, "NATIVE"), [usd, convertFromUSD]);

  if (primary == null) return <span>—</span>;

  const primaryText = `${formatDecimal(primary, 6)} ${nativeSymbol}`;
  const secondaryText = `(~ ${formatUSD(usd)})`;

  if (render) {
    return (
      <>
        {render({
          primaryText,
          secondaryText,
          nativeSymbol,
          primary,
          usd,
        })}
      </>
    );
  }

  return (
    <span>
      {primaryText} <span className="text-xs opacity-70">{secondaryText}</span>
    </span>
  );
}
