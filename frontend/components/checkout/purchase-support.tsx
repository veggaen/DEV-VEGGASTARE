/** @fileOverview Accessible buyer notices without pretending a request returns money. @stability experimental */
'use client';

import { useId, useRef, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { BuyerRequestSchema, RETURN_REASONS, type BuyerRequest } from '@/lib/payments/return-request';
import { emailStatusText } from '@/lib/payments/email-policy';

const actionClass = 'inline-flex min-h-12 items-center justify-center rounded-lg border border-border px-4 text-sm font-medium hover:bg-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 disabled:cursor-not-allowed disabled:opacity-50';
const requestStatuses: Record<string, string> = { PENDING: 'Awaiting review', APPROVED: 'Approved for review — payment not confirmed',
  REJECTED: 'Request declined — contact us to discuss', CANCELLED: 'Request closed', REFUNDED: 'Review marked refunded — check verified payment status above' };

export default function PurchaseSupport({ orderId, canRequest, demo, initialRequests }: {
  orderId: string; canRequest: boolean; demo: boolean; initialRequests: BuyerRequest[];
}) {
  const router = useRouter(), id = useId();
  const [submitted, setSubmitted] = useState<BuyerRequest | null>(null);
  const requests = submitted && !initialRequests.some(request => request.id === submitted.id)
    ? [submitted, ...initialRequests] : initialRequests;
  const [mode, setMode] = useState<'withdraw' | 'problem' | null>(null);
  const [reason, setReason] = useState<BuyerRequest['reason']>('DEFECTIVE');
  const [description, setDescription] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('');
  const submitting = useRef(false), title = useRef<HTMLHeadingElement>(null), status = useRef<HTMLParagraphElement>(null);
  const active = (value: string) => requests.some(request => request.reason === value && ['PENDING', 'APPROVED'].includes(request.status));
  const contact = `mailto:kontakt@veggat.com?subject=${encodeURIComponent(`Purchase help — ${orderId}`)}`;
  function open(value: 'withdraw' | 'problem') {
    setMode(value); setError(''); setNotice('');
    requestAnimationFrame(() => title.current?.focus());
  }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current) return;
    submitting.current = true; setBusy(true); setError('');
    try {
      const response = await fetch('/api/returns', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId, reason: mode === 'withdraw' ? 'CHANGED_MIND' : reason, description }) });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error || 'Your request could not be saved. Your message is kept below; try again or contact us.');
      const confirmed = BuyerRequestSchema.safeParse(result);
      if (!confirmed.success || confirmed.data.orderId !== orderId || confirmed.data.reason !== (mode === 'withdraw' ? 'CHANGED_MIND' : reason)) {
        throw new Error('We could not confirm receipt of your request. Your message is kept below; retry or check your order before sending another notice.');
      }
      setSubmitted(confirmed.data);
      setMode(null); setDescription('');
      setNotice('Your request was received. Save the acknowledgment below. No refund has been issued by this action.');
      router.refresh();
      requestAnimationFrame(() => status.current?.focus());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Your request could not be saved. Your message is kept below.');
    } finally { submitting.current = false; setBusy(false); }
  }
  return <section aria-labelledby={`${id}-heading`} className="mt-8 min-w-0 rounded-xl border border-border bg-card p-5 sm:p-6">
    <h2 id={`${id}-heading`} className="text-xl font-semibold">Help, withdrawal and refunds</h2>
    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">A saved file cannot be recalled. A download alone does not automatically reject a request. Defects and payment disputes remain reviewable.</p>
    {demo && <p className="mt-2 text-sm text-muted-foreground">This is a free demo order. You can try the request flow; there is no payment to refund.</p>}
    {notice && <p ref={status} tabIndex={-1} role="status" className="mt-4 rounded-lg border border-border p-3 text-sm outline-offset-4">{notice}</p>}
    {requests.length > 0 && <ul aria-label="Your purchase requests" className="mt-4 space-y-4">{requests.map(request => <li key={request.id} className="min-w-0 rounded-lg border border-border p-4">
      <h3 className="font-medium">{RETURN_REASONS[request.reason]}</h3>
      <p className="mt-1 text-sm text-muted-foreground">{requestStatuses[request.status] ?? 'Check request status with support'}</p>
      <p className="mt-2 text-sm">Received <time dateTime={request.createdAt}>{new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }).format(new Date(request.createdAt))} UTC</time></p>
      <p className="mt-1 break-all font-mono text-xs text-muted-foreground">{request.id}</p>
      {request.description && <p className="mt-3 whitespace-pre-wrap break-words text-sm [overflow-wrap:anywhere]">{request.description}</p>}
      {request.sellerNote && <p className="mt-3 whitespace-pre-wrap break-words text-sm [overflow-wrap:anywhere]">Seller response: {request.sellerNote}</p>}
      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{demo ? 'Demo acknowledgment — download only; no email sent.' : emailStatusText(request.emailStatus)}</p>
      <a className={`${actionClass} mt-3`} href={`/api/returns/${encodeURIComponent(request.id)}/acknowledgment`} download>Save acknowledgment (.txt)</a>
    </li>)}</ul>}
    {!mode && <div className="mt-4 flex flex-wrap gap-3">
      {canRequest && !active('CHANGED_MIND') && <button type="button" className={actionClass} onClick={() => open('withdraw')}>Withdraw from this purchase</button>}
      {canRequest && <button type="button" className={actionClass} onClick={() => open('problem')}>Report a purchase problem</button>}
      <a href={contact} className="inline-flex min-h-12 items-center text-sm underline underline-offset-4">Contact support</a>
    </div>}
    {mode && <form onSubmit={submit} aria-labelledby={`${id}-form`} className="mt-5 space-y-4">
      <h3 ref={title} id={`${id}-form`} tabIndex={-1} className="font-semibold outline-offset-4">{mode === 'withdraw' ? 'Confirm your withdrawal notice' : 'Tell us what went wrong'}</h3>
      <p className="text-sm leading-relaxed text-muted-foreground">{mode === 'withdraw' ? 'This sends the notice “I withdraw from this purchase” for this entire order. You do not need to give a reason. We record the time received; eligibility and any refund are reviewed separately.' : 'This records a request for this order, not an automatic refund. Do not include passwords, card numbers or other payment credentials.'}</p>
      {mode === 'problem' && <div><label htmlFor={`${id}-reason`} className="mb-2 block text-sm font-medium">Problem</label>
        <select id={`${id}-reason`} value={reason} disabled={busy} onChange={event => setReason(event.target.value as BuyerRequest['reason'])} className="min-h-12 w-full rounded-lg border border-border bg-background px-3 text-base">
          {Object.entries(RETURN_REASONS).filter(([key]) => key !== 'CHANGED_MIND').map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </select></div>}
      <div><label htmlFor={`${id}-description`} className="mb-2 block text-sm font-medium">Message (optional)</label>
        <textarea id={`${id}-description`} value={description} onChange={event => setDescription(event.target.value)} disabled={busy} maxLength={2000} rows={4}
          aria-describedby={`${id}-hint`} className="w-full resize-y rounded-lg border border-border bg-background p-3 text-base" />
        <p id={`${id}-hint`} className="mt-1 text-xs text-muted-foreground">Up to 2,000 characters. Your message is kept if sending fails.</p></div>
      {error && <p role="alert" className="break-words text-sm text-destructive">{error}</p>}
      <div className="flex flex-wrap gap-3"><button type="submit" disabled={busy} className={`${actionClass} bg-primary text-primary-foreground hover:bg-primary/90`}>
        {busy ? 'Sending request…' : mode === 'withdraw' ? 'Confirm withdrawal request' : 'Send purchase request'}</button>
        <button type="button" disabled={busy} onClick={() => { setMode(null); setError(''); }} className={actionClass}>Cancel</button></div>
    </form>}
    <p className="mt-4 text-xs leading-relaxed text-muted-foreground">Keep the downloadable acknowledgment even if an email copy is delayed. If this form is unavailable, you can send an unambiguous notice to <a href={contact} className="underline underline-offset-4">kontakt@veggat.com</a>. Quote your order reference.</p>
  </section>;
}
