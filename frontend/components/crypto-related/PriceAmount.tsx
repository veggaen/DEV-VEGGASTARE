"use client";

import React, { useMemo } from "react";
import { usePricing } from "./PricingContext";

function trim(num: number, digits = 6) {
  try {
    const re = new RegExp(`^-?\\d+(?:\\.\\d{0,${digits}})?`);
    return num.toString().match(re)?.[0] ?? "0";
  } catch { return "0"; }
}

export default function PriceAmount({ usd }: { usd: number }) {
  const { nativeSymbol, convertFromUSD } = usePricing();
  const primary = useMemo(() => convertFromUSD(usd, "NATIVE"), [usd, convertFromUSD]);

  if (primary == null) return <span>—</span>;
  return (
    <span>
      {trim(primary, 6)} {nativeSymbol} <span className="text-xs opacity-70">(~ ${trim(usd, 2)})</span>
    </span>
  );
}
