'use client';
/** @fileOverview One explicit payment action with stable retry identity and clear errors. @stability experimental */
import { useId, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { ArrowUpRight, LockKeyhole } from 'lucide-react';
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
  ONE_OF_EACH_REVIEWER_ITEM_PER_ORDER: 'Keep one of each product in your cart. Change the credit amount directly.',
};
export default function ReviewerCheckoutButton({ demo, disabled = false, expectedQuote, hasFiles = false, hasCredits = false, order, summary }: { demo: boolean; disabled?: boolean; expectedQuote?: string; hasFiles?: boolean; hasCredits?: boolean; order: ReactNode; summary: ReactNode }) {
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
  return <div className="mt-6 grid min-w-0 items-start gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(20rem,1fr)] lg:gap-8">
    <div className="min-w-0 space-y-6">
      {order}
      {!demo && <section aria-label="Delivery preferences" className="min-w-0 rounded-2xl border border-border bg-card p-5 sm:p-6">
      <fieldset className="min-w-0 space-y-2" disabled={pending || disabled || editing?.busy || checkoutBlocked}>
      <legend className="mb-3 text-lg font-semibold">Immediate delivery</legend>
      {hasFiles && <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border border-border bg-background/50 p-4 text-sm leading-relaxed">
        <input ref={filesInput} type="checkbox" name="immediate-files" checked={files} onChange={event => setFiles(event.target.checked)}
          aria-invalid={consentError && !files} aria-describedby={consentError && !files ? `${consentId}-error` : undefined}
          className="mt-1 size-5 shrink-0 accent-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4" />
        <span>{DELIVERY_REQUESTS.files}</span>
      </label>}
      {hasCredits && <label className="flex min-h-11 cursor-pointer items-start gap-3 rounded-lg border border-border bg-background/50 p-4 text-sm leading-relaxed">
        <input ref={creditsInput} type="checkbox" name="immediate-ai" checked={credits} onChange={event => setCredits(event.target.checked)}
          aria-invalid={consentError && !credits} aria-describedby={consentError && !credits ? `${consentId}-error` : undefined}
          className="mt-1 size-5 shrink-0 accent-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4" />
        <span>{DELIVERY_REQUESTS.credits}</span>
      </label>}
      {consentError && ((hasFiles && !files) || (hasCredits && !credits)) && <p id={`${consentId}-error`} role="alert" className="text-sm text-destructive">Select the delivery request for each item, or return to your cart. No payment has been taken.</p>}
      </fieldset>
      </section>}
      <details className="rounded-xl border border-border px-5 text-sm text-muted-foreground sm:px-6">
        <summary className="min-h-12 cursor-pointer py-4 font-medium text-foreground focus-visible:outline focus-visible:outline-2">Terms, delivery & refunds</summary>
        <div className="space-y-3 pb-5 leading-relaxed">
          <div className="flex flex-wrap gap-x-4">
            <a href="/terms" target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center gap-1 rounded-sm underline underline-offset-4 hover:text-foreground focus-visible:outline focus-visible:outline-2">Read full terms (new tab)<ArrowUpRight aria-hidden="true" className="size-4" /></a>
            <a href={SALES_TERMS_DOWNLOAD} download className="inline-flex min-h-11 items-center rounded-sm underline underline-offset-4 hover:text-foreground focus-visible:outline focus-visible:outline-2">Save terms and withdrawal form (.txt)</a>
          </div>
          <p>Norwegian sales terms · Version {SALES_TERMS_VERSION}. A copy is kept with your order.</p>
          <details><summary className="min-h-11 cursor-pointer py-3 underline underline-offset-4 focus-visible:outline focus-visible:outline-2">Read the purchase and withdrawal record</summary>
            <p className="whitespace-pre-line break-words">{DIGITAL_PURCHASE_RECORD}</p>
          </details>
        </div>
      </details>
    </div>
    <aside aria-label="Payment summary" className="min-w-0 rounded-2xl border border-border bg-card p-5 sm:p-6 lg:sticky lg:top-6">
      {summary}
      {error && <p role="alert" className="mb-4 text-sm text-destructive">{error}</p>}
      <Button className="min-h-12 w-full gap-2 text-base" disabled={disabled || pending || editing?.busy || checkoutBlocked} onClick={submit}>
      {pending ? 'Preparing your order…' : demo ? 'Complete free demo order' : 'Continue to PayPal'}
      {!pending && <ArrowUpRight aria-hidden="true" className="size-4" />}
      </Button>
      <p className="mt-3 flex items-center justify-center gap-2 text-xs text-muted-foreground"><LockKeyhole aria-hidden="true" className="size-3.5" />{demo ? 'No card required' : 'Payment details stay with PayPal'}</p>
      <nav aria-label="Checkout help" className="mt-3 flex flex-wrap justify-center gap-x-5 text-xs text-muted-foreground">
        <Link href="/terms" target="_blank" className="inline-flex min-h-11 items-center underline underline-offset-4 hover:text-foreground">Terms</Link>
        <Link href="/privacy" target="_blank" className="inline-flex min-h-11 items-center underline underline-offset-4 hover:text-foreground">Privacy</Link>
      </nav>
    </aside>
  </div>;
}
