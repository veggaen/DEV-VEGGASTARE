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
    <div className="px-4 py-3 border-t border-gray-200 dark:border-gray-700">
      <p className="text-xs text-gray-500 dark:text-gray-400 mb-2">Price Display</p>
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button
            key={p.id}
            onClick={() => setPreset(p.id as any)}
            className={`px-3 py-1 rounded-md text-xs sm:text-sm transition ${
              preset === p.id
                ? "bg-blue-600 text-white"
                : "bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-100"
            }`}
          >
            {p.label}
          </button>
        ))}

        {/* Example custom: NOK + Native */}
        <button
          onClick={() => setCustom("NOK", "NATIVE")}
          className="px-3 py-1 rounded-md text-xs sm:text-sm bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 text-gray-900 dark:text-gray-100"
          title="Custom: NOK + Native coin"
        >
          NOK + Native
        </button>
      </div>
    </div>
  );
}