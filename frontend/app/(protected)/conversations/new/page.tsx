'use client';

/** @fileOverview Accessible message composer with safe demo preview. @stability experimental */
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useCurrentUserWithStatus } from '@/hooks/use-current-user';
import { isDemoUserId } from '@/lib/demo-policy';
import { UserSearchResponseSchema } from '@/lib/types/users';
import { FiArrowLeft, FiCheck, FiMessageCircle, FiSearch, FiUsers, FiX } from 'react-icons/fi';

type Recipient = { id: string; name: string | null; email: string | null; image: string | null };
const nameOf = (user: Recipient) => user.name || user.email || 'Veggat member';
const fieldClass = 'min-h-12 text-base md:text-base';

export default function NewConversationPage() {
  const router = useRouter();
  const { user, isLoading } = useCurrentUserWithStatus();
  const demo = isDemoUserId(user?.id);
  const [type, setType] = useState<'PRIVATE_DM' | 'GROUP'>('PRIVATE_DM');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Recipient[]>([]);
  const [selected, setSelected] = useState<Recipient[]>([]);
  const [groupName, setGroupName] = useState('');
  const [message, setMessage] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState('');
  const [createError, setCreateError] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setResults([]);
      setSearchError('');
      if (!user?.id || demo || query.trim().length < 2) { setSearching(false); return; }
      setSearching(true);
      try {
        const response = await fetch(`/api/users/search?q=${encodeURIComponent(query.trim())}`, { signal: controller.signal });
        if (!response.ok) throw new Error('Search unavailable');
        const data = UserSearchResponseSchema.parse(await response.json());
        if (!controller.signal.aborted) setResults(data.users.filter((candidate) =>
          candidate.id !== user.id && !selected.some((recipient) => recipient.id === candidate.id)));
      } catch {
        if (!controller.signal.aborted) setSearchError('People search is unavailable. Please try again in a moment.');
      } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 250);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [query, user?.id, demo, selected]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user || demo || creating || !selected.length || (type === 'GROUP' && !groupName.trim())) return;
    setCreating(true);
    setCreateError('');
    try {
      const response = await fetch('/api/conversations', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type, title: type === 'GROUP' ? groupName.trim() : null,
          participants: selected.map((recipient) => recipient.id), initialMessage: message.trim() || undefined }),
      });
      if (!response.ok) {
        setCreateError(response.status === 429 ? 'Please wait a moment before starting another conversation.'
          : response.status === 401 ? 'Your session has expired. Sign in again to send a message.'
          : 'The conversation could not be started. Your draft is still here; please try again.');
        return;
      }
      const data = await response.json();
      const id = data.id || data.conversation?.id;
      if (typeof id !== 'string' || !id) throw new Error('Missing conversation');
      router.push(`/conversations/${encodeURIComponent(id)}`);
    } catch {
      setCreateError('Could not connect. Your draft is still here; check your connection and try again.');
    } finally { setCreating(false); }
  }

  if (isLoading) return <div role="status" aria-label="Loading message composer" className="mx-auto max-w-xl space-y-6 px-4 py-6 sm:px-6">
    <div className="h-8 w-56 rounded bg-muted motion-safe:animate-pulse" /><div className="h-48 rounded-xl bg-muted motion-safe:animate-pulse" />
  </div>;
  if (!user) return <section className="mx-auto max-w-xl px-4 py-8"><h1 className="text-2xl font-semibold">Sign in to message</h1>
    <Button asChild className="mt-4 min-h-11"><Link href="/auth/login?callbackUrl=%2Fconversations%2Fnew">Sign in</Link></Button></section>;

  return <section className="mx-auto w-full min-w-0 max-w-xl px-4 py-6 sm:px-6 lg:py-8">
    <header className="mb-6">
      <Link href="/conversations" className="mb-3 inline-flex min-h-11 items-center gap-2 rounded-md text-sm text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <FiArrowLeft aria-hidden="true" /> Back to Messages
      </Link>
      <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">New Conversation</h1>
      <p className="mt-2 text-sm text-muted-foreground">Start a private message or a small group chat.</p>
    </header>
    {demo && <aside aria-label="Demo messaging preview" className="mb-6 rounded-xl border bg-muted/40 p-4 text-sm">
      <p className="font-medium">Messaging preview</p>
      <p className="mt-1 text-muted-foreground">Demo accounts cannot contact real members. Explore the layout here, or try your private AI chat.</p>
      <Link href="/ai" className="mt-2 inline-flex min-h-11 items-center rounded-md font-medium text-primary underline underline-offset-4 focus-visible:ring-2 focus-visible:ring-ring">Open AI chat</Link>
    </aside>}
    <form onSubmit={submit} aria-label="New conversation" className="min-w-0">
      <fieldset className="mb-6">
        <legend className="mb-2 text-sm font-medium">Conversation type</legend>
        <div className="grid grid-cols-2 gap-3">
          {([{ value: 'PRIVATE_DM', label: 'Direct Message', Icon: FiMessageCircle }, { value: 'GROUP', label: 'Group Chat', Icon: FiUsers }] as const).map(({ value, label, Icon }) =>
            <button key={value} type="button" aria-pressed={type === value} disabled={creating}
              onClick={() => { setType(value); setSelected([]); setQuery(''); setResults([]); setSearching(false); setCreateError(''); }}
              className={`flex min-h-14 min-w-0 items-center justify-center gap-2 rounded-xl border px-3 py-3 text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${type === value ? 'border-primary bg-primary/10 text-foreground' : 'border-border text-muted-foreground hover:bg-muted'}`}>
              <Icon className="size-5 shrink-0" aria-hidden="true" /><span>{label}</span>
            </button>)}
        </div>
      </fieldset>
      {type === 'GROUP' && <div className="mb-6">
        <label htmlFor="group-name" className="mb-2 block text-sm font-medium">Group name</label>
        <Input id="group-name" name="groupName" autoComplete="off" required maxLength={100} disabled={demo || creating}
          value={groupName} onChange={(event) => setGroupName(event.target.value)} placeholder="Give your group a name" className={fieldClass} />
      </div>}
      {selected.length > 0 && <div className="mb-4">
        <p className="mb-2 text-sm font-medium">{type === 'GROUP' ? 'Participants' : 'Recipient'}</p>
        <ul className="flex flex-wrap gap-2">{selected.map((recipient) => <li key={recipient.id} className="flex max-w-full min-w-0 items-center rounded-xl border bg-muted pl-3">
          <span className="min-w-0 break-words text-sm">{nameOf(recipient)}</span>
          <Button type="button" variant="ghost" size="icon" disabled={creating} className="size-11 shrink-0" aria-label={`Remove ${nameOf(recipient)}`}
            onClick={() => setSelected((previous) => previous.filter((candidate) => candidate.id !== recipient.id))}><FiX aria-hidden="true" /></Button>
        </li>)}</ul>
      </div>}
      {(type === 'GROUP' || !selected.length) && <div className="mb-6">
        <label htmlFor="recipient-search" className="mb-2 block text-sm font-medium">{type === 'GROUP' ? 'Add people' : 'Find someone'}</label>
        <div className="relative"><FiSearch aria-hidden="true" className="pointer-events-none absolute left-3 top-4 size-4 text-muted-foreground" />
          <Input id="recipient-search" name="recipient" autoComplete="off" maxLength={100} disabled={demo || creating} aria-describedby="recipient-help"
            value={query} onChange={(event) => { setQuery(event.target.value); setResults([]); setSearchError(''); setSearching(event.target.value.trim().length >= 2); }} placeholder="Search by name or visible email" className={`${fieldClass} pl-10`} />
        </div>
        <p id="recipient-help" className="mt-2 text-xs text-muted-foreground">{demo ? 'People search is disabled in the demo.' : 'Enter at least two characters. Only shared email addresses are shown.'}</p>
        <p role="status" className="mt-2 text-sm text-muted-foreground">{searching ? 'Searching…' : !demo && query.trim().length >= 2 && !results.length && !searchError ? 'No matching members.' : ''}</p>
        {searchError && <p role="alert" className="mt-2 text-sm text-destructive">{searchError}</p>}
        {results.length > 0 && <ul aria-label="Matching members" className="mt-2 max-h-64 overflow-y-auto overscroll-contain rounded-xl border">
          {results.map((recipient) => <li key={recipient.id}><button type="button" disabled={creating} className="flex min-h-14 w-full items-center gap-3 p-3 text-left hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
            onClick={() => { setSelected((previous) => type === 'GROUP' ? [...previous, recipient] : [recipient]); setQuery(''); setResults([]); }}>
            <Avatar aria-hidden="true" className="size-9 shrink-0"><AvatarImage src={recipient.image || undefined} alt="" /><AvatarFallback>{nameOf(recipient)[0]}</AvatarFallback></Avatar>
            <span className="min-w-0"><span className="block break-words text-sm font-medium">{nameOf(recipient)}</span>{recipient.email && <span className="block break-all text-xs text-muted-foreground">{recipient.email}</span>}</span>
          </button></li>)}
        </ul>}
      </div>}
      <div className="mb-6">
        <label htmlFor="initial-message" className="mb-2 block text-sm font-medium">Message (optional)</label>
        <Textarea id="initial-message" name="message" value={message} onChange={(event) => setMessage(event.target.value)} disabled={demo || creating}
          maxLength={4000} rows={4} placeholder="Write your first message…" className="min-h-28 resize-y text-base md:text-base" />
      </div>
      {createError && <p role="alert" className="mb-4 text-sm text-destructive">{createError}</p>}
      <div className="sticky bottom-0 border-t bg-background/95 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-sm">
        <Button type="submit" disabled={demo || creating || !selected.length || (type === 'GROUP' && !groupName.trim())} className="h-12 w-full text-base">
          <FiCheck aria-hidden="true" className="size-4" />{creating ? 'Starting…' : demo ? 'Sending unavailable in demo' : 'Start Conversation'}
        </Button>
      </div>
    </form>
  </section>;
}
