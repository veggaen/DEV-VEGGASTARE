'use client';
/** @fileOverview One explicit payment action with stable retry identity and clear errors. @stability experimental */
import { useId, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useCheckoutEditing } from './checkout-edit-context';
import { useCart } from '@/contexts/cart-context';
import { CHECKOUT_AGREEMENT_VERSION, DELIVERY_REQUESTS, DIGITAL_PURCHASE_RECORD } from '@/lib/payments/checkout-delivery-policy';
import { SALES_TERMS_DOWNLOAD, SALES_TERMS_VERSION } from '@/lib/legal/sales-terms-version';
const messages: Record<string, string> = {
  SIGN_IN_REQUIRED: 'Your session has expired. Sign in again, then return to your saved cart. No payment has been taken.',
  DELIVERY_CONSENT_REQUIRED: 'Review the delivery requests below before continuing. No payment has been taken.',
  INVALID_ORIGIN: 'Please reopen checkout from this site and try again. No payment has been taken.',
  INVALID_REQUEST: 'This checkout page may be out of date. Refresh it, review the total and delivery requests, then retry. No payment has been taken.',
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
export default function ReviewerCheckoutButton({ demo, disabled = false, expectedQuote, hasFiles = false, hasCredits = false }: { demo: boolean; disabled?: boolean; expectedQuote?: string; hasFiles?: boolean; hasCredits?: boolean }) {
  const editing = useCheckoutEditing();
  const { checkoutBlocked } = useCart();
  const key = useRef<string | null>(null);
  const consentId = useId();
  const filesInput = useRef<HTMLInputElement>(null), creditsInput = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState(false), [credits, setCredits] = useState(false);
  const [consentError, setConsentError] = useState(false);
  const [pending, setPending] = useState(false), [error, setError] = useState('');
  async function submit() {
    if (pending || editing?.busy || checkoutBlocked) return;
    if (!demo && ((hasFiles && !files) || (hasCredits && !credits))) {
      setConsentError(true);
      (hasFiles && !files ? filesInput : creditsInput).current?.focus();
      return;
    }
    setConsentError(false);
    key.current ??= crypto.randomUUID(); setPending(true); editing?.setPaymentPending(true); setError('');
    try {
      const response = await fetch(demo ? '/api/demo/checkout' : '/api/checkout', { method: 'POST',
        headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ requestKey: key.current, expectedQuote,
          ...(!demo ? { consent: { version: CHECKOUT_AGREEMENT_VERSION, files: hasFiles && files, credits: hasCredits && credits } } : {}) }) });
      const result = await response.json();
      if (!response.ok) { setError(messages[result.error] ?? 'Checkout could not finish. No new payment has been confirmed; please retry.'); return; }
      window.location.assign(result.approvalUrl ?? `/checkout/receipt/${encodeURIComponent(result.orderId)}`);
    } catch { setError('Connection interrupted. Retry safely using the same checkout.'); }
    finally { setPending(false); editing?.setPaymentPending(false); }
  }
  return <div className="space-y-3">
    <div className="text-sm leading-relaxed text-muted-foreground">
      <p>Full sales terms (Norwegian), version {SALES_TERMS_VERSION}, and an optional withdrawal form are available before you continue. Your new order confirmation keeps this version.</p>
      <div className="mt-1 flex flex-wrap gap-x-4">
        <a href="/terms" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center rounded-sm underline underline-offset-4 hover:text-foreground focus-visible:outline focus-visible:outline-2">Read full terms (new tab)</a>
        <a href={SALES_TERMS_DOWNLOAD} download className="inline-flex min-h-11 items-center rounded-sm underline underline-offset-4 hover:text-foreground focus-visible:outline focus-visible:outline-2">Save terms and withdrawal form (.txt)</a>
      </div>
    </div>
    {!demo && <fieldset className="min-w-0 space-y-3 rounded-lg border border-border p-3" disabled={pending || disabled || editing?.busy || checkoutBlocked}>
      <legend className="px-1 text-sm font-semibold">Delivery preferences</legend>
      <p className="text-sm text-muted-foreground">This checkout delivers immediately after verified payment. Review each request before continuing.</p>
      {hasFiles && <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-md py-2 text-sm leading-relaxed">
        <input ref={filesInput} type="checkbox" name="immediate-files" checked={files} onChange={event => setFiles(event.target.checked)}
          aria-invalid={consentError && !files} aria-describedby={consentError && !files ? `${consentId}-error` : undefined}
          className="mt-1 size-5 shrink-0 accent-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4" />
        <span>{DELIVERY_REQUESTS.files}</span>
      </label>}
      {hasCredits && <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-md py-2 text-sm leading-relaxed">
        <input ref={creditsInput} type="checkbox" name="immediate-ai" checked={credits} onChange={event => setCredits(event.target.checked)}
          aria-invalid={consentError && !credits} aria-describedby={consentError && !credits ? `${consentId}-error` : undefined}
          className="mt-1 size-5 shrink-0 accent-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4" />
        <span>{DELIVERY_REQUESTS.credits}</span>
      </label>}
      {consentError && ((hasFiles && !files) || (hasCredits && !credits)) && <p id={`${consentId}-error`} role="alert" className="text-sm text-destructive">Select the delivery request for each item, or return to your cart. No payment has been taken.</p>}
      <details className="text-sm text-muted-foreground">
        <summary className="min-h-11 cursor-pointer py-3 underline underline-offset-4 focus-visible:outline focus-visible:outline-2">Read the purchase and withdrawal record</summary>
        <p className="whitespace-pre-line break-words leading-relaxed">{DIGITAL_PURCHASE_RECORD}</p>
      </details>
    </fieldset>}
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <Button className="min-h-12 w-full text-base" disabled={disabled || pending || editing?.busy || checkoutBlocked} onClick={submit}>
      {pending ? 'Preparing your order…' : demo ? 'Complete free demo order' : 'Continue to PayPal'}
    </Button>
  </div>;
}
