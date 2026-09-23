'use client';
/** @fileOverview One explicit payment action with stable retry identity and clear errors. @stability experimental */
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useCheckoutEditing } from './checkout-edit-context';
import { useCart } from '@/contexts/cart-context';
const messages: Record<string, string> = {
  SIGN_IN_REQUIRED: 'Your session has expired. Sign in again, then return to your saved cart. No payment has been taken.',
  INVALID_ORIGIN: 'Please reopen checkout from this site and try again. No payment has been taken.',
  ITEM_UNAVAILABLE: 'An item is no longer available. Return to your cart to review it. No payment has been taken.',
  CHECKOUT_TEMPORARILY_UNAVAILABLE: 'Checkout is temporarily unavailable. Your cart is saved. Retry safely; an existing payment will not be charged twice.',
  PAYPAL_NOT_CONFIGURED: 'PayPal is not configured yet. No payment has been taken.',
  DAILY_PURCHASE_LIMIT: 'Veggat’s safety limit of two new checkout attempts per day has been reached. This is not a PayPal account or API limit. Existing orders remain available in My orders; new attempts are available tomorrow (UTC).',
  DAILY_PURCHASE_AMOUNT_LIMIT: 'This order exceeds Veggat’s daily purchase safety cap. Reduce the credit amount or return tomorrow (UTC). This is not a PayPal account limit.',
  CREDIT_SALES_PAUSED: 'Credit purchases are temporarily paused while model costs are reviewed. No payment has been taken. Please try again later.',
  CART_CHANGED: 'Your cart changed in another tab. Refresh this page and review the new total before paying. No payment has been taken.',
  TRY_AGAIN_LATER: 'Too many attempts. Please wait a few minutes and try again.',
  DOWNLOADS_NOT_READY: 'The download is temporarily unavailable. No payment has been taken.',
  CHECKOUT_EXPIRED: 'This checkout has expired. Return to your cart to start again.',
  ONE_OF_EACH_REVIEWER_ITEM_PER_ORDER: 'Please keep one of each reviewer item in your cart.',
};
export default function ReviewerCheckoutButton({ demo, disabled = false, expectedQuote }: { demo: boolean; disabled?: boolean; expectedQuote?: string }) {
  const editing = useCheckoutEditing();
  const { checkoutBlocked } = useCart();
  const key = useRef<string | null>(null);
  const [pending, setPending] = useState(false), [error, setError] = useState('');
  async function submit() {
    if (pending || editing?.busy || checkoutBlocked) return;
    key.current ??= crypto.randomUUID(); setPending(true); editing?.setPaymentPending(true); setError('');
    try {
      const response = await fetch(demo ? '/api/demo/checkout' : '/api/checkout', { method: 'POST',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requestKey: key.current, expectedQuote }) });
      const result = await response.json();
      if (!response.ok) { setError(messages[result.error] ?? 'Checkout could not finish. No new payment has been confirmed; please retry.'); return; }
      window.location.assign(result.approvalUrl ?? `/checkout/receipt/${encodeURIComponent(result.orderId)}`);
    } catch { setError('Connection interrupted. Retry safely using the same checkout.'); }
    finally { setPending(false); editing?.setPaymentPending(false); }
  }
  return <div className="space-y-3">
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <Button className="min-h-12 w-full text-base" disabled={disabled || pending || editing?.busy || checkoutBlocked} onClick={submit}>
      {pending ? 'Preparing your order…' : demo ? 'Complete free demo order' : 'Continue to PayPal'}
    </Button>
  </div>;
}
