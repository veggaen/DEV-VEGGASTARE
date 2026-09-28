/** @fileOverview Accessible seller review with retained failure drafts and no refund mutation. @stability experimental */
'use client';

import { useCallback, useEffect, useId, useRef, useState, type FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import PriceAmount from '@/components/crypto-related/PriceAmount';
import { RETURN_REASONS } from '@/lib/payments/return-request';
import { REVIEW_STATUSES, ReviewQuery, ReviewResult, SellerRequestList, type SellerRequestRecord } from '@/lib/payments/return-review';

const inputClass = 'min-h-12 w-full rounded-lg border border-border bg-background px-3 text-base focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2';
const formatTime = (value: string) => new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'UTC' }).format(new Date(value));
type InboxData = { requests: SellerRequestRecord[]; page: number; hasMore: boolean; readOnly: boolean };

async function readInbox(query: string, signal?: AbortSignal) {
  const response = await fetch(`/api/seller/returns?${query}`, { cache: 'no-store', signal });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(response.status === 401 ? 'Your session expired. Sign in again to review requests.' : 'Could not load purchase requests. Try again.');
  const parsed = SellerRequestList.safeParse(body);
  if (!parsed.success) throw new Error('We could not verify the inbox response. Try again; no decision has been saved.');
  return parsed.data;
}

export function RequestInboxSkeleton() {
  return <div aria-busy="true" aria-label="Loading purchase requests" className="w-full space-y-5">
    <p role="status" className="text-sm text-muted-foreground">Loading purchase requests…</p>
    {[1, 2].map(value => <div key={value} aria-hidden="true" className="min-h-96 rounded-xl border border-border p-4 sm:p-6 lg:min-h-80">
      <div className="h-6 w-3/5 rounded bg-muted motion-safe:animate-pulse" /><div className="mt-3 h-4 w-2/5 rounded bg-muted" />
      <div className="mt-5 h-12 rounded bg-muted" /><div className="mt-5 grid gap-5 lg:grid-cols-2"><div className="h-24 rounded bg-muted" /><div className="h-24 rounded bg-muted" /></div>
    </div>)}
  </div>;
}

function RequestCard({ initial, readOnly, onDirty }: { initial: SellerRequestRecord; readOnly: boolean; onDirty: (id: string, dirty: boolean) => void }) {
  const id = useId(), heading = useRef<HTMLHeadingElement>(null), noteField = useRef<HTMLTextAreaElement>(null), feedback = useRef<HTMLParagraphElement>(null);
  const [record, setRecord] = useState(initial), [editing, setEditing] = useState(false);
  const [note, setNote] = useState(initial.sellerNote ?? ''), [decision, setDecision] = useState<'APPROVE' | 'REJECT'>('APPROVE');
  const [error, setError] = useState(''), [notice, setNotice] = useState(''), [busy, setBusy] = useState(false), [stale, setStale] = useState(false);
  const submitting = useRef(false), dirty = editing && note !== (record.sellerNote ?? '');
  useEffect(() => { onDirty(record.id, dirty || busy); return () => onDirty(record.id, false); }, [record.id, dirty, busy, onDirty]);
  useEffect(() => {
    if (!dirty) return;
    const prevent = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', prevent); return () => window.removeEventListener('beforeunload', prevent);
  }, [dirty]);

  async function refreshRequest() {
    if (submitting.current) return;
    submitting.current = true; setBusy(true); setError('');
    try {
      const current = await readInbox(new URLSearchParams({ id: record.id, status: 'ALL', page: '1' }).toString());
      const latest = current.requests.find(item => item.id === record.id);
      if (current.readOnly || !latest) throw new Error('This request is no longer available to review. Your draft is kept; contact support if needed.');
      setRecord(latest); setStale(false);
      setNotice('Latest review loaded. Your draft is kept. Check the details before saving.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Refresh failed. Your draft is kept.'); }
    finally { submitting.current = false; setBusy(false); }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting.current || stale || readOnly || record.status !== 'PENDING') return;
    if (!note.trim()) { setError('Explain your decision to the buyer.'); noteField.current?.focus(); return; }
    submitting.current = true; setBusy(true); setError(''); setNotice('');
    try {
      const response = await fetch(`/api/returns/${encodeURIComponent(record.id)}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: decision, sellerNote: note.trim(), expectedUpdatedAt: record.updatedAt }) });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        if (response.status === 409) setStale(true);
        throw new Error(response.status === 409 ? 'This request changed. Refresh the request before saving. Your draft is kept.' : 'Your review could not be saved. Your draft is kept; try again.');
      }
      const confirmed = ReviewResult.safeParse(body);
      if (!confirmed.success || confirmed.data.id !== record.id || confirmed.data.orderId !== record.orderId ||
          confirmed.data.status !== (decision === 'APPROVE' ? 'APPROVED' : 'REJECTED') || confirmed.data.sellerNote !== note.trim()) {
        setStale(true);
        throw new Error('We could not confirm your decision. Your draft is kept. Refresh the request before trying again.');
      }
      setRecord(previous => ({ ...previous, ...confirmed.data })); setNote(confirmed.data.sellerNote ?? ''); setEditing(false);
      setNotice('Review saved. The buyer can see your response on their receipt. No payment, credit balance or download access changed.');
      requestAnimationFrame(() => feedback.current?.focus());
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Your review could not be saved. Your draft is kept.'); }
    finally { submitting.current = false; setBusy(false); }
  }

  return <li className="min-w-0 rounded-xl border border-border bg-card p-4 sm:p-6">
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div className="min-w-0"><h2 className="text-lg font-semibold">{RETURN_REASONS[record.reason]}</h2>
        <p className="mt-1 text-sm text-muted-foreground"><time dateTime={record.createdAt}>{formatTime(record.createdAt)} UTC</time></p></div>
      <span className="rounded-full border border-border px-3 py-1 text-xs font-medium">{REVIEW_STATUSES[record.status]}</span>
    </div>
    <p className="mt-3 break-all text-xs text-muted-foreground">Request <span className="font-mono">{record.id}</span> · Order <span className="font-mono">{record.orderId}</span></p>
    <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-relaxed [overflow-wrap:anywhere]">{record.description || 'No additional buyer message.'}</p>
    <div className="mt-5 grid min-w-0 gap-5 border-t border-border pt-5 lg:grid-cols-2">
      <div className="min-w-0"><h3 className="text-sm font-semibold">Order and verified payment state</h3>
        <p className="mt-2 text-sm"><PriceAmount amount={record.order.total} currency={record.order.currency} /> · {record.order.environment === 'DEMO' ? 'Free demo — no payment' : record.order.environment === 'SANDBOX' ? 'Sandbox — test money' : record.order.environment === 'LIVE' ? 'Live' : 'Legacy order'}</p>
        <p className="mt-1 text-xs text-muted-foreground">Order: {record.order.status} · Checkout: {record.order.paymentState ?? 'No verified checkout record'}</p>
        {record.order.captureId && <p className="mt-2 break-all text-xs">Capture reference: {record.order.captureId}</p>}
        {record.order.refundReference && <p className="mt-2 break-all text-xs">Refund reference: {record.order.refundReference}</p>}
        <ul className="mt-3 space-y-1 text-sm">{record.order.items.map((item, index) => <li key={index} className="break-words [overflow-wrap:anywhere]">{item.title} × {item.quantity}</li>)}</ul>
        {record.order.itemCount > record.order.items.length && <p className="mt-1 text-xs text-muted-foreground">Showing {record.order.items.length} of {record.order.itemCount} order lines.</p>}
      </div>
      <div className="min-w-0"><h3 className="text-sm font-semibold">Delivery evidence, not an eligibility decision</h3>
        <p className="mt-2 text-sm">Recorded file requests: <span className="tabular-nums">{record.order.downloadRequests}</span></p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Counters do not prove a complete download or that a file was read. Downloads alone do not reject a request; mandatory rights remain reviewable.</p>
        {record.order.agreement ? <details className="mt-3 rounded-lg border border-border p-3">
          <summary className="min-h-11 cursor-pointer text-sm focus-visible:outline focus-visible:outline-2">Retained delivery request · {record.order.agreement.version}</summary>
          <p className="mt-2 text-xs text-muted-foreground">Recorded {formatTime(record.order.agreement.recordedAt)} UTC{record.order.agreement.demo ? ' · Demo: no paid consent.' : ''}</p>
          {record.order.agreement.requests.map((request, index) => <p key={index} className="mt-2 text-xs leading-relaxed [overflow-wrap:anywhere]">{request}</p>)}
          <p className="mt-2 text-xs text-muted-foreground">This record alone is not proof that all legal withdrawal conditions were met.</p>
        </details> : <p className="mt-3 text-xs text-muted-foreground">No retained delivery-consent record is available. Do not infer consent.</p>}
      </div>
    </div>
    {record.sellerNote && <div className="mt-4 rounded-lg bg-muted p-3 text-sm"><h3 className="font-medium">Response visible to the buyer</h3><p className="mt-1 whitespace-pre-wrap break-words [overflow-wrap:anywhere]">{record.sellerNote}</p></div>}
    {notice && <p ref={feedback} role="status" tabIndex={-1} className="mt-4 rounded-lg border border-border p-3 text-sm outline-offset-4">{notice}</p>}
    {!readOnly && !editing && record.status === 'PENDING' && <Button className="mt-5 min-h-12" onClick={() => { setEditing(true); setNotice(''); requestAnimationFrame(() => heading.current?.focus()); }}>Review request</Button>}
    {editing && <form onSubmit={submit} aria-labelledby={`${id}-review`} className="mt-5 space-y-4 border-t border-border pt-5">
      <h3 id={`${id}-review`} ref={heading} tabIndex={-1} className="font-semibold outline-offset-4">Review this request</h3>
      <p className="text-sm text-muted-foreground">This saves a buyer-visible decision only. An approval does not issue a refund or revoke access. Complete any agreed refund separately through the payment provider; Veggat updates access after verification.</p>
      <div><label htmlFor={`${id}-decision`} className="mb-2 block text-sm font-medium">Decision</label><select id={`${id}-decision`} name="decision" className={inputClass} value={decision} disabled={busy || record.status !== 'PENDING'} onChange={event => setDecision(event.target.value as typeof decision)}>
        <option value="APPROVE">Approve for follow-up</option><option value="REJECT">Decline request</option>
      </select></div>
      <div><label htmlFor={`${id}-note`} className="mb-2 block text-sm font-medium">Response to buyer</label>
        <textarea ref={noteField} id={`${id}-note`} name="sellerNote" autoComplete="off" value={note} disabled={busy} onChange={event => { setNote(event.target.value); if (error === 'Explain your decision to the buyer.' && event.target.value.trim()) setError(''); }} maxLength={2000} rows={4} aria-invalid={error === 'Explain your decision to the buyer.'} aria-describedby={`${id}-hint${error ? ` ${id}-error` : ''}`} className={`${inputClass} resize-y py-3`} />
        <p id={`${id}-hint`} className="mt-1 text-xs text-muted-foreground">Required, up to 2,000 characters. Do not include payment credentials or private account data.</p></div>
      {error && <p id={`${id}-error`} role="alert" className="text-sm text-destructive [overflow-wrap:anywhere]">{error}</p>}
      {record.status !== 'PENDING' && <p className="text-sm text-muted-foreground">This request is already reviewed. Your draft is kept for reference; no further decision can be submitted here.</p>}
      <div className="flex flex-wrap gap-3">
        <Button type="submit" className="min-h-12" disabled={busy || stale || readOnly || record.status !== 'PENDING'}>{busy ? 'Saving…' : 'Confirm review decision'}</Button>
        {stale && <Button type="button" variant="outline" className="min-h-12" disabled={busy} onClick={refreshRequest}>Refresh request — keep draft</Button>}
        <Button type="button" variant="outline" className="min-h-12" disabled={busy} onClick={() => { setEditing(false); setNote(record.sellerNote ?? ''); setError(''); setStale(false); }}>Discard draft and close</Button>
      </div>
    </form>}
  </li>;
}

export default function SellerRequestInbox() {
  const router = useRouter(), search = useSearchParams();
  const parsed = ReviewQuery.safeParse({ status: search.get('status') ?? 'PENDING', page: search.get('page') ?? '1' });
  const status = parsed.success ? parsed.data.status : 'PENDING', page = parsed.success ? parsed.data.page : 1;
  const [state, setState] = useState<{ key: string; view: string; data: InboxData | null; error: string } | null>(null), [refresh, setRefresh] = useState(0);
  const view = `${status}:${page}`, key = `${view}:${refresh}`;
  const data = state?.view === view ? state.data : null, error = state?.key === key ? state.error : '', loading = state?.key !== key;
  const [dirtyIds, setDirtyIds] = useState<Set<string>>(new Set());
  const onDirty = useCallback((id: string, dirty: boolean) => setDirtyIds(previous => {
    if (previous.has(id) === dirty) return previous;
    const next = new Set(previous); if (dirty) next.add(id); else next.delete(id); return next;
  }), []);
  useEffect(() => {
    const abort = new AbortController();
    readInbox(new URLSearchParams({ status, page: String(page) }).toString(), abort.signal)
      .then(result => { if (!abort.signal.aborted) setState({ key, view, data: result, error: '' }); })
      .catch(cause => { if (!abort.signal.aborted) setState(previous => ({ key, view, data: previous?.view === view ? previous.data : null,
        error: cause instanceof Error ? cause.message : 'Could not load purchase requests.' })); });
    return () => abort.abort();
  }, [status, page, key, view]);
  const changeView = (nextStatus: string, nextPage: number) => {
    if (dirtyIds.size) return;
    router.push(`/my-sales/requests?${new URLSearchParams({ status: nextStatus, page: String(nextPage) })}`, { scroll: false });
  };
  return <div className="mx-auto w-full max-w-6xl min-w-0 space-y-6 p-4 pb-10 sm:p-6 lg:p-8">
    <header className="space-y-3"><Link href="/my-sales" className="inline-flex min-h-11 items-center text-sm underline underline-offset-4">Back to sales</Link>
      <h1 className="text-balance text-2xl font-semibold sm:text-3xl">Purchase requests</h1>
      <p className="max-w-3xl text-sm leading-relaxed text-muted-foreground">Review withdrawal notices and purchase problems. Only requests for orders you can fully manage appear here. A review decision never transfers money.</p>
    </header>
    <div className="flex flex-wrap items-end justify-between gap-4"><div className="w-full sm:w-72"><label htmlFor="request-filter" className="mb-2 block text-sm font-medium">Review status</label>
      <select id="request-filter" name="status" value={status} disabled={loading || dirtyIds.size > 0} onChange={event => changeView(event.target.value, 1)} className={inputClass}>
        <option value="ALL">All requests</option>{Object.entries(REVIEW_STATUSES).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
      </select></div><Button variant="outline" className="min-h-12" disabled={loading || dirtyIds.size > 0} onClick={() => setRefresh(value => value + 1)}>Refresh inbox</Button></div>
    {dirtyIds.size > 0 && <p className="text-xs text-muted-foreground">Save or discard your draft before changing filters or pages.</p>}
    {error && <div role="alert" className="rounded-xl border border-destructive/40 bg-card p-4 text-sm"><p>{error}</p><Button variant="outline" className="mt-3 min-h-12" disabled={loading || dirtyIds.size > 0} onClick={() => setRefresh(value => value + 1)}>Try again</Button></div>}
    {loading && !data ? <RequestInboxSkeleton /> : data && <>
      {loading && <p role="status" className="text-sm text-muted-foreground">Refreshing purchase requests…</p>}
      {data.readOnly && <p className="rounded-xl border border-border bg-muted p-4 text-sm">Read-only demo: real buyer requests and seller decisions are private. Explore your own purchase-request flow from a demo receipt.</p>}
      {!data.requests.length && !error && <div className="rounded-xl border border-border p-8 text-center"><h2 className="font-semibold">No requests in this view</h2><p className="mt-2 text-sm text-muted-foreground">New buyer notices will appear here when you can manage every line of the order.</p></div>}
      {data.requests.length > 0 && <ul aria-label="Seller purchase requests" className="space-y-5">{data.requests.map(record => <RequestCard key={`${record.id}:${record.updatedAt}`} initial={record} readOnly={data.readOnly} onDirty={onDirty} />)}</ul>}
      <nav aria-label="Request pages" className="flex flex-wrap items-center justify-between gap-3"><Button variant="outline" className="min-h-12" disabled={loading || page <= 1 || dirtyIds.size > 0} onClick={() => changeView(status, page - 1)}>Previous page</Button>
        <span className="text-sm tabular-nums">Page {page}</span><Button variant="outline" className="min-h-12" disabled={loading || !data.hasMore || dirtyIds.size > 0} onClick={() => changeView(status, page + 1)}>Next page</Button></nav>
    </>}
  </div>;
}
