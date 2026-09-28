'use client';

/** @fileOverview Find people: suggestions or a name search, follow/unfollow inline; rows in a trailing-box list. @stability evolving */

import { useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { FiSearch, FiUsers } from 'react-icons/fi';
import { HoverChaser } from '@/components/uicustom/chrome/hover-chaser';
import { useCurrentUser } from '@/hooks/use-current-user';
import { useFollowState } from '@/hooks/useFollowState';
import { isDemoUserId } from '@/lib/demo-policy';
import { UserSearchResponseSchema, UserSuggestionsResponseSchema, UserFollowMutationResponseSchema } from '@/lib/types/users';

type Person = { id: string; name: string | null; image: string | null; isFollowing: boolean; followerCount: number; reason?: string };
type Result = { key: string; rows: Person[]; error: string | null };

export function DiscoverPeople() {
  const viewer = useCurrentUser();
  // Remount on account changes so another account's results cannot linger.
  return viewer?.id ? <PeoplePanel key={viewer.id} viewerId={viewer.id} /> : null;
}

function PeoplePanel({ viewerId }: { viewerId: string }) {
  const demo = isDemoUserId(viewerId);
  const { initializeFollowStates, setFollowState } = useFollowState();
  const inputId = useId();
  const [query, setQuery] = useState('');
  const [retry, setRetry] = useState(0);
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const pending = useRef(false);
  const mounted = useRef(true);
  const panelRef = useRef<HTMLElement>(null);
  const [visible, setVisible] = useState(false);
  const [followError, setFollowError] = useState<string | null>(null);
  const term = query.trim();
  const short = term.length === 1;
  const requestKey = term + ':' + retry;
  const searching = term.length >= 2;
  const ready = result?.key === requestKey;
  const loading = !demo && !short && !ready;

  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; };
  }, []);

  useEffect(() => {
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting));
    if (panelRef.current) observer.observe(panelRef.current);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    // Closed mobile disclosure / hidden desktop sidebar must not duplicate reads.
    if (demo || short || !visible || ready) return;
    const controller = new AbortController();
    let active = true;
    let deadline: ReturnType<typeof setTimeout> | undefined;
    const timer = setTimeout(async () => {
      deadline = setTimeout(() => controller.abort(), 12_000);
      try {
        const url = searching ? '/api/users/search?q=' + encodeURIComponent(term) + '&limit=10' : '/api/users/suggestions?limit=5';
        const response = await fetch(url, { signal: controller.signal, cache: 'no-store' });
        if (!response.ok) throw new Error(response.status === 429 ? 'rate' : 'request');
        const data: unknown = await response.json();
        const rows = searching ? UserSearchResponseSchema.parse(data).users : UserSuggestionsResponseSchema.parse(data).suggestions;
        if (!active) return;
        const people = rows.filter(person => person.id !== viewerId);
        initializeFollowStates(people);
        setResult({ key: requestKey, rows: people, error: null });
      } catch (error) {
        if (active) setResult({ key: requestKey, rows: [], error: error instanceof Error && error.message === 'rate'
          ? 'Too many searches. Wait a moment, then retry.' : 'People could not be loaded. Try again.' });
      } finally { clearTimeout(deadline); }
    }, searching ? 250 : 0);
    return () => { active = false; clearTimeout(timer); clearTimeout(deadline); controller.abort(); };
  }, [demo, short, visible, ready, searching, term, requestKey, viewerId, initializeFollowStates]);

  async function toggleFollow(person: Person) {
    if (demo || pending.current) return;
    pending.current = true; setBusy(person.id); setFollowError(null);
    try {
      const response = await fetch('/api/users/' + encodeURIComponent(person.id) + '/follow', {
        method: person.isFollowing ? 'DELETE' : 'POST', signal: AbortSignal.timeout(12_000),
      });
      if (!response.ok) throw new Error('Follow failed');
      const saved = UserFollowMutationResponseSchema.parse(await response.json());
      if (!mounted.current) return;
      setFollowState(person.id, saved.isFollowing);
      setResult(previous => previous ? { ...previous, rows: previous.rows.map(row => row.id === person.id
        ? { ...row, isFollowing: saved.isFollowing, followerCount: saved.followerCount } : row) } : previous);
    } catch {
      // A lost response may have committed: refresh before another toggle.
      if (mounted.current) setFollowError('Could not confirm the change. Refresh people before trying again.');
    } finally {
      pending.current = false;
      if (mounted.current) setBusy(null);
    }
  }

  function refresh() { setFollowError(null); setRetry(value => value + 1); }

  return (
    <section ref={panelRef} aria-label="Find people" className="min-w-0 rounded-2xl border border-border/60 bg-card/70 p-4 shadow-e1 backdrop-blur-xl">
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold"><FiUsers aria-hidden="true" className="size-4 text-brand-accent" />Find people</h2>
      {demo ? <p className="rounded-xl border border-dashed border-border/70 px-3 py-3 text-xs text-muted-foreground">People search is off in the demo.</p> : <>
        <label htmlFor={inputId} className="sr-only">Search people</label>
        <div className="relative">
          <FiSearch aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input id={inputId} name="people-search" type="search" autoComplete="off" spellCheck={false} maxLength={100}
            value={query} onChange={event => setQuery(event.target.value)} placeholder="Name or shared email…"
            className="h-11 min-w-0 rounded-xl border-border/70 bg-background/60 pl-9 text-base dark:bg-foreground/[0.04]" />
        </div>
        <div aria-live="polite" aria-busy={loading} className="mt-3">
          {short ? <p className="py-3 text-sm text-muted-foreground">Type at least 2 characters.</p>
            : loading ? <div role="status" className="space-y-1">
              <span className="sr-only">Loading people…</span>
              {[0, 1, 2].map(key => <div key={key} aria-hidden="true" className="flex h-14 items-center gap-3 rounded-xl px-2 motion-safe:animate-pulse" style={{ opacity: 1 - key * 0.25 }}>
                <div className="size-9 shrink-0 rounded-full bg-muted" /><div className="h-3 w-24 rounded bg-muted" />
              </div>)}
            </div> : result?.error ? <div className="space-y-2"><p className="text-sm text-muted-foreground">{result.error}</p><Button type="button" variant="vegaNormalBtn" className="h-11" onClick={refresh}>Retry people</Button></div>
              : !result?.rows.length ? <p className="rounded-xl border border-dashed border-border/70 px-3 py-3 text-xs text-muted-foreground">{searching ? 'No people found.' : 'Suggestions appear as the community grows. Search by name to find someone now.'}</p>
                : <HoverChaser as="ul" className="space-y-0.5" boxClassName="rounded-xl">{result.rows.map(person => <li key={person.id} data-chase className="flex min-w-0 items-center gap-2 rounded-xl p-1.5">
                  <Link href={'/profile/' + encodeURIComponent(person.id)} className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-lg focus-visible:outline focus-visible:outline-2 focus-visible:outline-ring">
                    <Avatar className="size-9 shrink-0 ring-1 ring-border/60"><AvatarImage src={person.image || undefined} alt="" /><AvatarFallback className="bg-brand-accent/10 text-sm text-brand-accent">{person.name?.[0]?.toUpperCase() || '?'}</AvatarFallback></Avatar>
                    <span className="min-w-0"><span className="block truncate text-sm font-medium">{person.name || 'Veggat member'}</span><span className="block truncate text-xs text-muted-foreground">{person.reason || new Intl.NumberFormat().format(person.followerCount) + ' followers'}</span></span>
                  </Link>
                  <Button type="button" variant={person.isFollowing ? 'vegaNormalBtn' : 'vegaEmeraldBtn'} size="sm" className="h-9 shrink-0 px-2.5 text-xs"
                    disabled={!!busy || !!followError} aria-label={(person.isFollowing ? 'Unfollow ' : 'Follow ') + (person.name || 'member')}
                    onClick={() => toggleFollow(person)}>{busy === person.id ? 'Saving…' : person.isFollowing ? 'Following' : 'Follow'}</Button>
                </li>)}</HoverChaser>}
        </div>
        {followError && <div role="alert" className="mt-3 space-y-2"><p className="text-sm text-destructive">{followError}</p><Button type="button" variant="vegaNormalBtn" className="h-11" onClick={refresh}>Refresh people</Button></div>}
      </>}
    </section>
  );
}
