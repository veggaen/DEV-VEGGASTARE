'use client';
/** @fileOverview Accessible whole-credit entry with explicit saving and no silent rounding. @stability experimental */
import { useEffect, useId, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import PriceAmount from '@/components/crypto-related/PriceAmount';
import { MIN_PURCHASE_CREDITS, MAX_PURCHASE_CREDITS, quoteCreditPurchase } from '@/lib/ai-credit-purchase';
import { useCart } from '@/contexts/cart-context';

export default function CreditAmountEditor({ value, onSave, onDirtyChange, disabled = false }: {
  value: number; onSave: (credits: number) => Promise<boolean | void> | boolean | void;
  onDirtyChange?: (dirty: boolean) => void; disabled?: boolean;
}) {
  const id = useId(), input = useRef<HTMLInputElement>(null), callback = useRef(onDirtyChange);
  const { setCartEditing } = useCart();
  const [draft, setDraft] = useState(String(value)), [error, setError] = useState(''), [saving, setSaving] = useState(false);
  callback.current = onDirtyChange;
  useEffect(() => { setDraft(String(value)); setError(''); }, [value]);
  const dirty = draft !== String(value);
  useEffect(() => { setCartEditing?.(id, dirty || saving); }, [id, dirty, saving, setCartEditing]);
  useEffect(() => () => { setCartEditing?.(id, false); }, [id, setCartEditing]);
  useEffect(() => { callback.current?.(dirty); }, [dirty]);
  useEffect(() => () => { callback.current?.(false); }, []);
  const number = /^\d+$/.test(draft) ? Number(draft) : NaN;
  const valid = Number.isSafeInteger(number) && number >= MIN_PURCHASE_CREDITS && number <= MAX_PURCHASE_CREDITS;
  const quote = valid ? quoteCreditPurchase(number) : null;
  async function save() {
    if (disabled || saving || !dirty) return;
    if (!valid) { setError('Enter a whole number from 100 to 1,000.'); input.current?.focus(); return; }
    setSaving(true); setError('');
    try {
      if (await onSave(number) === false) throw new Error();
    } catch { setError('Could not confirm your change. Check your saved cart before paying.'); }
    finally { setSaving(false); }
  }
  return <div className="w-full min-w-0 space-y-2" data-credit-editor>
    <label htmlFor={id} className="block text-sm font-medium">Number of credits</label>
    <div className="flex flex-wrap items-center gap-2">
      <Input ref={input} id={id} name="creditAmount" type="text" inputMode="numeric" autoComplete="off" spellCheck={false}
        value={draft} onChange={event => { setDraft(event.target.value); setError(''); }}
        onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); void save(); } }}
        disabled={disabled || saving} aria-invalid={Boolean(error)} aria-describedby={`${id}-help ${error ? `${id}-error` : ''}`}
        className="h-11 w-28 text-base tabular-nums" />
      <Button type="button" variant="outline" className="min-h-11" disabled={disabled || saving || !dirty} onClick={() => void save()}>{saving ? 'Saving…' : 'Update credits'}</Button>
      {dirty && <Button type="button" variant="ghost" className="min-h-11" disabled={disabled || saving} onClick={() => { setDraft(String(value)); setError(''); }}>Cancel</Button>}
    </div>
    <p id={`${id}-help`} className="text-xs leading-5 text-muted-foreground">100–1,000 credits. First 100 at standard price; next 400 receive 5% off; additional credits receive 10% off.</p>
    <div role="status" className="text-sm tabular-nums">
      {quote && <>{dirty ? 'New total: ' : `${value} credits · `}<PriceAmount amount={quote.amountOre / 100} currency="NOK" />
        {quote.discountOre > 0 && <span className="ml-2 text-muted-foreground">Save <PriceAmount amount={quote.discountOre / 100} currency="NOK" /></span>}</>}
      {dirty && <p className="mt-1 text-xs text-muted-foreground">Update or cancel this change before continuing.</p>}
    </div>
    {error && <p id={`${id}-error`} role="alert" className="text-sm text-destructive">{error}</p>}
  </div>;
}
