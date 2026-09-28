"use client";

/** @fileOverview Settings › Currency: the fiat and crypto units prices are shown in. @stability evolving */

import { FiDollarSign } from "react-icons/fi";
import { CRYPTO_CURRENCIES, FIAT_CURRENCIES, useCurrency } from "@/components/uicustom/currency-selector";
import { ChoiceGrid, SectionHeader, SettingsCard, SettingsGroup } from "../settings-primitives";

export function CurrencySettings() {
  const { currency, setCurrency, cryptoCurrency, setCryptoCurrency } = useCurrency();
  const fiat = FIAT_CURRENCIES.find((c) => c.code === currency);
  const crypto = CRYPTO_CURRENCIES.find((c) => c.code === cryptoCurrency);

  return (
    <div className="space-y-6">
      <SectionHeader icon={FiDollarSign} title="Currency" description="Choose how prices are displayed across the platform." />

      <SettingsGroup title="Display currency" description="The primary unit for every price.">
        <ChoiceGrid
          ariaLabel="Display currency"
          columns={3}
          value={currency}
          onChange={(code) => setCurrency(code)}
          options={FIAT_CURRENCIES.map((c) => ({ id: c.code, label: c.code, description: c.name, icon: <span className="font-semibold">{c.symbol}</span> }))}
        />
      </SettingsGroup>

      <SettingsGroup title="Crypto unit" description="Shown next to the fiat price where a crypto quote exists.">
        <ChoiceGrid
          ariaLabel="Crypto currency"
          columns={3}
          value={cryptoCurrency}
          onChange={(code) => setCryptoCurrency(code)}
          options={CRYPTO_CURRENCIES.map((c) => ({ id: c.code, label: c.code, description: c.name, icon: <span className="font-semibold">{c.symbol}</span> }))}
        />
      </SettingsGroup>

      <SettingsGroup title="Preview">
        <SettingsCard className="flex items-center justify-between gap-4">
          <span className="text-sm text-muted-foreground">Example price</span>
          <span className="text-right">
            <span className="block text-lg font-semibold tabular-nums text-foreground">{fiat?.symbol}99.99</span>
            <span className="block text-sm tabular-nums text-muted-foreground">≈ {crypto?.symbol}0.025</span>
          </span>
        </SettingsCard>
      </SettingsGroup>
    </div>
  );
}
