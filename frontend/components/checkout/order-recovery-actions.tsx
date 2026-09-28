'use client';
/** @fileOverview Clear, confirmed unpaid-order actions with safe retry and inline feedback. @stability stable */
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import type { OrderDto } from '@/lib/types/orders';
const errors: Record<string, string> = {
  SIGN_IN_REQUIRED: 'Sign in again to manage this order.',
  ORDER_CANCELLED: 'This order is cancelled. Return to your cart to start a new purchase.',
  CHECKOUT_EXPIRED: 'This payment link expired. Return to your cart; daily purchase limits still apply.',
  ORDER_NOT_CANCELLABLE: 'Payment may be processing. Check the order before trying again.',
  ORDER_ALREADY_PAID: 'Payment is verified. Open the receipt for purchase support.',
  ORDER_CHANGED: 'The order changed. Its latest status is shown below.',
  PAYMENT_STATUS_UNCERTAIN: 'PayPal has not confirmed the status yet. Check again shortly; do not start another payment.',
  PAYMENT_NOT_COMPLETED: 'Payment is not confirmed yet. Check again shortly; do not start another payment.',
  PAYMENT_NOT_APPROVED: 'PayPal approval is still needed. Refresh, then continue payment.',
  TRY_AGAIN_LATER: 'Please wait a moment before trying again.',
};
export default function OrderRecoveryActions({ order, refresh }: { order: OrderDto; refresh: () => Promise<unknown> }) {
  const [confirming, setConfirming] = useState(false), [busy, setBusy] = useState<'resume' | 'cancel' | null>(null);
  const [message, setMessage] = useState('');
  const lock = useRef(false);
  const recovery = order.checkout?.recovery;
  async function act(action: 'resume' | 'cancel') {
    if (lock.current) return;
    lock.current = true; setBusy(action); setMessage('');
    try {
      const response = await fetch(`/api/checkout/${encodeURIComponent(order.id)}/recovery`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }), signal: AbortSignal.timeout(60_000),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(errors[result.error] ?? 'The request could not finish. Refresh the order and retry safely.');
      if (action === 'resume') {
        const next = new URL(result.nextUrl, window.location.origin);
        const localReceipt = next.origin === window.location.origin && next.pathname === `/checkout/receipt/${encodeURIComponent(order.id)}`;
        const paypal = next.protocol === 'https:' && !next.username && !next.password && !next.port &&
          next.hostname === (order.checkout?.environment === 'LIVE' ? 'www.paypal.com' : 'www.sandbox.paypal.com');
        if (!localReceipt && !paypal) throw new Error('The payment link could not be verified. Refresh and try again.');
        window.location.assign(next.href); return;
      }
      setConfirming(false); setMessage('Order cancelled. No new payment will be started.');
    } catch (error) {
      setMessage(error instanceof Error && error.name !== 'TimeoutError' ? error.message : 'The response was interrupted. Refresh to check the order before retrying.');
    } finally {
      await refresh().catch(() => undefined); lock.current = false; setBusy(null);
    }
  }
  return <div className="space-y-3">
    {confirming ? <div className="rounded-xl border border-border bg-foreground/[0.04] p-4" aria-label="Confirm order cancellation">
      <p className="text-sm font-medium">Cancel this unpaid order?</p>
      <p className="mt-1 text-sm text-muted-foreground">Your cart stays saved. Purchase limits are unchanged.</p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <Button variant="outline" className="min-h-11" disabled={!!busy} onClick={() => setConfirming(false)}>Keep order</Button>
        <Button variant="destructive" className="min-h-11" disabled={!!busy} onClick={() => void act('cancel')}>{busy === 'cancel' ? 'Checking payment…' : 'Confirm cancellation'}</Button>
      </div>
    </div> : <div className="flex flex-col gap-2 sm:flex-row">
      {recovery?.canResume && <Button className="min-h-11" disabled={!!busy} onClick={() => void act('resume')}>{busy === 'resume' ? 'Checking payment…' : order.checkout?.state === 'CAPTURE_PENDING' ? 'Check payment' : 'Continue payment'}</Button>}
      {recovery?.canCancel && <Button variant="outline" className="min-h-11" disabled={!!busy} onClick={() => { setMessage(''); setConfirming(true); }}>{order.checkout?.state === 'CANCEL_PENDING' ? 'Retry cancellation' : 'Cancel unpaid order'}</Button>}
    </div>}
    {message && <p role="status" className="text-sm text-muted-foreground">{message}</p>}
  </div>;
}
