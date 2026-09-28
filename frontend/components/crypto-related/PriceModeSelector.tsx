"use client";
import React from "react";
import { usePricing } from "./PricingContext";

const PRESETS = [
  { id: "USD_NATIVE", label: "USD + Native" },
  { id: "USD_NOK", label: "USD + NOK" },
  { id: "USD_BTC", label: "USD + BTC" },
  { id: "NOK_BTC", label: "NOK + BTC" },
] as const;

export default function PriceModeSelector() {
  const { preset, setPreset, setCustom } = usePricing();

  return (
    <div className="px-4 py-3 border-t border-border">
      <p className="text-xs text-muted-foreground mb-2">Price Display</p>
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            onClick={() => setPreset(p.id as any)}
            className={`px-3 py-1 rounded-md text-xs sm:text-sm transition ${
              preset === p.id
                ? "bg-blue-600 text-white"
                : "bg-muted hover:bg-muted text-foreground"
            }`}
          >
            {p.label}
          </button>
        ))}

        {/* Example custom: NOK + Native */}
        <button
          onClick={() => setCustom("NOK", "NATIVE")}
          className="px-3 py-1 rounded-md text-xs sm:text-sm bg-muted hover:bg-muted text-foreground"
          title="Custom: NOK + Native coin"
        >
          NOK + Native
        </button>
      </div>
    </div>
  );
}