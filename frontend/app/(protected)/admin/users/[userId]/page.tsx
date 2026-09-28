'use client';

import { useState, useEffect, useRef, type FormEvent } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Eye, Loader2, Save, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import { useConfirm } from '@/components/providers/confirm-dialog';
import { useEdgeStore } from '@/lib/edgestore';
import { adminProfileFields, adminUserPatchSchema } from '@/lib/admin-user-detail-policy';

type Role = 'USER' | 'ADMIN' | 'OWNER';
interface UserDetail {
  id: string; name: string | null; email: string | null; emailVerified: string | null;
  bio: string | null; image: string | null; banner: string | null; role: Role;
  verificationTier: string; verificationScore: number; createdAt: string; updatedAt: string;
  hasGoogleAuth: boolean; hasGithubAuth: boolean; hasDiscordAuth: boolean; hasVerifiedWallet: boolean; isTwoFactorEnabled: boolean;
  _count: { Company_Company_ownerIdToUser: number; Employee: number; Order: number; Conversation: number; followers: number; following: number };
  Company_Company_ownerIdToUser: Array<{ id: string; name: string }>;
  Employee: Array<{ id: string; role: string; jobTitle: string | null; Company: { id: string; name: string } }>;
}
type Permissions = { edit: boolean; changeRole: boolean; preview: boolean };
type Draft = { name: string; bio: string; image: string; banner: string; role: Role };
const draftOf = (user: UserDetail): Draft => ({ name: user.name || '', bio: user.bio || '', image: user.image || '', banner: user.banner || '', role: user.role });
const initialDraft: Draft = { name: '', bio: '', image: '', banner: '', role: 'USER' };
const panel = 'min-w-0 rounded-2xl border border-border bg-card p-4 sm:p-6';
const control = 'min-h-11 text-base';
const formatDate = (value: string) => new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));

export default function AdminUserEditPage() {
  const { data: session, status } = useSession();
  const router = useRouter(), { userId } = useParams<{ userId: string }>();
  const authorized = !!session?.user?.id && !session.user.isImpersonating && !session.user.isDemo
    && ['OWNER', 'ADMIN'].includes(session.user.role);
  useEffect(() => { if (status !== 'loading' && !authorized) router.replace('/'); }, [status, authorized, router]);
  if (!authorized || !session?.user?.id) return <div role="status" className="p-6 text-muted-foreground">Checking access…</div>;
  // Session refreshes keep drafts. Different actors or targets get fresh state.
  return <UserEditor key={session.user.id + ':' + userId} userId={userId} ownAccount={session.user.id === userId} />;
}

function UserEditor({ userId, ownAccount }: { userId: string; ownAccount: boolean }) {
  const router = useRouter(), confirm = useConfirm(), { edgestore } = useEdgeStore();
  const [user, setUser] = useState<UserDetail | null>(null);
  const [permissions, setPermissions] = useState<Permissions>({ edit: false, changeRole: false, preview: false });
  const [draft, setDraft] = useState<Draft>(initialDraft), [reason, setReason] = useState('');
  const [loading, setLoading] = useState(true), [reload, setReload] = useState(0), [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState<'image' | 'banner' | null>(null);
  const [error, setError] = useState(''), [message, setMessage] = useState(''), [fields, setFields] = useState<Record<string, string>>({});
  const epoch = useRef(0), leaving = useRef(false);
  const errorPanel = useRef<HTMLDivElement>(null);
  const dirty = !!user && (Object.keys(draft) as Array<keyof Draft>).some(key => draft[key] !== draftOf(user)[key]);
  const locked = busy || loading || !!uploading;
  useEffect(() => { if (error) errorPanel.current?.focus(); }, [error]);
  useEffect(() => {
    const abort = new AbortController(), ticket = ++epoch.current;
    setLoading(true); setError('');
    void (async () => {
      try {
        const response = await fetch('/api/admin/users/' + encodeURIComponent(userId), { signal: abort.signal, cache: 'no-store' });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Account could not be loaded. Try again.');
        if (abort.signal.aborted) return;
        setUser(data.user); setDraft(draftOf(data.user)); setPermissions(data.permissions);
        setReason(''); setFields({}); setMessage('');
      } catch (cause) { if (!abort.signal.aborted) setError(cause instanceof Error ? cause.message : 'Account could not be loaded. Try again.'); }
      finally { if (!abort.signal.aborted) setLoading(false); }
    })();
    return () => { abort.abort(); epoch.current = ticket + 1; };
  }, [userId, reload]);

  useEffect(() => {
    if (!dirty && !uploading) return;
    const unload = (event: BeforeUnloadEvent) => { if (!leaving.current) { event.preventDefault(); event.returnValue = ''; } };
    const navigate = (event: MouseEvent) => {
      const link = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href]') : null;
      if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || link.target === '_blank' || link.hasAttribute('download')) return;
      const destination = new URL(link.href);
      if (destination.origin !== location.origin || destination.href === location.href || destination.hash && destination.pathname === location.pathname) return;
      event.preventDefault(); event.stopPropagation();
      if (locked) return;
      void confirm({ title: 'Discard unsaved changes?', description: 'Your saved account is unchanged.', confirmLabel: 'Discard & leave' }).then(yes => {
        if (yes) { leaving.current = true; router.push(destination.pathname + destination.search + destination.hash); }
      });
    };
    window.addEventListener('beforeunload', unload); document.addEventListener('click', navigate, true);
    return () => { window.removeEventListener('beforeunload', unload); document.removeEventListener('click', navigate, true); };
  }, [dirty, uploading, locked, confirm, router]);

  async function reloadSaved() {
    if (dirty && !await confirm({ title: 'Discard draft & reload?', description: 'Load the latest saved account. Your unsaved changes will be lost.', confirmLabel: 'Reload saved account' })) return;
    setReload(value => value + 1);
  }
  function change(key: keyof Draft, value: string) {
    setDraft(previous => ({ ...previous, [key]: value }));
    setFields(previous => ({ ...previous, [key]: '' })); setMessage('');
  }
  async function upload(file: File, kind: 'image' | 'banner') {
    if (!permissions.edit || locked) return;
    if (!['image/jpeg','image/png','image/gif','image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) {
      setFields(previous => ({ ...previous, [kind]: 'Choose a JPG, PNG, GIF or WebP up to 5 MB.' })); return;
    }
    const ticket = epoch.current; setUploading(kind); setError('');
    try {
      const result = await edgestore.myPublicImages.upload({ file });
      if (ticket === epoch.current) { change(kind, result.url); setMessage('Image uploaded. Save changes to apply it.'); }
    } catch { if (ticket === epoch.current) setError('Upload failed. Your saved image has not changed.'); }
    finally { if (ticket === epoch.current) setUploading(null); }
  }
  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!user || !permissions.edit || locked) return;
    if (!dirty) { setMessage('No fields changed.'); return; }
    const patch: Record<string, unknown> = { expectedUpdatedAt: user.updatedAt, reason };
    for (const key of adminProfileFields) if (draft[key] !== draftOf(user)[key]) patch[key] = key === 'name' ? draft[key] : draft[key] || null;
    if (draft.role !== user.role) patch.role = draft.role;
    const parsed = adminUserPatchSchema.safeParse(patch);
    if (!parsed.success) {
      const next: Record<string, string> = {};
      for (const issue of parsed.error.issues) if (typeof issue.path[0] === 'string') next[issue.path[0]] = issue.message;
      setFields(next); document.getElementById(Object.keys(next)[0])?.focus(); return;
    }
    setBusy(true); setError(''); setMessage('');
    try {
      if (patch.role && !await confirm({ title: 'Change account role?', description: 'This changes administration access and signs out the member’s existing sessions.', confirmLabel: 'Change role' })) return;
      const response = await fetch('/api/admin/users/' + encodeURIComponent(userId), { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(parsed.data) });
      const data = await response.json();
      if (!response.ok) { setFields(data.fields || {}); throw new Error(data.error || 'Save could not be confirmed. Reload the saved account before retrying.'); }
      const updated = { ...user, ...data.user }; setUser(updated); setDraft(draftOf(updated)); setPermissions(data.permissions);
      setReason(''); setFields({}); setMessage(data.message || 'Changes saved.');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Save could not be confirmed. Your draft is kept.'); }
    finally { setBusy(false); }
  }
  async function preview() {
    if (!user || locked) return;
    if (!await confirm({ title: 'Open read-only account preview?', description: (dirty ? 'Unsaved changes will be discarded. ' : '') + 'View this member’s account for up to one hour. Purchases, messages and changes are blocked. The preview is audited.', confirmLabel: 'Preview account' })) return;
    setBusy(true); setError('');
    try {
      const response = await fetch('/api/admin/impersonate', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ targetUserId: userId, expectedUpdatedAt: user.updatedAt, reason: 'Owner support preview from user details' }) });
      const data = await response.json();
      if (!response.ok || data.success !== true) throw new Error(data.error || 'Preview could not be started. Try again.');
      leaving.current = true;
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- switching identities must discard cached owner data
      window.location.assign('/');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Preview could not be started. Try again.'); }
    finally { setBusy(false); }
  }
  const fieldError = (key: string) => fields[key] ? <p id={key + '-error'} className="text-sm text-destructive" role="alert">{fields[key]}</p> : null;

  return <section aria-label="Account administration" className="mx-auto w-full max-w-6xl space-y-5 px-4 py-6 sm:px-6 lg:px-8 [overflow-wrap:anywhere]">
    <header className="flex min-w-0 flex-wrap items-center justify-between gap-3">
      <div className="min-w-0">
        <Link href="/admin/users" className="inline-flex min-h-11 items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft aria-hidden className="size-4" />All users</Link>
        <h1 className="text-2xl font-semibold text-balance">Account details</h1>
      </div>
      {permissions.preview && user && <Button variant="outline" className={control} onClick={preview} disabled={locked}><Eye aria-hidden className="mr-2 size-4" />Preview Account</Button>}
    </header>
    {error && <div ref={errorPanel} role="alert" tabIndex={-1} className="scroll-mt-24 space-y-2 rounded-xl border border-destructive/30 bg-destructive/5 p-4 focus-visible:outline-2 focus-visible:outline-ring">
      <p>{error}</p><Button variant="outline" className={control} disabled={locked} onClick={reloadSaved}>{user ? 'Reload saved account' : 'Retry'}</Button>
    </div>}
    {loading ? <div role="status" className="grid gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]"><span className="sr-only">Loading account…</span><Skeleton className="h-96 rounded-2xl" /><Skeleton className="h-72 rounded-2xl" /></div>
    : user && <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
      <form aria-label="Edit account" onSubmit={save} className={panel + ' space-y-5'}>
        <div className="flex min-w-0 items-center gap-3">
          <Avatar className="size-12 shrink-0"><AvatarImage src={user.image || undefined} alt="" /><AvatarFallback>{user.name?.charAt(0) || '?'}</AvatarFallback></Avatar>
          <div className="min-w-0 flex-1"><h2 className="font-semibold">{user.name || 'Unnamed member'}</h2><p className="text-sm text-muted-foreground">{user.email || 'No email'}</p></div>
          <Badge variant="secondary" className="shrink-0">{user.role}</Badge>
        </div>
        {!permissions.edit && <p className="text-sm text-muted-foreground">{ownAccount ? <Link className="underline underline-offset-4" href="/settings">Edit your account in Settings</Link> : 'This account is read-only for your role.'}</p>}
        <fieldset disabled={!permissions.edit || locked} className="min-w-0 space-y-4">
          <legend className="sr-only">Public profile</legend>
          <div className="space-y-2"><Label htmlFor="name">Display Name</Label><Input id="name" name="name" autoComplete="off" maxLength={200} className={control} value={draft.name} aria-invalid={!!fields.name} aria-describedby={fields.name ? 'name-error' : undefined} onChange={event => change('name', event.target.value)} />{fieldError('name')}</div>
          <div className="space-y-2"><Label htmlFor="bio">Bio</Label><Textarea id="bio" name="bio" autoComplete="off" maxLength={2000} rows={3} className="resize-y text-base" value={draft.bio} aria-invalid={!!fields.bio} aria-describedby={fields.bio ? 'bio-error' : undefined} onChange={event => change('bio', event.target.value)} />{fieldError('bio')}</div>
          {permissions.changeRole && <div className="space-y-2"><Label htmlFor="role">Account Role</Label><select id="role" name="role" className="min-h-11 w-full rounded-md border border-input bg-background px-3 text-base focus-visible:outline-2 focus-visible:outline-ring" value={draft.role} onChange={event => change('role', event.target.value)}><option value="USER">Member</option><option value="ADMIN">Admin</option></select><p className="text-xs text-muted-foreground">Changing role signs out existing sessions.</p>{fieldError('role')}</div>}
          <details className="rounded-xl border border-border px-3">
            <summary className="flex min-h-11 cursor-pointer items-center text-sm font-medium">Profile images</summary>
            <div className="space-y-4 pb-4">{(['image', 'banner'] as const).map(kind => <div key={kind} className="space-y-2">
              <Label htmlFor={kind}>{kind === 'image' ? 'Profile Image URL' : 'Banner URL'}</Label>
              <Input id={kind} name={kind} autoComplete="off" type="url" spellCheck={false} className={control} value={draft[kind]} placeholder="https://…" aria-invalid={!!fields[kind]} aria-describedby={fields[kind] ? kind + '-error' : undefined} onChange={event => change(kind, event.target.value)} />
              <div className="flex flex-wrap items-center gap-2">
                <label className="relative inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-md border border-input px-3 text-sm focus-within:ring-2 focus-within:ring-ring hover:bg-accent">
                  <Upload aria-hidden className="size-4" />{uploading === kind ? 'Uploading…' : 'Upload ' + (kind === 'image' ? 'avatar' : 'banner')}
                  <input aria-label={'Upload ' + (kind === 'image' ? 'avatar' : 'banner')} type="file" accept="image/jpeg,image/png,image/gif,image/webp" className="absolute inset-0 w-full cursor-pointer opacity-0" onChange={event => { const file = event.target.files?.[0]; if (file) void upload(file, kind); event.target.value = ''; }} />
                </label>
                {draft[kind] && <Button type="button" variant="ghost" className={control} onClick={() => change(kind, '')}>Remove {kind === 'image' ? 'avatar' : 'banner'}</Button>}
              </div>{fieldError(kind)}
            </div>)}</div>
          </details>
          {permissions.edit && <div className="space-y-2"><Label htmlFor="reason">Reason for Change</Label><Textarea id="reason" name="reason" autoComplete="off" rows={2} maxLength={500} className="text-base" value={reason} aria-invalid={!!fields.reason} aria-describedby={fields.reason ? 'reason-error' : undefined} onChange={event => { setReason(event.target.value); setFields(previous => ({ ...previous, reason: '' })); }} placeholder="Brief support or moderation reason…" />{fieldError('reason')}</div>}
        </fieldset>
        <p role="status" className="text-sm text-muted-foreground">{message || (dirty ? 'Unsaved changes' : '')}</p>
        {permissions.edit && <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-end gap-2 border-t border-border bg-card pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
          {dirty && <Button type="button" aria-label="Discard Changes" variant="ghost" className={control} disabled={locked} onClick={reloadSaved}>Discard</Button>}
          <Button type="submit" className={control} disabled={locked}>{busy ? <Loader2 aria-hidden className="mr-2 size-4 animate-spin motion-reduce:animate-none" /> : <Save aria-hidden className="mr-2 size-4" />}{busy ? 'Saving…' : 'Save Changes'}</Button>
        </div>}
      </form>
      <aside className="min-w-0 space-y-5" aria-label="Saved account information">
        <section className={panel + ' space-y-4'} aria-labelledby="identity-title">
          <h2 id="identity-title" className="font-semibold">Identity & access</h2>
          <dl className="grid gap-4 text-sm sm:grid-cols-2">
            <div className="min-w-0 sm:col-span-2"><dt className="text-muted-foreground">Email · {user.emailVerified ? 'Verified' : 'Unverified'}</dt><dd className="mt-1">{user.email || 'Not provided'}</dd></div>
            <div><dt className="text-muted-foreground">Verification</dt><dd className="mt-1">{user.verificationTier.replaceAll('_', ' ')} · {user.verificationScore}</dd></div>
            <div><dt className="text-muted-foreground">Two-factor authentication</dt><dd className="mt-1">{user.isTwoFactorEnabled ? 'Enabled' : 'Not enabled'}</dd></div>
          </dl>
          <div className="flex flex-wrap gap-2">{[['Google',user.hasGoogleAuth],['GitHub',user.hasGithubAuth],['Discord',user.hasDiscordAuth],['Wallet',user.hasVerifiedWallet]].filter(([,linked]) => linked).map(([name]) => <Badge variant="secondary" key={String(name)}>{String(name)}</Badge>)}</div>
          <p className="text-xs text-muted-foreground">Email and verification require account-owned proof; they cannot be overwritten here.</p>
          <details><summary className="min-h-11 cursor-pointer py-3 text-sm">Account record</summary>
            <dl className="space-y-3 text-sm"><div><dt className="text-muted-foreground">Created</dt><dd>{formatDate(user.createdAt)}</dd></div><div><dt className="text-muted-foreground">Updated</dt><dd>{formatDate(user.updatedAt)}</dd></div><div><dt className="text-muted-foreground">User ID</dt><dd className="font-mono text-xs">{user.id}</dd></div></dl>
            <p className="mt-4 text-xs text-muted-foreground">Erasure needs a retention review. Direct deletion is not available here.</p>
          </details>
        </section>
        <section className={panel} aria-labelledby="activity-title"><h2 id="activity-title" className="mb-4 font-semibold">Activity</h2><dl className="grid grid-cols-2 gap-4">
          {[[user._count.Order,'Orders'],[user._count.Conversation,'Conversations'],[user._count.followers,'Followers'],[user._count.following,'Following']].map(([count,label]) => <div key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 text-xl font-semibold tabular-nums">{new Intl.NumberFormat().format(Number(count))}</dd></div>)}
        </dl></section>
        {(user.Company_Company_ownerIdToUser.length > 0 || user.Employee.length > 0) && <section className={panel + ' space-y-3'} aria-labelledby="companies-title"><h2 id="companies-title" className="font-semibold">Companies</h2>
          <p className="text-xs text-muted-foreground">{user._count.Company_Company_ownerIdToUser} owned · {user._count.Employee} memberships · Showing up to 5 each</p>
          {user.Company_Company_ownerIdToUser.map(company => <Link className="flex min-h-11 items-center justify-between gap-2 rounded-md border border-border px-3 py-2 text-sm hover:bg-accent" key={company.id} href={'/admin/companies/' + company.id}><span className="min-w-0">{company.name}</span><span className="shrink-0 text-xs text-muted-foreground">Owner</span></Link>)}
          {user.Employee.map(job => <div key={job.id} className="text-sm"><p>{job.Company.name}</p><p className="text-xs text-muted-foreground">{job.jobTitle || job.role}</p></div>)}
        </section>}
      </aside>
    </div>}
  </section>;
}
