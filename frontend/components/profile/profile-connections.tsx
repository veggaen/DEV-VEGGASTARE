'use client';
/** @fileOverview Real paginated profile connections with accessible filters and recovery. @stability stable */
import useSWRInfinite from 'swr/infinite';
import Link from '@/components/ui/navigation-link';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { profileRequest } from '@/lib/profile-request';

interface ConnectionPage { users: { id: string; name: string | null; image: string | null; bio: string | null }[]; nextCursor: string | null; total: number }
export default function ProfileConnections({ userId, viewerId, kind, onKindChange }: { userId: string; viewerId?: string; kind: 'followers' | 'following'; onKindChange: (kind: 'followers' | 'following') => void }) {
  const { data, error, isLoading, isValidating, mutate, setSize } = useSWRInfinite<ConnectionPage>(
    (index, previous) => !viewerId || (index > 0 && !previous?.nextCursor) ? null : [`/api/users/${encodeURIComponent(userId)}/${kind}?limit=20${index ? '&cursor=' + encodeURIComponent(previous!.nextCursor!) : ''}`, viewerId],
    async ([url]: [string, string]) => { const result = await profileRequest(url); if (!Array.isArray(result.users)) throw new Error('Could not load connections. Please try again.'); return result; },
    { revalidateOnFocus: false, shouldRetryOnError: false, dedupingInterval: 0 },
  );
  const users = data?.flatMap(page => page.users) ?? [];
  return <section aria-label="Profile connections">
    <div className="mb-4 grid grid-cols-2 gap-1 rounded-xl bg-muted/40 p-1" role="group" aria-label="Connection filters">{(['followers', 'following'] as const).map(value => <Button key={value} variant={value === kind ? 'secondary' : 'ghost'} className="h-11" aria-pressed={value === kind} onClick={() => onKindChange(value)}>{value === 'followers' ? 'Followers' : 'Following'}</Button>)}</div>
    {error && <div role="alert" className="mb-4 rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm"><p>Connections could not load. Please try again.</p><Button className="mt-3 h-11" variant="outline" onClick={() => void mutate()}>Try again</Button></div>}
    {isLoading ? <div role="status" aria-label="Loading connections" className="space-y-3">{[0, 1, 2].map(i => <div key={i} className="h-28 rounded-xl border border-border bg-muted/30 motion-safe:animate-pulse" />)}</div> : users.length ? <><p className="mb-3 text-sm text-muted-foreground">{data?.[0]?.total ?? users.length} {kind}</p><ul aria-label={kind === 'followers' ? 'Followers' : 'Following'} className="space-y-3">{users.map(user => <li key={user.id} className="flex min-w-0 flex-wrap items-start gap-3 rounded-xl border border-border bg-card p-4">
      <Avatar className="h-11 w-11 shrink-0"><AvatarImage src={user.image ?? undefined} alt="" loading="lazy" /><AvatarFallback>{user.name?.slice(0, 1) ?? '?'}</AvatarFallback></Avatar>
      <div className="min-w-0 flex-1"><h3 className="break-words text-sm font-semibold [overflow-wrap:anywhere]">{user.name || 'Veggat member'}</h3>{user.bio && <p className="mt-1 line-clamp-2 break-words text-sm text-muted-foreground [overflow-wrap:anywhere]">{user.bio}</p>}</div>
      <Button asChild variant="outline" className="h-11 w-full sm:w-auto"><Link href={'/profile/' + encodeURIComponent(user.id)}>View profile<span className="sr-only"> of {user.name || 'Veggat member'}</span></Link></Button>
    </li>)}</ul></> : !error && <div className="rounded-2xl border border-dashed border-border px-6 py-10 text-center"><h2 className="text-lg font-semibold">{kind === 'followers' ? 'No followers yet' : 'Not following anyone yet'}</h2><p className="mt-2 text-sm text-muted-foreground">{kind === 'followers' ? 'People following this profile will appear here.' : 'Profiles followed by this person will appear here.'}</p></div>}
    {data?.at(-1)?.nextCursor && <Button className="mt-4 h-11" variant="outline" disabled={isValidating} onClick={() => void setSize(size => size + 1)}>{isValidating ? 'Loading…' : 'Load more connections'}</Button>}
  </section>;
}
