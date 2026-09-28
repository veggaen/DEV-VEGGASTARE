'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { FiChevronLeft, FiChevronRight, FiRefreshCw, FiX } from 'react-icons/fi';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { isDemoUserId } from '@/lib/demo-policy';
import { AUDIT_ACTIONS, AUDIT_TARGETS, auditLabel, type AuditDetail, type AuditPage } from '@/lib/audit-log-view';

const controlClass = 'h-11 w-full min-w-0 rounded-md border border-border bg-input px-3 text-base text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
const labelClass = 'mb-1.5 block text-sm font-medium';
const formatDate = (value: string) => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
const safeReadErrors = new Set(['Wait a moment before retrying.', 'These filters are invalid. Clear filters and try again.', 'The audit log could not be loaded. Try again.', 'This entry is no longer available.', 'Details could not be loaded. Try again.']);
const readError = (error: unknown) => error instanceof Error && safeReadErrors.has(error.message) ? error.message : 'Connection lost. Check your connection and retry.';

export default function AuditLogPage() {
  const { data: session, status } = useSession();
  const router = useRouter(), actor = session?.user;
  const allowed = !!actor?.id && actor.role === 'OWNER' && !actor.isDemo && !actor.isImpersonating && !isDemoUserId(actor.id);
  useEffect(() => { if (status !== 'loading' && !allowed) router.replace('/'); }, [status, allowed, router]);
  if (status === 'loading' || !allowed) return <p role="status" className="p-6 text-sm text-muted-foreground">Checking access…</p>;
  return <AuditAccess key={actor.id} />;
}

function AuditAccess() {
  const [denied, setDenied] = useState(false);
  const onDenied = useCallback(() => { navigate({ entry: '' }, true); setDenied(true); }, []);
  // Unmount both list and details on denied access. Later failures cannot
  // resurrect an earlier owner's data, even if requests finish out of order.
  return denied ? <section aria-label="Audit access" className="mx-auto max-w-7xl space-y-4 px-4 py-6 sm:px-6 lg:px-8">
    <h1 className="text-2xl font-semibold">Audit log</h1>
    <p role="alert">Owner access is no longer available. Sign in again or retry.</p>
    <div className="flex flex-wrap gap-2"><Button variant="outline" className="h-11" onClick={() => setDenied(false)}>Retry access</Button>
      <Button asChild className="h-11"><Link href="/auth/login?callbackUrl=%2Fadmin%2Faudit-log">Sign in</Link></Button></div>
  </section> : <AuditList onDenied={onDenied} />;
}

function navigate(changes: Record<string, string>, replace = false) {
  const next = new URLSearchParams(window.location.search);
  for (const [key, value] of Object.entries(changes)) {
    if (!value || value === 'all') next.delete(key); else next.set(key, value);
  }
  const url = '/admin/audit-log' + (next.size ? '?' + next.toString() : '');
  if (replace) window.history.replaceState(null, '', url); else window.history.pushState(null, '', url);
}

function AuditList({ onDenied }: { onDenied: () => void }) {
  const params = useSearchParams();
  const action = AUDIT_ACTIONS.find(value => value === params.get('action')) ?? 'all';
  const target = AUDIT_TARGETS.find(value => value === params.get('targetType')) ?? 'all';
  const pageNumber = Number(params.get('page') ?? 1);
  const page = Number.isInteger(pageNumber) && pageNumber > 0 && pageNumber <= 1000 ? pageNumber : 1;
  const entry = params.get('entry');
  const query = new URLSearchParams({ page: String(page), limit: '20' });
  if (action !== 'all') query.set('action', action);
  if (target !== 'all') query.set('targetType', target);
  // Preserve supported deep-link filters, including existing admin/target/date links.
  for (const key of ['adminId', 'targetId', 'startDate', 'endDate']) {
    const value = params.get(key); if (value) query.set(key, value);
  }
  const queryKey = query.toString();
  const [refresh, setRefresh] = useState(0);
  const [result, setResult] = useState<{ key: string; data?: AuditPage; error?: string }>({ key: '' });
  const [pending, setPending] = useState(true);
  const data = result.key === queryKey ? result.data : undefined;
  const error = result.key === queryKey ? result.error : undefined;
  const busy = pending || result.key !== queryKey;
  const detailTrigger = useRef<HTMLButtonElement | null>(null);
  useEffect(() => {
    let active = true, timedOut = false;
    const controller = new AbortController();
    const timeout = setTimeout(() => { timedOut = true; controller.abort(); }, 15_000);
    setPending(true);
    async function load() {
      try {
        const response = await fetch('/api/admin/audit-log?' + queryKey, { cache: 'no-store', signal: controller.signal });
        if (!active) return;
        if (response.status === 401 || response.status === 403) { onDenied(); return; }
        if (!response.ok) throw new Error(response.status === 429 ? 'Wait a moment before retrying.' : response.status === 400 ? 'These filters are invalid. Clear filters and try again.' : 'The audit log could not be loaded. Try again.');
        const body: AuditPage = await response.json();
        if (!Array.isArray(body.logs) || !body.pagination || !Number.isInteger(body.pagination.total)) throw new Error('The audit log could not be loaded. Try again.');
        if (active) setResult({ key: queryKey, data: body });
      } catch (failure) {
        if (active) setResult(previous => ({ key: queryKey, data: previous.key === queryKey ? previous.data : undefined,
          error: timedOut ? 'The request took too long. Try again.' : readError(failure) }));
      } finally { clearTimeout(timeout); if (active) setPending(false); }
    }
    void load();
    return () => { active = false; clearTimeout(timeout); controller.abort(); };
  }, [queryKey, refresh, onDenied]);
  const clearFilters = () => navigate({ action: '', targetType: '', page: '', adminId: '', targetId: '', startDate: '', endDate: '', entry: '' });
  const pages = Math.min(data?.pagination.totalPages ?? 0, 1000);
  return <section aria-labelledby="audit-title" className="mx-auto w-full min-w-0 max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
    <header className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <div><h1 id="audit-title" className="text-2xl font-semibold tracking-tight">Audit log</h1><p className="mt-1 text-sm text-muted-foreground">Recorded administrative activity.</p></div>
      <Button variant="outline" className="h-11 gap-2" disabled={busy} onClick={() => setRefresh(value => value + 1)}><FiRefreshCw aria-hidden="true" />Refresh</Button>
    </header>
    <div className="mb-4 grid min-w-0 grid-cols-1 items-end gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] lg:max-w-3xl">
      <div><label htmlFor="audit-action" className={labelClass}>Action</label><select id="audit-action" name="action" className={controlClass} value={action} onChange={event => navigate({ action: event.target.value, page: '', entry: '' })}>
        <option value="all">All actions</option>{AUDIT_ACTIONS.map(value => <option key={value} value={value}>{auditLabel(value)}</option>)}
      </select></div>
      <div><label htmlFor="audit-target" className={labelClass}>Record type</label><select id="audit-target" name="targetType" className={controlClass} value={target} onChange={event => navigate({ targetType: event.target.value, page: '', entry: '' })}>
        <option value="all">All types</option>{AUDIT_TARGETS.map(value => <option key={value} value={value}>{auditLabel(value)}</option>)}
      </select></div>
      <Button variant="ghost" className="h-11" onClick={clearFilters}>Clear filters</Button>
    </div>
    {['adminId', 'targetId', 'startDate', 'endDate'].some(key => params.has(key)) && <p className="mb-3 break-words text-sm text-muted-foreground [overflow-wrap:anywhere]">Additional link filters: {['adminId', 'targetId', 'startDate', 'endDate'].filter(key => params.has(key)).map(key => key + ': ' + params.get(key)).join(' · ')}</p>}
    <p role="status" className="mb-3 min-h-5 text-sm text-muted-foreground tabular-nums">{busy ? data ? 'Refreshing…' : 'Loading audit log…' : error ? 'Refresh unavailable' : `${data?.pagination.total.toLocaleString() ?? 0} matching entries`}</p>
    {error && <div className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-border bg-card p-4"><p role="alert" className="min-w-0 flex-1 text-sm">{error}{data && ' Showing the last loaded entries.'}</p><Button variant="outline" className="h-11" disabled={busy} onClick={() => setRefresh(value => value + 1)}>Retry</Button></div>}
    <div aria-label="Audit entries" aria-busy={busy} className="min-w-0 overflow-hidden rounded-xl border border-border bg-card">
      {!data && busy ? <div aria-hidden="true" className="divide-y divide-border">{Array.from({ length: 5 }, (_, index) => <div key={index} className="min-h-32 space-y-3 p-4 sm:min-h-24"><Skeleton className="h-5 w-52 max-w-full" /><Skeleton className="h-4 w-96 max-w-full" /></div>)}</div>
        : data?.logs.length ? <ul className="divide-y divide-border">{data.logs.map(log => <li key={log.id} className="grid min-w-0 grid-cols-1 items-start gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_auto]">
          <div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><Badge variant="secondary">{auditLabel(log.action)}</Badge><span className="text-sm text-muted-foreground">{auditLabel(log.targetType)}</span><time dateTime={log.createdAt} className="text-xs text-muted-foreground tabular-nums">{formatDate(log.createdAt)}</time></div>
            <p className="mt-2 break-words font-medium [overflow-wrap:anywhere]">{log.admin.name || log.admin.email || 'Former administrator'}</p>
            <p className="mt-1 break-words text-xs text-muted-foreground [overflow-wrap:anywhere]">Record <span translate="no">{log.targetId}</span></p>
            {log.reason && <p className="mt-2 line-clamp-2 break-words text-sm text-muted-foreground [overflow-wrap:anywhere]">{log.reason}</p>}
          </div>
          <Button variant="outline" className="h-11 justify-self-start" onClick={event => { detailTrigger.current = event.currentTarget; navigate({ entry: log.id }); }}>Details<span className="sr-only"> {log.id}</span></Button>
        </li>)}</ul> : !error && !busy ? <div className="space-y-2 p-8 text-center"><h2 className="font-medium">No matching entries</h2><Button variant="link" className="h-11" onClick={clearFilters}>Clear filters</Button>{page > 1 && <Button variant="outline" className="h-11" onClick={() => navigate({ page: '1' })}>First page</Button>}</div> : null}
      {data && pages > 1 && <nav aria-label="Audit pages" className="flex flex-wrap items-center justify-between gap-3 border-t border-border p-4"><span className="text-sm tabular-nums">Page {page} of {pages}</span><div className="flex gap-2">
        <Button variant="outline" className="h-11 gap-1" disabled={busy || page <= 1} onClick={() => navigate({ page: String(page - 1), entry: '' })}><FiChevronLeft aria-hidden="true" />Previous</Button>
        <Button variant="outline" className="h-11 gap-1" disabled={busy || page >= pages} onClick={() => navigate({ page: String(page + 1), entry: '' })}>Next<FiChevronRight aria-hidden="true" /></Button>
      </div></nav>}
    </div>
    <Dialog open={!!entry} onOpenChange={open => { if (!open) navigate({ entry: '' }, true); }}>
      <DialogContent hideCloseButton onCloseAutoFocus={event => { if (detailTrigger.current?.isConnected) { event.preventDefault(); detailTrigger.current.focus(); } }} className="flex max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-4xl flex-col gap-0 overflow-hidden rounded-xl p-0 data-[state=open]:animate-none data-[state=closed]:animate-none">
        <header className="flex shrink-0 items-center justify-between gap-3 border-b border-border p-4"><div><DialogTitle>Audit entry</DialogTitle><DialogDescription className="mt-1">Read-only record. Sensitive fields are hidden.</DialogDescription></div><DialogClose asChild><Button variant="ghost" className="h-11 w-11 shrink-0 p-0" aria-label="Close audit entry"><FiX aria-hidden="true" /></Button></DialogClose></header>
        {entry && <EntryDetail key={entry} id={entry} onDenied={onDenied} />}
      </DialogContent>
    </Dialog>
  </section>;
}

function EntryDetail({ id, onDenied }: { id: string; onDenied: () => void }) {
  const [refresh, setRefresh] = useState(0), [data, setData] = useState<AuditDetail>();
  const [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    const controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 15_000);
    setData(undefined); setError('');
    async function load() {
      try {
        const response = await fetch('/api/admin/audit-log?entry=' + encodeURIComponent(id), { signal: controller.signal, cache: 'no-store' });
        if (!active) return;
        if (response.status === 401 || response.status === 403) { onDenied(); return; }
        if (!response.ok) throw new Error(response.status === 404 ? 'This entry is no longer available.' : 'Details could not be loaded. Try again.');
        const body = await response.json();
        if (body.entry?.id !== id || !body.entry?.admin) throw new Error('Details could not be loaded. Try again.');
        if (active) setData(body.entry);
      } catch (failure) { if (active) setError(controller.signal.aborted ? 'The request took too long. Try again.' : readError(failure)); }
      finally { clearTimeout(timeout); }
    }
    void load();
    return () => { active = false; clearTimeout(timeout); controller.abort(); };
  }, [id, refresh, onDenied]);
  return <div className="min-h-0 overflow-y-auto overscroll-contain p-4 sm:p-6">
    {error ? <div className="space-y-4"><p role="alert">{error}</p><Button variant="outline" className="h-11" onClick={() => setRefresh(value => value + 1)}>Retry details</Button></div> : !data ? <p role="status">Loading details…</p> : <div className="min-w-0 space-y-5">
      <div className="flex flex-wrap items-center gap-2"><Badge variant="secondary">{auditLabel(data.action)}</Badge><span className="text-sm">{auditLabel(data.targetType)}</span><time className="text-sm text-muted-foreground" dateTime={data.createdAt}>{formatDate(data.createdAt)}</time></div>
      <dl className="grid min-w-0 grid-cols-1 gap-4 text-sm sm:grid-cols-2">{[
        ['Administrator', data.admin.name || data.admin.email || 'Former administrator'], ['Record ID', data.targetId], ['Entry ID', data.id], ['Administrator ID', data.adminId],
      ].map(([label, value]) => <div key={label} className="min-w-0"><dt className="text-muted-foreground">{label}</dt><dd className="mt-1 break-words [overflow-wrap:anywhere]">{value}</dd></div>)}</dl>
      {data.reason && <div><h2 className="text-sm font-medium">Reason</h2><p className="mt-1 whitespace-pre-wrap break-words text-sm [overflow-wrap:anywhere]">{data.reason}</p></div>}
      <div className="grid min-w-0 grid-cols-1 gap-4 md:grid-cols-2">{[['Before', data.previousData], ['After', data.newData]].map(([label, value]) => <section key={String(label)} className="min-w-0"><h2 className="mb-2 text-sm font-medium">{String(label)}</h2><pre className="whitespace-pre-wrap break-words rounded-lg border border-border bg-muted p-3 text-xs [overflow-wrap:anywhere]">{value == null ? 'Not recorded' : JSON.stringify(value, null, 2)}</pre></section>)}</div>
      {(data.ipAddress || data.userAgent) && <details className="rounded-lg border border-border"><summary className="min-h-11 cursor-pointer p-3 text-sm font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">Request metadata</summary><dl className="space-y-3 p-3 pt-0 text-xs">{[['IP address', data.ipAddress], ['User agent', data.userAgent]].map(([label, value]) => value && <div key={label}><dt className="text-muted-foreground">{label}</dt><dd className="mt-1 break-words [overflow-wrap:anywhere]">{value}</dd></div>)}</dl></details>}
    </div>}
  </div>;
}
