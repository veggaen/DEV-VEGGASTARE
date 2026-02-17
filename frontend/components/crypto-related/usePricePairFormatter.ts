"use client";
import { usePricing } from "./PricingContext";

export function usePricePairFormatter() {
  const { primary, secondary, convertFromUSD, resolveUnit } = usePricing();

  const fmt = (u: string, n: number | null) => {
    if (n == null) return "—";
    if (u === "USD" || u === "NOK") {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: u,
        maximumFractionDigits: 2,
      }).format(n);
    }
    return `${new Intl.NumberFormat("en-US", { maximumFractionDigits: 6 }).format(n)} ${u}`;
  };

  const formatPair = (usdAmount: number) => {
    const pUnit = resolveUnit(primary);
    const sUnit = resolveUnit(secondary);
    const p = convertFromUSD(usdAmount, primary);
    const s = convertFromUSD(usdAmount, secondary);
    return `${fmt(String(pUnit), p)} • ${fmt(String(sUnit), s)}`;
  };

  const formatSingle = (usdAmount: number, unit: "PRIMARY" | "SECONDARY" = "PRIMARY") => {
    const u = unit === "PRIMARY" ? primary : secondary;
    const real = resolveUnit(u);
    const n = convertFromUSD(usdAmount, u);
    return fmt(String(real), n);
  };

  return { formatPair, formatSingle };
}