'use client';
/** @fileOverview One explicit payment action with stable retry identity and clear errors. @stability experimental */
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
const messages: Record<string, string> = {
  PAYPAL_NOT_CONFIGURED: 'PayPal is not configured yet. No payment has been taken.',
  DAILY_PURCHASE_LIMIT: 'You have reached the daily limit of two checkout attempts. Please return tomorrow.',
  TRY_AGAIN_LATER: 'Too many attempts. Please wait a few minutes and try again.',
  DOWNLOADS_NOT_READY: 'The download is temporarily unavailable. No payment has been taken.',
  CHECKOUT_EXPIRED: 'This checkout has expired. Return to your cart to start again.',
  ONE_OF_EACH_REVIEWER_ITEM_PER_ORDER: 'Please keep one of each reviewer item in your cart.',
};
export default function ReviewerCheckoutButton({ demo, disabled = false }: { demo: boolean; disabled?: boolean }) {
  const key = useRef<string | null>(null);
  const [pending, setPending] = useState(false), [error, setError] = useState('');
  async function submit() {
    if (pending) return;
    key.current ??= crypto.randomUUID(); setPending(true); setError('');
    try {
      const response = await fetch(demo ? '/api/demo/checkout' : '/api/checkout', { method: 'POST',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requestKey: key.current }) });
      const result = await response.json();
      if (!response.ok) { setError(messages[result.error] ?? 'Checkout could not finish. No new payment has been confirmed; please retry.'); return; }
      window.location.assign(result.approvalUrl ?? `/checkout/receipt/${encodeURIComponent(result.orderId)}`);
    } catch { setError('Connection interrupted. Retry safely using the same checkout.'); }
    finally { setPending(false); }
  }
  return <div className="space-y-3">
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <Button className="min-h-12 w-full text-base" disabled={disabled || pending} onClick={submit}>
      {pending ? 'Preparing your order…' : demo ? 'Complete free demo order' : 'Continue to PayPal'}
    </Button>
  </div>;
}
