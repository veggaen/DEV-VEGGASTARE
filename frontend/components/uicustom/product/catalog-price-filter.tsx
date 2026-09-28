'use client';
/**
 * @fileOverview Selected-fiat price controls that keep a canonical USD budget across
 *               currency changes. The From/To fields ARE the exact-value inputs and the
 *               slider is the coarse one; nothing is repeated below them.
 * @stability stable
 */
import { useUiPreferences } from '@/components/providers/ui-preferences';
import { useCurrencyRates } from '@/hooks/useCurrencyRates';
import { fiatRate } from '@/lib/catalog-price-filter';
import { PriceSlider } from '@/components/ui/price-slider';
import { Button } from '@/components/ui/button';

interface Props {
  minUsd: number | null;
  maxUsd: number | null;
  rangeMaxUsd: number;
  setMinUsd: (value: number | null) => void;
  setMaxUsd: (value: number | null) => void;
  variant: string;
}

const rounded = (value: number) => Number(value.toFixed(2));

export default function CatalogPriceFilter({ minUsd, maxUsd, rangeMaxUsd, setMinUsd, setMaxUsd }: Props) {
  const { prefs } = useUiPreferences();
  const rates = useCurrencyRates();
  const fiat = prefs.preferredFiatCurrency;
  const rate = fiatRate(fiat, rates.fiatRates);
  if (!rate || (rates.isLoading && !rates.lastUpdated && fiat !== 'USD')) return <div className="space-y-3"><p role="status" className="text-sm text-muted-foreground">{rates.isLoading ? `Loading ${fiat} price controls…` : `${fiat} price controls are unavailable until conversion rates return.`}</p>{!rates.isLoading && <Button variant="outline" className="min-h-11" onClick={() => void rates.refreshRates()}>Retry conversion rates</Button>}</div>;
  const min = minUsd == null ? null : rounded(minUsd / rate);
  const max = maxUsd == null ? null : rounded(maxUsd / rate);
  const ceiling = Math.max(1, Math.ceil(rangeMaxUsd / rate), min ?? 0, max ?? 0);
  const format = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: fiat, currencyDisplay: 'code', maximumFractionDigits: 2 }).format(value);
  // The "prices in {fiat}" context lives on the group header as an info-icon tooltip.
  return <PriceSlider minValue={min} maxValue={max} rangeMin={0} rangeMax={ceiling} step={0.01} onMinChange={value => setMinUsd(value == null ? null : value * rate)} onMaxChange={value => setMaxUsd(value == null ? null : value * rate)} formatValue={format} />;
}
