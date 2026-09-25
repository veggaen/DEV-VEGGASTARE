'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { TEAM_ROLES, teamRoleLabel } from '@/lib/company-team-policy';
import { submitTeamChange, TeamClientError } from '@/lib/company-team-client';
import type { ExtendedEmployee } from '@/lib/types/company-management';
type Candidate = { id: string; name: string; email?: string | null };
export function MyNewEmployeeForm({ companyId, handleNewEmployee, allowedRoles = [...TEAM_ROLES], excludedUserIds = [] }: {
  companyId: string; handleNewEmployee?: (employee: ExtendedEmployee) => void;
  allowedRoles?: readonly string[]; excludedUserIds?: string[];
}) {
  const id = useId(), lock = useRef(false), searchSequence = useRef(0), input = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState(''), [users, setUsers] = useState<Candidate[]>([]), [selected, setSelected] = useState<Candidate | null>(null);
  const [role, setRole] = useState('USER'), [jobTitle, setJobTitle] = useState('');
  const [searching, setSearching] = useState(false), [open, setOpen] = useState(false), [highlight, setHighlight] = useState(-1);
  const [pending, setPending] = useState(false), [blocked, setBlocked] = useState(false), [error, setError] = useState(''), [searchError, setSearchError] = useState(''), [success, setSuccess] = useState('');
  useEffect(() => {
    const sequence = ++searchSequence.current;
    if (selected || query.trim().length < 2) { setUsers([]); setSearching(false); setSearchError(''); return; }
    const controller = new AbortController(); setSearching(true); setSearchError(''); setUsers([]);
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch('/api/users/search?q=' + encodeURIComponent(query.trim()) + '&limit=10', { cache: 'no-store', signal: AbortSignal.any([controller.signal, AbortSignal.timeout(12_000)]) });
        const result = await response.json();
        if (!response.ok || !Array.isArray(result.users)) throw new Error('Search unavailable');
        if (sequence === searchSequence.current && !controller.signal.aborted) { setUsers(result.users.filter((user: Candidate) => !excludedUserIds.includes(user.id))); setHighlight(-1); }
      } catch { if (!controller.signal.aborted && sequence === searchSequence.current) setSearchError('Search could not load. Edit the name to try again.'); }
      finally { if (sequence === searchSequence.current && !controller.signal.aborted) setSearching(false); }
    }, 250);
    return () => { controller.abort(); window.clearTimeout(timer); };
  }, [query, selected, excludedUserIds]);
  const choose = (user: Candidate) => { setSelected(user); setQuery(user.name); setOpen(false); setError(''); };
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); if (lock.current || blocked) return;
    if (!selected) { setError('Select a person from the search results.'); input.current?.focus(); return; }
    lock.current = true; setPending(true); setError(''); setSuccess('');
    try {
      const row = await submitTeamChange({ kind: 'add', companyId, userId: selected.id, role: role as typeof TEAM_ROLES[number], jobTitle });
      if (row) handleNewEmployee?.(row);
      setSuccess('Team member added.'); setSelected(null); setQuery(''); setJobTitle(''); setRole('USER');
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to add member.'); setBlocked(cause instanceof TeamClientError && cause.refreshRequired); }
    finally { lock.current = false; setPending(false); }
  };
  const field = 'min-h-11 w-full min-w-0 rounded-md border border-input bg-background px-3 text-base text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring';
  return <form onSubmit={submit} className="grid min-w-0 gap-4 md:grid-cols-2" aria-label="Add team member">
    <div className="relative min-w-0 md:col-span-2" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setOpen(false); }}>
      <label htmlFor={id + 'search'} className="mb-2 block text-sm font-medium">Search user</label>
      <input ref={input} id={id + 'search'} name="teamMemberSearch" autoComplete="off" spellCheck={false} maxLength={100} className={field} placeholder="Type a name…" role="combobox" aria-expanded={open && query.trim().length >= 2 && !selected} aria-controls={id + 'results'} aria-autocomplete="list" aria-activedescendant={open && highlight >= 0 ? id + 'option' + highlight : undefined} value={query} disabled={pending || blocked}
        onFocus={() => setOpen(true)} onChange={event => { setSelected(null); setQuery(event.target.value); setUsers([]); setOpen(true); setHighlight(-1); setSuccess(''); }}
        onKeyDown={event => {
          if (event.key === 'Escape') { setOpen(false); return; }
          if (open && users.length && ['ArrowDown', 'ArrowUp'].includes(event.key)) { event.preventDefault(); setHighlight(value => event.key === 'ArrowDown' ? (value + 1) % users.length : (value <= 0 ? users.length - 1 : value - 1)); }
          if (event.key === 'Enter' && open && !selected) { event.preventDefault(); if (highlight >= 0 && users[highlight]) choose(users[highlight]); }
        }} />
      {open && query.trim().length >= 2 && !selected && <div className="absolute z-20 mt-2 max-h-48 w-full overflow-y-auto overscroll-contain rounded-lg border border-border bg-popover p-1 text-popover-foreground shadow-lg">
        <div role="listbox" id={id + 'results'} aria-label="Matching people">{users.map((user, index) => <button type="button" role="option" aria-selected={highlight === index} id={id + 'option' + index} key={user.id} onMouseDown={event => event.preventDefault()} onClick={() => choose(user)} className={'flex min-h-11 w-full min-w-0 flex-col items-start rounded-md px-3 py-2 text-left text-sm focus-visible:ring-2 focus-visible:ring-ring ' + (highlight === index ? 'bg-accent' : 'hover:bg-accent')}><span className="max-w-full truncate font-medium">{user.name}</span>{user.email && <span className="max-w-full truncate text-muted-foreground">{user.email}</span>}</button>)}</div>
        {(searching || searchError || !users.length) && <p role={searchError ? 'alert' : 'status'} className="px-3 py-2 text-sm text-muted-foreground">{searching ? 'Searching…' : searchError || 'No matching people.'}</p>}
      </div>}
    </div>
    <label className="space-y-2 text-sm font-medium"><span>Role</span><select name="newTeamRole" value={role} disabled={pending || blocked} onChange={event => setRole(event.target.value)} className={field}>{allowedRoles.map(value => <option key={value} value={value}>{teamRoleLabel(value)}</option>)}</select></label>
    <label className="space-y-2 text-sm font-medium"><span>Job title (optional)</span><input name="teamJobTitle" autoComplete="off" maxLength={80} value={jobTitle} onChange={event => setJobTitle(event.target.value)} disabled={pending || blocked} className={field} /></label>
    <div className="flex flex-wrap items-center gap-3 md:col-span-2"><Button type="submit" className="min-h-11" disabled={pending || blocked}>{pending ? 'Adding…' : 'Add employee'}</Button>{selected && <p className="min-w-0 break-words text-sm text-muted-foreground">Selected: {selected.name}</p>}</div>
    {error && <p role="alert" className="text-sm text-destructive md:col-span-2">{error}</p>}
    {success && <p role="status" className="text-sm text-emerald-700 dark:text-emerald-300 md:col-span-2">{success}</p>}
  </form>;
}
