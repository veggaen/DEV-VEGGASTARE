'use client';
/** @fileOverview Shared edit lock while checkout rows change and the server quote refreshes. @stability active */
import { createContext, useContext, useRef, useState, useTransition, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useCart } from '@/contexts/cart-context';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

const Context = createContext<{ busy: boolean; error: string; remove: (id: string) => Promise<void>; setPaymentPending: (pending: boolean) => void } | null>(null);
export function CheckoutEditProvider({ children }: { children: ReactNode }) {
  const { removeItem } = useCart();
  const router = useRouter();
  const locked = useRef(false);
  const [editing, setEditing] = useState(false), [error, setError] = useState('');
  const [paymentPending, setPaymentPending] = useState(false);
  const [refreshing, startTransition] = useTransition();
  async function remove(id: string) {
    if (locked.current || refreshing || paymentPending) return;
    locked.current = true; setEditing(true); setError('');
    try {
      if (!await removeItem(id)) { setError('We could not confirm the removal. Review your saved cart before paying.'); return; }
      startTransition(() => router.refresh());
    } finally { locked.current = false; setEditing(false); }
  }
  return <Context.Provider value={{ busy: editing || refreshing || paymentPending || Boolean(error), error, remove, setPaymentPending }}>{children}</Context.Provider>;
}
export function useCheckoutEditing() { return useContext(Context); }
export function RemoveCheckoutItem({ itemId, title }: { itemId: string; title: string }) {
  const edit = useCheckoutEditing();
  return <div className="mt-2">
    <Button type="button" variant="ghost" className="min-h-11 px-3" disabled={!edit || edit.busy} onClick={() => void edit?.remove(itemId)} aria-label={`Remove ${title} from order`}>Remove</Button>
    {edit?.error && <p role="alert" className="text-sm text-destructive">{edit.error} <Link href="/cart" className="underline">Review cart</Link></p>}
  </div>;
}
