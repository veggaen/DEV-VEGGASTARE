'use client';
/** @fileOverview Selected-fiat controls retain a canonical USD budget across currency changes. @stability stable */
import { useState } from 'react';
import { useUiPreferences } from '@/components/providers/ui-preferences';
import { useCurrencyRates } from '@/hooks/useCurrencyRates';
import { fiatRate } from '@/lib/catalog-price-filter';
import { PriceSlider } from '@/components/ui/price-slider';
import PriceAmount from '@/components/crypto-related/PriceAmount';
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

function ExactRange({ min, max, currency, variant, apply }: { min: number | null; max: number | null; currency: string; variant: string; apply: (min: number | null, max: number | null) => void }) {
  const [draftMin, setDraftMin] = useState(min == null ? '' : String(rounded(min)));
  const [draftMax, setDraftMax] = useState(max == null ? '' : String(rounded(max)));
  const [error, setError] = useState('');
  return <form className="mt-2 space-y-3" onSubmit={event => {
    event.preventDefault();
    const low = draftMin === '' ? null : Number(draftMin), high = draftMax === '' ? null : Number(draftMax);
    if ([low, high].some(value => value != null && (!Number.isFinite(value) || value < 0)) || (low != null && high != null && high < low)) {
      setError('Enter a maximum at least as high as the minimum.'); return;
    }
    setError(''); apply(low, high);
  }}>
    <div className="grid grid-cols-2 gap-3">
      {([{ name: 'Minimum', value: draftMin, set: setDraftMin }, { name: 'Maximum', value: draftMax, set: setDraftMax }] as const).map(field => <div key={field.name} className="min-w-0">
        <label htmlFor={`catalog-${field.name}-${variant}`} className="mb-1 block text-sm">{field.name} price ({currency})</label>
        <input id={`catalog-${field.name}-${variant}`} name={field.name.toLowerCase()} type="number" inputMode="decimal" min={0} max={1_000_000_000} step="0.01" autoComplete="off" placeholder={field.name === 'Minimum' ? '0…' : 'Any…'} value={field.value} onChange={event => field.set(event.target.value)} aria-invalid={Boolean(error)} aria-describedby={error ? `catalog-price-error-${variant}` : undefined} className="h-11 w-full rounded-lg border border-border bg-background px-3 text-base tabular-nums focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
      </div>)}
    </div>
    {error && <p id={`catalog-price-error-${variant}`} role="alert" className="text-sm text-destructive">{error}</p>}
    <Button type="submit" variant="outline" className="min-h-11 w-full">Apply price range</Button>
  </form>;
}

export default function CatalogPriceFilter({ minUsd, maxUsd, rangeMaxUsd, setMinUsd, setMaxUsd, variant }: Props) {
  const { prefs } = useUiPreferences();
  const rates = useCurrencyRates();
  const fiat = prefs.preferredFiatCurrency;
  const rate = fiatRate(fiat, rates.fiatRates);
  if (!rate || (rates.isLoading && !rates.lastUpdated && fiat !== 'USD')) return <div className="space-y-3"><p role="status" className="text-sm text-muted-foreground">{rates.isLoading ? `Loading ${fiat} price controls…` : `${fiat} price controls are unavailable until conversion rates return.`}</p>{!rates.isLoading && <Button variant="outline" className="min-h-11" onClick={() => void rates.refreshRates()}>Retry conversion rates</Button>}</div>;
  const min = minUsd == null ? null : rounded(minUsd / rate);
  const max = maxUsd == null ? null : rounded(maxUsd / rate);
  const ceiling = Math.max(1, Math.ceil(rangeMaxUsd / rate), min ?? 0, max ?? 0);
  const format = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: fiat, currencyDisplay: 'code', maximumFractionDigits: 2 }).format(value);
  return <div className="space-y-3">
    <p className="text-xs leading-5 text-muted-foreground">Filter in {fiat}. Switching currency keeps the same budget. Exchange-rate estimates may change.</p>
    <PriceSlider minValue={min} maxValue={max} rangeMin={0} rangeMax={ceiling} step={0.01} onMinChange={value => setMinUsd(value == null ? null : value * rate)} onMaxChange={value => setMaxUsd(value == null ? null : value * rate)} formatValue={format} />
    <div aria-label="Selected price range" className="flex flex-wrap justify-between gap-2 text-sm">
      <PriceAmount usd={minUsd ?? 0} /><span aria-hidden>–</span><PriceAmount usd={maxUsd ?? ceiling * rate} />
    </div>
    <details className="group">
      <summary className="min-h-11 cursor-pointer py-3 text-sm text-muted-foreground focus-visible:outline focus-visible:outline-2">Enter exact values</summary>
      <ExactRange key={`${fiat}:${minUsd}:${maxUsd}`} min={min} max={max} currency={fiat} variant={variant} apply={(low, high) => { setMinUsd(low == null ? null : low * rate); setMaxUsd(high == null ? null : high * rate); }} />
    </details>
  </div>;
}
