"use client";
import React, { createContext, useContext, useMemo, useState, useCallback } from "react";
import { usePricing } from "./PricingContext";

type UnitKey = "USD" | "NOK" | "BTC" | "NATIVE";
type Preset = "USD_NATIVE" | "USD_NOK" | "USD_BTC" | "NOK_BTC";

type Ctx = {
  preset: Preset;
  setPreset: (p: Preset) => void;
  setCustom: (primary: UnitKey, secondary: UnitKey) => void;

  primary: UnitKey;
  secondary: UnitKey;

  convertFromUSD: (usd: number, unit: UnitKey | "PRIMARY" | "SECONDARY") => number | null;
  resolveUnit: (unit: UnitKey | "PRIMARY" | "SECONDARY") => UnitKey;
};

const PriceDisplayContext = createContext<Ctx | null>(null);

export function PriceDisplayProvider({ children }: { children: React.ReactNode }) {
  const { rates, convertFromUSD: baseConvert } = usePricing();
  const [preset, setPreset] = useState<Preset>("USD_NATIVE");
  const [customPair, setCustomPair] = useState<{ p: UnitKey; s: UnitKey } | null>(null);

  const defaultPairs: Record<Preset, { p: UnitKey; s: UnitKey }> = {
    USD_NATIVE: { p: "USD", s: "NATIVE" },
    USD_NOK: { p: "USD", s: "NOK" },
    USD_BTC: { p: "USD", s: "BTC" },
    NOK_BTC: { p: "NOK", s: "BTC" },
  };

  // Explicit typing avoids union-widening and the “primary/secondary” error
  const pair: { p: UnitKey; s: UnitKey } = useMemo(
    () => (customPair ?? defaultPairs[preset]),
    [preset, customPair]
  );
  const primary = pair.p;
  const secondary = pair.s;

  const setCustom = (p: UnitKey, s: UnitKey) => setCustomPair({ p, s });

  const resolveUnit = useCallback(
    (u: UnitKey | "PRIMARY" | "SECONDARY"): UnitKey => {
      if (u === "PRIMARY") return primary;
      if (u === "SECONDARY") return secondary;
      return u;
    },
    [primary, secondary]
  );

  const convertFromUSD = useCallback(
    (usd: number, u: UnitKey | "PRIMARY" | "SECONDARY") => {
      const real = resolveUnit(u);
      if (real === "USD") return usd;

      if (real === "NOK") {
        // If rates.NOK.usd means USD per NOK, then NOK = USD * (1 / USD_PER_NOK)
        const usdPerNok = (rates as any)?.NOK?.usd;
        if (!usdPerNok) return null;
        return usd * (1 / usdPerNok);
      }

      if (real === "BTC") {
        const btcUsd = (rates as any)?.BTC?.usd;
        return btcUsd ? usd / btcUsd : null;
      }

      if (real === "NATIVE") {
        return baseConvert(usd, "NATIVE");
      }

      return null;
    },
    [resolveUnit, baseConvert, rates]
  );

  const value: Ctx = { preset, setPreset, setCustom, primary, secondary, convertFromUSD, resolveUnit };
  return <PriceDisplayContext.Provider value={value}>{children}</PriceDisplayContext.Provider>;
}

export function usePriceDisplay() {
  const ctx = useContext(PriceDisplayContext);
  if (!ctx) throw new Error("usePriceDisplay must be used within PriceDisplayProvider");
  return ctx;
}
