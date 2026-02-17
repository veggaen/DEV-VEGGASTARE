"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, ReactNode } from "react";
import { useActiveNetwork } from "./ActiveNetworkContext";

type Fiat = "USD" | "NOK";
type Coin = "BTC" | "SOL" | "ETH" | "PLS";
type Special = "NATIVE";
type Unit = Fiat | Coin | Special;

type Preset = "USD_NATIVE" | "USD_NOK" | "USD_BTC" | "NOK_BTC" | "CUSTOM";

type Ctx = {
  preset: Preset;
  setPreset: (p: Preset) => void;
  primary: Unit;
  secondary: Unit;
  setCustom: (u1: Unit, u2: Unit) => void;
  rates: {
    SOL?: { usd: number; nok: number };
    ETH?: { usd: number; nok: number };
    PLS?: { usd: number; nok: number };
    BTC?: { usd: number; nok: number };
    USDNOK?: number;
  };
  convertFromUSD: (amountUSD: number, unit: Unit) => number | null;
  resolveUnit: (u: Unit) => Unit;
};

const PriceCtx = createContext<Ctx | null>(null);

const STORAGE_KEY = "fs.priceDisplay.preset";
const CUSTOM_KEY = "fs.priceDisplay.custom";

const CG_IDS = {
  SOL: "solana",
  ETH: "ethereum",
  PLS: "pulsechain",
  BTC: "bitcoin",
  USDC: "usd-coin",
};

export function PriceDisplayProvider({ children }: { children: ReactNode }) {
  const { active } = useActiveNetwork();

  const defaultPreset: Preset = "USD_NATIVE";
  const [preset, setPresetState] = useState<Preset>(defaultPreset);
  const [customPrimary, setCustomPrimary] = useState<Unit>("USD");
  const [customSecondary, setCustomSecondary] = useState<Unit>("NATIVE");
  const [rates, setRates] = useState<Ctx["rates"]>({});

  useEffect(() => {
    let nextPreset: Preset | null = null;
    let nextPrimary: Unit | null = null;
    let nextSecondary: Unit | null = null;
    try {
      const p = localStorage.getItem(STORAGE_KEY) as Preset | null;
      if (p) nextPreset = p;
      const raw = localStorage.getItem(CUSTOM_KEY);
      if (raw) {
        const j = JSON.parse(raw);
        if (j?.primary) nextPrimary = j.primary;
        if (j?.secondary) nextSecondary = j.secondary;
      }
    } catch {}
    const timeoutId = window.setTimeout(() => {
      if (nextPreset) setPresetState(nextPreset);
      if (nextPrimary) setCustomPrimary(nextPrimary);
      if (nextSecondary) setCustomSecondary(nextSecondary);
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, []);

  const setPreset = (p: Preset) => {
    setPresetState(p);
    try { localStorage.setItem(STORAGE_KEY, p); } catch {}
  };
  const setCustom = (u1: Unit, u2: Unit) => {
    setCustomPrimary(u1);
    setCustomSecondary(u2);
    setPreset("CUSTOM");
    try { localStorage.setItem(CUSTOM_KEY, JSON.stringify({ primary: u1, secondary: u2 })); } catch {}
  };

  const native: Coin = useMemo(() => {
    if (active.kind === "solana") return "SOL";
    if (active.kind === "evm") {
      if (active.chainId === 1) return "ETH";
      if (active.chainId === 369) return "PLS";
      return "ETH";
    }
    return "ETH";
  }, [active]);

  const resolveUnit = useCallback((u: Unit): Unit => (u === "NATIVE" ? native : u), [native]);

  const [primary, secondary] = useMemo<[Unit, Unit]>(() => {
    if (preset === "CUSTOM") return [customPrimary, customSecondary];
    if (preset === "USD_NATIVE") return ["USD", "NATIVE"];
    if (preset === "USD_NOK") return ["USD", "NOK"];
    if (preset === "USD_BTC") return ["USD", "BTC"];
    if (preset === "NOK_BTC") return ["NOK", "BTC"];
    return ["USD", "NATIVE"];
  }, [preset, customPrimary, customSecondary]);

  useEffect(() => {
    let stopped = false;
    async function load() {
      try {
        const res = await fetch(
          `https://api.coingecko.com/api/v3/simple/price?ids=${[
            CG_IDS.SOL, CG_IDS.ETH, CG_IDS.PLS, CG_IDS.BTC, CG_IDS.USDC,
          ].join(",")}&vs_currencies=usd,nok`,
          { cache: "no-store" }
        );
        const j = await res.json();
        if (stopped) return;

        const SOL = j?.[CG_IDS.SOL] ? { usd: j[CG_IDS.SOL].usd, nok: j[CG_IDS.SOL].nok } : undefined;
        const ETH = j?.[CG_IDS.ETH] ? { usd: j[CG_IDS.ETH].usd, nok: j[CG_IDS.ETH].nok } : undefined;
        const PLS = j?.[CG_IDS.PLS] ? { usd: j[CG_IDS.PLS].usd, nok: j[CG_IDS.PLS].nok } : undefined;
        const BTC = j?.[CG_IDS.BTC] ? { usd: j[CG_IDS.BTC].usd, nok: j[CG_IDS.BTC].nok } : undefined;
        const USDNOK = j?.[CG_IDS.USDC]?.nok ?? null;

        setRates({ SOL, ETH, PLS, BTC, USDNOK: USDNOK || undefined });
      } catch {}
    }
    load();
    const t = setInterval(load, 60_000);
    return () => { stopped = true; clearInterval(t); };
  }, []);

  const convertFromUSD = useCallback((amountUSD: number, unit: Unit): number | null => {
    const u = resolveUnit(unit);
    if (u === "USD") return amountUSD;
    if (u === "NOK") return rates.USDNOK ? amountUSD * rates.USDNOK : null;
    if (u === "SOL") return rates.SOL?.usd ? amountUSD / rates.SOL.usd : null;
    if (u === "ETH") return rates.ETH?.usd ? amountUSD / rates.ETH.usd : null;
    if (u === "PLS") return rates.PLS?.usd ? amountUSD / rates.PLS.usd : null;
    if (u === "BTC") return rates.BTC?.usd ? amountUSD / rates.BTC.usd : null;
    return null;
  }, [rates, resolveUnit]);

  const value: Ctx = { preset, setPreset, primary, secondary, setCustom, rates, convertFromUSD, resolveUnit };

  return <PriceCtx.Provider value={value}>{children}</PriceCtx.Provider>;
}

export function usePriceDisplay() {
  const ctx = useContext(PriceCtx);
  if (!ctx) throw new Error("usePriceDisplay must be used within PriceDisplayProvider");
  return ctx;
}
