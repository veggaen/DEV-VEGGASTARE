'use client';
/** @fileOverview Shared edit lock while checkout rows change and the server quote refreshes. @stability active */
import { createContext, useContext, useRef, useState, useTransition, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useCart } from '@/contexts/cart-context';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import CreditAmountEditor from './credit-amount-editor';

const Context = createContext<{ busy: boolean; editingBlocked: boolean; error: string; remove: (id: string) => Promise<void>;
  credits: (id: string, amount: number) => Promise<boolean>; setDirty: (dirty: boolean) => void; setPaymentPending: (pending: boolean) => void } | null>(null);
export function CheckoutEditProvider({ children }: { children: ReactNode }) {
  const { removeItem, updateCredits } = useCart();
  const router = useRouter();
  const locked = useRef(false);
  const [editing, setEditing] = useState(false), [error, setError] = useState('');
  const [paymentPending, setPaymentPending] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [refreshing, startTransition] = useTransition();
  async function remove(id: string) {
    if (locked.current || refreshing || paymentPending) return;
    locked.current = true; setEditing(true); setError('');
    try {
      if (!await removeItem(id)) { setError('We could not confirm the removal. Review your saved cart before paying.'); return; }
      startTransition(() => router.refresh());
    } finally { locked.current = false; setEditing(false); }
  }
  async function credits(id: string, amount: number) {
    if (locked.current || refreshing || paymentPending) return false;
    locked.current = true; setEditing(true); setError('');
    try {
      if (!await updateCredits(id, amount)) { setError('We could not confirm the credit amount. Review your saved cart before paying.'); return false; }
      startTransition(() => router.refresh());
      return true;
    } finally { locked.current = false; setEditing(false); }
  }
  const editingBlocked = editing || refreshing || paymentPending || Boolean(error);
  return <Context.Provider value={{ busy: editingBlocked || dirty, editingBlocked, error, remove, credits, setDirty, setPaymentPending }}>{children}</Context.Provider>;
}
export function useCheckoutEditing() { return useContext(Context); }
export function CheckoutCreditAmount({ itemId, value }: { itemId: string; value: number }) {
  const edit = useCheckoutEditing();
  return <div className="mt-4"><CreditAmountEditor value={value} disabled={!edit || edit.editingBlocked}
    onSave={amount => edit?.credits(itemId, amount) ?? false} onDirtyChange={edit?.setDirty} /></div>;
}
export function RemoveCheckoutItem({ itemId, title }: { itemId: string; title: string }) {
  const edit = useCheckoutEditing();
  return <div className="mt-2">
    <Button type="button" variant="ghost" className="min-h-11 px-3" disabled={!edit || edit.busy} onClick={() => void edit?.remove(itemId)} aria-label={`Remove ${title} from order`}>Remove</Button>
    {edit?.error && <p role="alert" className="text-sm text-destructive">{edit.error} <Link href="/cart" className="underline">Review cart</Link></p>}
  </div>;
}
