'use client';
/** @fileOverview Linked credit and display-budget inputs with explicit, server-repriced saving. @stability active */
import { useEffect, useId, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import PriceAmount from '@/components/crypto-related/PriceAmount';
import { MAX_PURCHASE_CREDITS, isPurchasableCreditAmount, quoteCreditPurchase } from '@/lib/ai-credit-purchase';
import { quoteCreditBudget } from '@/lib/credit-budget';
import { useCart } from '@/contexts/cart-context';
import { useCurrencyRates } from '@/hooks/useCurrencyRates';
import { useUiPreferences } from '@/components/providers/ui-preferences';
import { priceDisplay } from '@/lib/price-display';

export default function CreditAmountEditor({ value, onSave, onDirtyChange, disabled = false }: {
  value: number; onSave: (credits: number) => Promise<boolean | void> | boolean | void;
  onDirtyChange?: (dirty: boolean) => void; disabled?: boolean;
}) {
  const id = useId(), input = useRef<HTMLInputElement>(null), callback = useRef(onDirtyChange);
  const { setCartEditing } = useCart();
  const { prefs } = useUiPreferences();
  const rates = useCurrencyRates();
  const fiat = prefs.preferredFiatCurrency;
  const [draft, setDraft] = useState(String(value)), [error, setError] = useState(''), [saving, setSaving] = useState(false);
  const [budget, setBudget] = useState<{ text: string; fiat: string } | null>(null);
  const [ready, setReady] = useState(false);
  callback.current = onDirtyChange;
  useEffect(() => { setReady(true); }, []);
  useEffect(() => { setDraft(String(value)); setBudget(null); setError(''); }, [value]);
  useEffect(() => { setBudget(null); setError(''); }, [fiat]);
  const dirty = draft !== String(value) || budget !== null;
  useEffect(() => { setCartEditing?.(id, dirty || saving); }, [id, dirty, saving, setCartEditing]);
  useEffect(() => () => { setCartEditing?.(id, false); }, [id, setCartEditing]);
  useEffect(() => { callback.current?.(dirty); }, [dirty]);
  useEffect(() => () => { callback.current?.(false); }, []);
  const number = /^\d+$/.test(draft) ? Number(draft) : NaN;
  const valid = isPurchasableCreditAmount(number);
  const quote = valid ? quoteCreditPurchase(number) : null;
  const display = quote ? priceDisplay({ amount: quote.amountOre / 100, currency: 'NOK', fiat,
    crypto: 'NONE', fiatRates: rates.fiatRates, cryptoPrices: {}, loading: rates.isLoading && !rates.lastUpdated }) : null;
  const budgetAvailable = fiat === 'NOK' || (!rates.isFiatStale && Number.isFinite(rates.fiatRates.NOK) && (fiat === 'USD' || Number.isFinite(rates.fiatRates[fiat])));
  const budgetValue = budget?.fiat === fiat ? budget.text : Number.isFinite(display?.fiatAmount) ? display!.fiatAmount.toFixed(2) : '';
  function choose(credits: string) { setDraft(credits); setBudget(null); setError(''); }
  function changeBudget(text: string) {
    setBudget({ text, fiat }); setError('');
    const next = quoteCreditBudget(text, fiat, rates.fiatRates, rates.isFiatStale);
    setDraft(next ? String(next.credits) : '');
  }
  async function save() {
    if (disabled || saving || !dirty) return;
    if (!valid) { setError('Choose 10 credits, or a whole number from 100 to 10,000.'); input.current?.focus(); return; }
    setSaving(true); setError('');
    try {
      if (await onSave(number) === false) throw new Error();
      setBudget(null);
    } catch { setError('Could not save. Retry or cancel your change.'); }
    finally { setSaving(false); }
  }
  return <div className="w-full min-w-0 space-y-3" data-credit-editor>
    <div className="grid min-w-0 grid-cols-2 gap-3">
      <div className="min-w-0 space-y-2">
        <label htmlFor={id} className="block text-sm font-medium">Number of credits</label>
        <Input ref={input} id={id} name="creditAmount" type="text" inputMode="numeric" autoComplete="off" spellCheck={false}
          value={draft} onChange={event => choose(event.target.value)}
          onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); void save(); } }}
          disabled={!ready || disabled || saving} aria-invalid={Boolean(error)} aria-describedby={`${id}-help${error ? ` ${id}-error` : ''}`}
          className="h-12 min-w-0 text-base tabular-nums" />
      </div>
      <div className="min-w-0 space-y-2">
        <label htmlFor={`${id}-budget`} className="block text-sm font-medium">Spend up to ({fiat})</label>
        <Input id={`${id}-budget`} name="creditBudget" type="text" inputMode="decimal" autoComplete="off" spellCheck={false}
          value={budgetValue} onChange={event => changeBudget(event.target.value)}
          onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); void save(); } }}
          disabled={!ready || disabled || saving || !budgetAvailable} aria-describedby={`${id}-help`}
          className="h-12 min-w-0 text-base tabular-nums" />
      </div>
    </div>
    <div className="flex flex-wrap gap-2" aria-label="Credit presets">
      {[10, 100, 1000, MAX_PURCHASE_CREDITS].map(amount => <Button key={amount} type="button" variant={number === amount ? 'secondary' : 'outline'}
        className="min-h-11 flex-1 px-2 tabular-nums" aria-label={amount === 10 ? 'Choose 10-credit starter pack' : `Choose ${amount.toLocaleString('en')} credits`}
        aria-pressed={number === amount} disabled={!ready || disabled || saving}
        onClick={() => { choose(String(amount)); }}>{amount.toLocaleString('en')}</Button>)}
    </div>
    <p id={`${id}-help`} className="text-xs leading-5 text-muted-foreground">{budget ? 'Whole credits within your budget; only the total below is charged.' : '10-credit starter, or 100–10,000 credits. No auto top-ups.'}
      {!budgetAvailable && ' Currency rates unavailable; enter credits instead.'}</p>
    <div role="status" className="flex flex-wrap items-baseline justify-between gap-2 text-sm tabular-nums">
      {quote && <><span className="font-semibold"><PriceAmount amount={quote.amountOre / 100} currency="NOK" /></span>
        {quote.discountOre > 0 && <span className="text-xs text-muted-foreground">Save <PriceAmount amount={quote.discountOre / 100} currency="NOK" displayCrypto="NONE" /></span>}</>}
    </div>
    <div className="flex flex-wrap gap-2">
      <Button type="button" variant="outline" className="min-h-11" disabled={disabled || saving || !dirty} onClick={() => void save()}>{saving ? 'Saving…' : 'Update credits'}</Button>
      {dirty && <Button type="button" variant="ghost" className="min-h-11" disabled={disabled || saving} onClick={() => choose(String(value))}>Cancel</Button>}
    </div>
    {error && <p id={`${id}-error`} role="alert" className="text-sm text-destructive">{error}</p>}
    <details className="text-xs text-muted-foreground">
      <summary className="min-h-11 cursor-pointer py-3 focus-visible:outline-2">How pricing works</summary>
      <p className="pb-2 leading-5">First 100 at base price; credits 101–500 receive 5% off; credits 501–10,000 receive 10% off. Discounts apply within each band. Your spending amount selects whole credits, not a cash balance. PayPal settles in NOK; other currencies use reference-rate estimates.</p>
    </details>
  </div>;
}
