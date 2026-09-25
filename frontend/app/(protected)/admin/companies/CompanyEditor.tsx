'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Skeleton } from '@/components/ui/skeleton';
import { useConfirm } from '@/components/providers/confirm-dialog';
import { adminCompanyPatchSchema, type AdminCompanyDetail } from '@/lib/admin-company-policy';
import { CompanyAccess } from './CompanyAccess';

type Draft = { name: string; description: string; websiteUrl: string; logo: string; bannerImage: string; colorScheme: string; usesShipping: boolean };
const draftOf = (company: AdminCompanyDetail): Draft => ({ name: company.name, description: company.description || '', websiteUrl: company.websiteUrl || '', logo: company.logo.join('\n'), bannerImage: company.bannerImage.join('\n'), colorScheme: company.colorScheme || '', usesShipping: company.usesShipping });
const panel = 'min-w-0 rounded-xl border border-border bg-card p-4 sm:p-6';
const date = (value: string) => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' }).format(new Date(value));
export function CompanyEditor({ companyId, mode }: { companyId: string; mode: 'view' | 'edit' }) {
  return <CompanyAccess><Editor key={companyId + mode} companyId={companyId} mode={mode} /></CompanyAccess>;
}
function Editor({ companyId, mode }: { companyId: string; mode: 'view' | 'edit' }) {
  const confirm = useConfirm(), router = useRouter();
  const [company, setCompany] = useState<AdminCompanyDetail>(), [draft, setDraft] = useState<Draft>();
  const [reason, setReason] = useState(''), [fields, setFields] = useState<Record<string, string>>({});
  const [error, setError] = useState(''), [message, setMessage] = useState(''), [denied, setDenied] = useState(false);
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [reload, setReload] = useState(0), [uncertain, setUncertain] = useState(false);
  const epoch = useRef(0), leaving = useRef(false), errorPanel = useRef<HTMLDivElement>(null);
  const dirty = !!company && !!draft && JSON.stringify(draft) !== JSON.stringify(draftOf(company));
  const locked = loading || busy, editing = mode === 'edit';
  function loseAccess() { setCompany(undefined); setDraft(undefined); setReason(''); setFields({}); setDenied(true); }
  useEffect(() => { if (error) errorPanel.current?.focus(); }, [error]);
  useEffect(() => {
    const controller = new AbortController(), ticket = ++epoch.current, timeout = setTimeout(() => controller.abort(), 15_000);
    setLoading(true); setError('');
    void (async () => {
      try {
        const response = await fetch('/api/admin/companies/' + encodeURIComponent(companyId), { cache: 'no-store', signal: controller.signal });
        if (ticket !== epoch.current) return;
        if ([401, 403].includes(response.status)) { loseAccess(); return; }
        if (!response.ok) { setError(response.status === 404 ? 'Company not found.' : response.status === 429 ? 'Wait a few minutes before retrying.' : 'Company could not be loaded. Try again.'); return; }
        const body = await response.json();
        if (ticket === epoch.current) { setCompany(body.company); setDraft(draftOf(body.company)); setReason(''); setFields({}); setMessage(''); setUncertain(false); }
      } catch { if (ticket === epoch.current) setError('Company could not be loaded. Check your connection and retry.'); }
      finally { clearTimeout(timeout); if (ticket === epoch.current) setLoading(false); }
    })();
    return () => { epoch.current = ticket + 1; controller.abort(); clearTimeout(timeout); };
  }, [companyId, reload]);
  useEffect(() => {
    if (!dirty) return;
    const unload = (event: BeforeUnloadEvent) => { if (!leaving.current) { event.preventDefault(); event.returnValue = ''; } };
    const navigate = (event: MouseEvent) => {
      const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href]') : null;
      if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || link.target === '_blank' || link.hasAttribute('download')) return;
      const destination = new URL(link.href); if (destination.href === location.href) return;
      event.preventDefault(); event.stopPropagation(); if (locked) return;
      void confirm({ title: 'Discard unsaved changes?', description: 'Your saved company is unchanged.', confirmLabel: 'Discard & leave' }).then(yes => {
        if (yes) { leaving.current = true; router.push(destination.pathname + destination.search + destination.hash); }
      });
    };
    window.addEventListener('beforeunload', unload); document.addEventListener('click', navigate, true);
    return () => { window.removeEventListener('beforeunload', unload); document.removeEventListener('click', navigate, true); };
  }, [dirty, locked, confirm, router]);
  async function reloadSaved() {
    if (dirty && !await confirm({ title: 'Discard draft & reload?', description: 'Load the latest saved company. Your unsaved changes will be lost.', confirmLabel: 'Reload saved company' })) return;
    setReload(value => value + 1);
  }
  function change<K extends keyof Draft>(key: K, value: Draft[K]) { setDraft(previous => previous && ({ ...previous, [key]: value })); setFields(previous => ({ ...previous, [key]: '' })); setMessage(''); }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!company || !draft || locked || uncertain) return;
    if (!dirty) { setMessage('No fields changed.'); return; }
    const original = draftOf(company), patch: Record<string, unknown> = { expectedUpdatedAt: company.updatedAt, reason };
    for (const key of Object.keys(draft) as Array<keyof Draft>) if (draft[key] !== original[key]) {
      patch[key] = key === 'logo' || key === 'bannerImage' ? draft[key].split('\n').map(value => value.trim()).filter(Boolean)
        : key === 'name' || key === 'usesShipping' ? draft[key] : draft[key] || null;
    }
    const parsed = adminCompanyPatchSchema.safeParse(patch);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) if (typeof issue.path[0] === 'string') next[issue.path[0]] = issue.message;
      setFields(next); document.getElementById(Object.keys(next)[0])?.focus(); return;
    }
    const ticket = epoch.current, controller = new AbortController(), timeout = setTimeout(() => controller.abort(), 15_000);
    setBusy(true); setError(''); setMessage('');
    try {
      const response = await fetch('/api/admin/companies/' + encodeURIComponent(companyId), { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(parsed.data), signal: controller.signal });
      if (ticket !== epoch.current) return;
      if ([401, 403].includes(response.status)) { loseAccess(); return; }
      if (!response.ok) {
        if (response.status === 409) { setUncertain(true); setError('This company changed elsewhere. Your draft is kept. Reload the saved company before editing again.'); }
        else if (response.status === 429) setError('Wait a few minutes before retrying.');
        else if (response.status === 400) setError('The update was rejected. Check your fields and reason.');
        else { setUncertain(true); setError('Save could not be confirmed. Your draft is kept. Reload the saved company before retrying.'); }
        return;
      }
      const body = await response.json();
      if (ticket === epoch.current) { const updated = { ...company, ...body.company }; setCompany(updated); setDraft(draftOf(updated)); setReason(''); setFields({}); setMessage('Company changes saved.'); }
    } catch { if (ticket === epoch.current) { setUncertain(true); setError('Save could not be confirmed. Your draft is kept. Reload the saved company before retrying.'); } }
    finally { clearTimeout(timeout); if (ticket === epoch.current) setBusy(false); }
  }
  const fieldError = (key: string) => fields[key] ? <p id={key + '-error'} className="text-sm text-destructive" role="alert">{fields[key]}</p> : null;
  if (denied) return <section className="mx-auto max-w-7xl space-y-4 px-4 py-6"><h1 className="text-2xl font-semibold">Company details</h1><p role="alert">Admin access is no longer available. Sign in again or retry.</p><Button className="h-11" onClick={() => { setDenied(false); setReload(value => value + 1); }}>Retry access</Button></section>;
  return <section aria-label="Company details" className="mx-auto w-full min-w-0 max-w-7xl space-y-5 px-4 py-6 sm:px-6 lg:px-8 [overflow-wrap:anywhere]">
    <header className="flex flex-wrap items-end justify-between gap-3"><div className="min-w-0"><Link href="/admin/companies" className="inline-flex min-h-11 items-center text-sm text-muted-foreground hover:text-foreground">← All companies</Link><h1 className="text-2xl font-semibold text-balance">{editing ? 'Edit company' : 'Company details'}</h1></div><div className="flex flex-wrap gap-2">{company && <><Button asChild variant="outline" className="h-11"><Link href={'/company/' + encodeURIComponent(companyId)} target="_blank" rel="noopener noreferrer">Public storefront <span className="sr-only">(new tab)</span></Link></Button>{!editing && <Button asChild className="h-11"><Link href={'/admin/companies/' + encodeURIComponent(companyId) + '/edit'}>Edit company</Link></Button>}</>}</div></header>
    {error && <div ref={errorPanel} role="alert" tabIndex={-1} className="scroll-mt-24 space-y-3 rounded-xl border border-destructive/30 bg-destructive/5 p-4 focus-visible:outline-2 focus-visible:outline-ring"><p>{error}</p><Button variant="outline" className="h-11" disabled={locked} onClick={reloadSaved}>{company ? 'Reload saved company' : 'Retry'}</Button></div>}
    {loading && !company ? <div role="status" className="grid gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]"><span className="sr-only">Loading company…</span><Skeleton className="h-96 rounded-xl" /><Skeleton className="h-72 rounded-xl" /></div> : company && draft && <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
      {editing ? <form aria-label="Edit company" onSubmit={save} className={panel + ' space-y-4'}>
        <fieldset className="min-w-0 space-y-4" disabled={locked || uncertain}>
          <legend className="sr-only">Storefront information</legend>
          <div><label className="mb-1.5 block text-sm font-medium" htmlFor="name">Company name</label><Input id="name" name="name" autoComplete="off" maxLength={200} className="min-h-11 text-base" value={draft.name} onChange={event => change('name', event.target.value)} aria-invalid={!!fields.name} aria-describedby={fields.name ? 'name-error' : undefined} />{fieldError('name')}</div>
          <div><label className="mb-1.5 block text-sm font-medium" htmlFor="description">Description</label><Textarea id="description" name="description" autoComplete="off" maxLength={5000} rows={4} className="resize-y text-base" value={draft.description} onChange={event => change('description', event.target.value)} aria-invalid={!!fields.description} aria-describedby={fields.description ? 'description-error' : undefined} />{fieldError('description')}</div>
          <div><label className="mb-1.5 block text-sm font-medium" htmlFor="websiteUrl">Website</label><Input id="websiteUrl" name="websiteUrl" type="url" autoComplete="off" spellCheck={false} placeholder="https://example.com" className="min-h-11 text-base" value={draft.websiteUrl} onChange={event => change('websiteUrl', event.target.value)} aria-invalid={!!fields.websiteUrl} aria-describedby={fields.websiteUrl ? 'websiteUrl-error' : undefined} />{fieldError('websiteUrl')}</div>
          <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-lg border border-border p-3 text-sm"><input type="checkbox" name="usesShipping" className="size-5 accent-primary" checked={draft.usesShipping} onChange={event => change('usesShipping', event.target.checked)} />Uses shipping</label>
          <details className="rounded-lg border border-border px-3"><summary className="min-h-11 cursor-pointer py-3 text-sm font-medium">Branding</summary><div className="space-y-4 pb-4">
            {(['logo', 'bannerImage'] as const).map(key => <div key={key}><label className="mb-1.5 block text-sm font-medium" htmlFor={key}>{key === 'logo' ? 'Logo URLs' : 'Banner URLs'}</label><Textarea id={key} name={key} rows={2} className="text-base" autoComplete="off" spellCheck={false} value={draft[key]} onChange={event => change(key, event.target.value)} aria-invalid={!!fields[key]} aria-describedby={key + '-help' + (fields[key] ? ' ' + key + '-error' : '')} /><p id={key + '-help'} className="mt-1 text-xs text-muted-foreground">One HTTPS URL per line, up to five.</p>{fieldError(key)}</div>)}
            <div><label className="mb-1.5 block text-sm font-medium" htmlFor="colorScheme">Colour scheme</label><Input id="colorScheme" name="colorScheme" autoComplete="off" maxLength={100} className="min-h-11 text-base" value={draft.colorScheme} onChange={event => change('colorScheme', event.target.value)} />{fieldError('colorScheme')}</div>
          </div></details>
          <div><label className="mb-1.5 block text-sm font-medium" htmlFor="reason">Reason for change</label><Textarea id="reason" name="reason" autoComplete="off" rows={2} maxLength={500} placeholder="Brief support or moderation reason…" className="text-base" value={reason} onChange={event => { setReason(event.target.value); setFields(previous => ({ ...previous, reason: '' })); }} aria-invalid={!!fields.reason} aria-describedby={fields.reason ? 'reason-error' : undefined} />{fieldError('reason')}</div>
        </fieldset>
        <p role="status" className="min-h-5 text-sm text-muted-foreground">{message || (dirty ? 'Unsaved changes' : '')}</p>
        <div className="sticky bottom-0 z-10 flex flex-wrap justify-end gap-2 border-t border-border bg-card pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">{dirty && <Button type="button" variant="ghost" className="h-11" disabled={locked} onClick={reloadSaved}>Discard</Button>}<Button type="submit" className="h-11" disabled={locked || uncertain}>{busy ? 'Saving…' : 'Save changes'}</Button></div>
      </form> : <section aria-labelledby="company-profile" className={panel + ' space-y-5'}><h2 id="company-profile" className="text-xl font-semibold">{company.name}</h2><p className="whitespace-pre-wrap text-sm text-muted-foreground">{company.description || 'No description added.'}</p><dl className="grid gap-4 text-sm sm:grid-cols-2"><div><dt className="text-muted-foreground">Website</dt><dd className="mt-1">{company.websiteUrl || 'Not provided'}</dd></div><div><dt className="text-muted-foreground">Shipping</dt><dd className="mt-1">{company.usesShipping ? 'Enabled' : 'Not used'}</dd></div></dl></section>}
      <aside aria-label="Saved company information" className="min-w-0 space-y-5">
        <section className={panel + ' space-y-4'}><h2 className="font-semibold">Company record</h2><dl className="grid gap-4 text-sm sm:grid-cols-2"><div><dt className="text-muted-foreground">Owner</dt><dd><Link className="inline-flex min-h-11 items-center underline underline-offset-4" href={'/admin/users/' + company.User_Company_ownerIdToUser.id}>{company.User_Company_ownerIdToUser.name || 'Owner account'}</Link></dd></div><div><dt className="text-muted-foreground">Registration</dt><dd className="mt-2">{company.orgNumber || 'Not registered'}{company.orgType ? ` · ${company.orgType}` : ''}</dd></div><div><dt className="text-muted-foreground">Verification</dt><dd className="mt-1">{company.orgVerification?.status.replaceAll('_', ' ').toLowerCase() || 'Not verified'}</dd></div><div><dt className="text-muted-foreground">Created</dt><dd className="mt-1">{date(company.createdAt)}</dd></div></dl><details><summary className="min-h-11 cursor-pointer py-3 text-sm">Record details</summary><dl className="space-y-3 text-sm"><div><dt className="text-muted-foreground">Company ID</dt><dd className="font-mono text-xs">{company.id}</dd></div><div><dt className="text-muted-foreground">Last updated</dt><dd>{date(company.updatedAt)}</dd></div><div><dt className="text-muted-foreground">Created by</dt><dd>{company.User_Company_creatorIdToUser.name || company.User_Company_creatorIdToUser.id}</dd></div></dl><p className="mt-3 text-xs text-muted-foreground">Ownership, registration proof and payouts use separate verified workflows. Deletion requires a retention review.</p></details></section>
        <section className={panel}><h2 className="mb-4 font-semibold">Activity</h2><dl className="grid grid-cols-3 gap-4 tabular-nums">{(['Employee', 'Product', 'WarehouseLocation'] as const).map((key, index) => <div key={key}><dt className="text-xs text-muted-foreground">{['Employees', 'Products', 'Warehouses'][index]}</dt><dd className="mt-1 text-xl font-semibold">{(company._count[key] ?? 0).toLocaleString()}</dd></div>)}</dl></section>
        <section aria-label="Checkout activity" className={panel + ' space-y-4'}><h2 className="font-semibold">Checkout activity</h2><dl className="grid grid-cols-2 gap-5 tabular-nums">{([['livePaid', 'Live paid orders'], ['liveAdjusted', 'Live refunded / reversed'], ['liveReview', 'Live payment review'], ['sandbox', 'Sandbox captures']] as const).map(([key, label]) => <div key={key}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 text-xl font-semibold">{company.checkoutCounts?.[key].toLocaleString() ?? '—'}</dd></div>)}</dl><details className="border-t border-border"><summary className="min-h-11 cursor-pointer py-3 text-sm focus-visible:outline-2 focus-visible:outline-ring">How orders are counted</summary><p className="text-xs text-muted-foreground">Verified PayPal orders for products currently linked to this company, counted once per order. Live paid orders exclude refunds, reversals and reviews. Sandbox captures are test payments; demo and unpaid orders are excluded. These are operational counts, not revenue or historical seller attribution.</p><p className="mt-2 text-xs text-muted-foreground">Legacy sales records: {company._count.Sale.toLocaleString()} (separate from checkout).</p></details></section>
      </aside>
    </div>}
  </section>;
}
