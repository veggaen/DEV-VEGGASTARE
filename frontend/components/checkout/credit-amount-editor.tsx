'use client';
/** Exact-spend drafts stay intact; only a current server quote can enable purchase. */
import { useEffect, useId, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import PriceAmount from '@/components/crypto-related/PriceAmount';
import { isPurchasableCreditAmount } from '@/lib/ai-credit-purchase';
import { useCart } from '@/contexts/cart-context';
import { useUiPreferences } from '@/components/providers/ui-preferences';
import { CreditIntent } from '@/lib/payments/settlement-input';
import { formatMinor, parseSpendMinor, SettlementCurrency } from '@/lib/payments/settlement-money';
import { previewCreditIntent, SettlementClientError, settlementFailureMessage, type CreditChoice } from '@/lib/payments/settlement-client';

type Draft = { type: 'credits' | 'spend'; text: string; currency: string };
export default function CreditAmountEditor({ value, spendMinor, spendCurrency, onSave, onQuote, onDirtyChange, disabled = false }: {
  value: number; spendMinor?: number | null; spendCurrency?: string | null;
  onSave: (choice: CreditChoice) => Promise<boolean | void> | boolean | void;
  onQuote?: (choice: CreditChoice) => void; onDirtyChange?: (dirty: boolean) => void; disabled?: boolean;
}) {
  const id = useId(), { prefs } = useUiPreferences(), { setCartEditing } = useCart();
  const fiat = prefs.preferredFiatCurrency;
  const savedKey = JSON.stringify([value, spendMinor ?? null, spendCurrency ?? null]);
  const initial = (): Draft => spendMinor != null ? { type: 'spend', text: formatMinor(spendMinor), currency: spendCurrency! }
    : { type: 'credits', text: String(value), currency: fiat };
  const [draft, setDraft] = useState<Draft>(initial), [choice, setChoice] = useState<CreditChoice | null>(null);
  const [status, setStatus] = useState<'loading' | 'saving' | 'ready' | 'error'>('loading');
  const [error, setError] = useState(''), [retry, setRetry] = useState(0);
  const callbacks = useRef({ onSave, onQuote, onDirtyChange }); callbacks.current = { onSave, onQuote, onDirtyChange };
  const previous = useRef(savedKey), expected = useRef<string | null>(null), saved = useRef({ value, spendMinor, spendCurrency });
  saved.current = { value, spendMinor, spendCurrency };
  useEffect(() => {
    if (previous.current === savedKey) return;
    previous.current = savedKey;
    if (expected.current === savedKey) { expected.current = null; return; }
    setDraft(spendMinor != null ? { type: 'spend', text: formatMinor(spendMinor), currency: spendCurrency! }
      : { type: 'credits', text: String(value), currency: fiat });
    setChoice(null); setStatus('loading'); setRetry(n => n + 1);
  }, [savedKey, value, spendMinor, spendCurrency, fiat]);
  const intentKey = JSON.stringify([draft.type, draft.text, fiat, draft.currency]);
  const [confirmedKey, setConfirmedKey] = useState('');
  const busy = status !== 'ready' || confirmedKey !== intentKey;
  useEffect(() => { setCartEditing(id, busy); callbacks.current.onDirtyChange?.(busy); }, [id, busy, setCartEditing]);
  useEffect(() => () => { setCartEditing(id, false); callbacks.current.onDirtyChange?.(false); }, [id, setCartEditing]);
  useEffect(() => {
    const controller = new AbortController(); let active = true;
    setStatus('loading'); setError('');
    const timer = window.setTimeout(async () => {
      try {
        const currency = SettlementCurrency.parse(fiat);
        if (draft.type === 'spend' && draft.currency !== fiat) throw new SettlementClientError('Currency changed. Enter your new spending amount, or choose a credit preset.');
        if (draft.type === 'credits' && (!/^\d+$/.test(draft.text) || !isPurchasableCreditAmount(Number(draft.text)))) throw new SettlementClientError('Choose 10 credits, or a whole number from 100 to 10,000.');
        if (draft.type === 'spend') { try { parseSpendMinor(draft.text); } catch { throw new SettlementClientError('Enter an amount with up to two decimal places.'); } }
        const intent: CreditIntent = draft.type === 'spend' ? { type: 'spend', currency, amount: draft.text }
          : { type: 'credits', currency, credits: Number(draft.text) };
        const next = await previewCreditIntent(intent, controller.signal);
        if (!active) return;
        const line = next.quote.lines[0], snapshot = saved.current;
        const changed = intent.type === 'spend' ? snapshot.spendMinor !== next.quote.totalMinor || snapshot.spendCurrency !== fiat
          : snapshot.spendMinor != null || snapshot.value !== line.credits;
        if (changed) {
          expected.current = JSON.stringify([line.credits, intent.type === 'spend' ? next.quote.totalMinor : null, intent.type === 'spend' ? fiat : null]);
          setStatus('saving');
          if (await callbacks.current.onSave(next) === false) throw new SettlementClientError('Could not confirm your basket change. Refresh the basket before retrying.');
        }
        if (!active) return;
        setChoice(next); setConfirmedKey(intentKey); setStatus('ready'); callbacks.current.onQuote?.(next);
      } catch (failure) {
        if (!active) return;
        setStatus('error'); setError(settlementFailureMessage(failure));
      }
    }, 450);
    return () => { active = false; clearTimeout(timer); controller.abort(); };
  // Parent disabled/saved-result updates must not cancel their own in-flight save.
  }, [intentKey, retry, draft.type, draft.text, draft.currency, fiat]);
  useEffect(() => {
    if (status !== 'ready' || !choice) return;
    const timer = window.setTimeout(() => { setStatus('error'); setError('This price expired. Refresh the price before continuing.'); }, Math.max(0, Date.parse(choice.quote.expiresAt) - Date.now()));
    return () => clearTimeout(timer);
  }, [choice, status]);
  function change(type: Draft['type'], text: string) {
    setCartEditing(id, true); callbacks.current.onDirtyChange?.(true);
    setDraft({ type, text, currency: fiat }); setStatus('loading'); setError(''); setRetry(n => n + 1);
  }
  const current = confirmedKey === intentKey && status === 'ready' ? choice : null;
  const creditsText = draft.type === 'credits' ? draft.text : current ? String(current.quote.lines[0].credits) : '';
  const spendText = draft.type === 'spend' ? draft.text : current ? formatMinor(current.quote.totalMinor) : '';
  return <div className="w-full min-w-0 space-y-3" data-credit-editor>
    <div className="grid min-w-0 grid-cols-2 gap-3">
      <div className="min-w-0 space-y-2"><label htmlFor={id} className="block text-sm font-medium">Number of credits</label>
        <Input id={id} name="creditAmount" type="text" inputMode="numeric" autoComplete="off" spellCheck={false} value={creditsText}
          onChange={event => change('credits', event.target.value)} disabled={disabled || status === 'saving'} aria-invalid={Boolean(error)}
          aria-describedby={`${id}-help${error ? ` ${id}-error` : ''}`} className="h-12 min-w-0 text-base tabular-nums" /></div>
      <div className="min-w-0 space-y-2"><label htmlFor={`${id}-spend`} className="block text-sm font-medium">Spend ({fiat})</label>
        <Input id={`${id}-spend`} name="creditSpend" type="text" inputMode="decimal" autoComplete="off" spellCheck={false} value={spendText}
          onChange={event => change('spend', event.target.value)} disabled={disabled || status === 'saving'} aria-invalid={Boolean(error)}
          aria-describedby={`${id}-help${error ? ` ${id}-error` : ''}`} className="h-12 min-w-0 text-base tabular-nums" /></div>
    </div>
    <div className="flex flex-wrap gap-2" aria-label="Credit presets">{[10,100,1000,10000].map(amount => <Button key={amount} type="button"
      variant={current?.quote.lines[0].credits === amount ? 'secondary' : 'outline'} className="min-h-11 flex-1 px-2 tabular-nums"
      aria-label={amount === 10 ? 'Choose 10-credit starter pack' : `Choose ${amount.toLocaleString('en')} credits`}
      disabled={disabled || status === 'saving'} onClick={() => change('credits', String(amount))}>{amount.toLocaleString('en')}</Button>)}</div>
    <p id={`${id}-help`} className="text-xs leading-5 text-muted-foreground">10-credit starter, or 100–10,000 credits. No automatic top-ups.</p>
    <div role="status" className="min-h-6 text-sm tabular-nums">{current ? <span className="font-semibold">Total <PriceAmount amount={current.quote.totalMinor / 100} currency={fiat} displayFiat={fiat} context="settlement" /></span>
      : status !== 'error' ? <span className="text-muted-foreground">{status === 'saving' ? 'Saving amount…' : 'Confirming price…'}</span> : null}</div>
    {error && <div><p id={`${id}-error`} role="alert" className="text-sm text-destructive">{error}</p><div className="mt-2 flex flex-wrap gap-2">
      <Button variant="outline" type="button" disabled={disabled || status === 'saving'} onClick={() => setRetry(n => n + 1)}>Retry price</Button>
      <Button variant="ghost" type="button" disabled={disabled || status === 'saving'} onClick={() => { setDraft(initial()); setRetry(n => n + 1); }}>Keep saved amount</Button>
    </div></div>}
    <details className="text-xs text-muted-foreground"><summary className="min-h-11 cursor-pointer py-3 focus-visible:outline-2">How pricing works</summary>
      <p className="pb-2 leading-5">Choose credits for a quoted price, or spend an exact amount for the displayed whole-credit pack. The pack costs exactly what you enter. Volume pricing applies automatically; this is usage credit, not a cash balance.</p></details>
  </div>;
}
