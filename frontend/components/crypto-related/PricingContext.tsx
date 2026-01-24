"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

type Rates = {
  USD?: { usd: number }; // self 1.0
  ETH?: { usd: number };
  PLS?: { usd: number };
  SOL?: { usd: number };
  NOK?: { usd: number };
};

type Preset =
  | "USD_NATIVE"
  | "USD_NOK"
  | "USD_BTC"   // placeholder for future
  | "NOK_BTC";  // placeholder for future

type Ctx = {
  rates: { [k: string]: { usd: number } };
  nativeSymbol: "ETH" | "PLS";
  preset: Preset;
  setPreset: (p: Preset) => void;
  setCustom: (fiat: "USD" | "NOK", second: "NATIVE") => void;
  primary: string;   // unit id, e.g., "USD"
  secondary: string; // unit id, e.g., "ETH" | "PLS" | "SOL" | "NOK"
  resolveUnit: (u: string) => string;
  convertFromUSD: (usdAmount: number, unit: string) => number | null;
};

const PricingCtx = createContext<Ctx | null>(null);

export function PricingProvider({ children }: { children: React.ReactNode }) {
  const [rates, setRates] = useState<Rates>({
    USD: { usd: 1 },
    ETH: { usd: 3000 },
    PLS: { usd: 0.0002 },
    SOL: { usd: 150 },
    NOK: { usd: 0.092 }, // approx 1 NOK = 0.092 USD
  });

  // choose your app's main EVM chain symbol; you can make this dynamic per active chain if you like
  const [nativeSymbol] = useState<"ETH" | "PLS">("ETH");
  const [preset, setPreset] = useState<Preset>("USD_NATIVE");
  const [custom, setCustomState] = useState<{ fiat: "USD" | "NOK"; second: "NATIVE" } | null>(null);

  // (Optional) Replace with a real price fetcher later
  useEffect(() => {
    // no-op placeholder
  }, []);

  const setCustom = (fiat: "USD" | "NOK", second: "NATIVE") => {
    setCustomState({ fiat, second });
    setPreset("USD_NATIVE");
  };

  const { primary, secondary } = useMemo(() => {
    if (custom) {
      return {
        primary: custom.fiat,
        secondary: custom.second === "NATIVE" ? nativeSymbol : custom.second,
      };
    }
    switch (preset) {
      case "USD_NATIVE":
        return { primary: "USD", secondary: nativeSymbol };
      case "USD_NOK":
        return { primary: "USD", secondary: "NOK" };
      case "USD_BTC":
        return { primary: "USD", secondary: "BTC" }; // not provided in rates (kept for future)
      case "NOK_BTC":
        return { primary: "NOK", secondary: "BTC" }; // not provided in rates (kept for future)
      default:
        return { primary: "USD", secondary: nativeSymbol };
    }
  }, [preset, custom, nativeSymbol]);

  const resolveUnit = (u: string) => {
    if (u === "NATIVE") return nativeSymbol;
    return u;
  };

  const convertFromUSD = (usdAmount: number, unit: string) => {
    const real = resolveUnit(unit);
    if (real === "USD") return usdAmount;
    const rate = rates[real as keyof Rates]?.usd;
    if (rate == null || rate === 0) return null;
    return usdAmount / rate;
  };

  const value: Ctx = {
    rates: rates as any,
    nativeSymbol,
    preset,
    setPreset,
    setCustom,
    primary,
    secondary,
    resolveUnit,
    convertFromUSD,
  };

  return <PricingCtx.Provider value={value}>{children}</PricingCtx.Provider>;
}

export function usePricing() {
  const ctx = useContext(PricingCtx);
  if (!ctx) throw new Error("usePricing must be used within PricingProvider");
  return ctx;
}
