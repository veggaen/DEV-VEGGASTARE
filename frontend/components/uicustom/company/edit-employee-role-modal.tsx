'use client';
import { useId, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogTrigger, DialogHeader, DialogContent, DialogFooter, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import type { ExtendedCompany, ExtendedEmployee } from '@/lib/types/company-management';
import { TEAM_ROLES, teamRoleLabel } from '@/lib/company-team-policy';
import { submitTeamChange, TeamClientError } from '@/lib/company-team-client';

export default function EditEmployeeRoleModal({ selectedEmployee, company, setCompany, allowedRoles = [...TEAM_ROLES] }: {
  company: ExtendedCompany; selectedEmployee: ExtendedEmployee; setCompany: React.Dispatch<React.SetStateAction<ExtendedCompany | null>>;
  allowedRoles?: readonly string[];
}) {
  const id = useId(), lock = useRef(false);
  const [open, setOpen] = useState(false), [pending, setPending] = useState(false), [blocked, setBlocked] = useState(false);
  const [role, setRole] = useState(selectedEmployee.role), [error, setError] = useState('');
  const reviewed = useRef(selectedEmployee.updatedAt);
  const changeOpen = (value: boolean) => {
    if (lock.current) return;
    if (value) { setRole(selectedEmployee.role); reviewed.current = selectedEmployee.updatedAt; setError(''); }
    setOpen(value);
  };
  const save = async () => {
    if (lock.current || blocked) return;
    lock.current = true; setPending(true); setError('');
    try {
      const row = await submitTeamChange({ kind: 'role', companyId: company.id, employeeId: selectedEmployee.id, expectedUpdatedAt: reviewed.current, newRole: role });
      if (row) setCompany(previous => previous ? { ...previous, employees: previous.employees.map(member => member.id === row.id ? { ...row, user: { ...member.user, ...row.user } } : member) } : previous);
      setOpen(false);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to save role.'); setBlocked(cause instanceof TeamClientError && cause.refreshRequired); }
    finally { lock.current = false; setPending(false); }
  };
  return <Dialog open={open} onOpenChange={changeOpen}>
    <DialogTrigger asChild><Button variant="outline" className="min-h-11">Edit role</Button></DialogTrigger>
    <DialogContent className="motion-reduce:animate-none! [&>button:last-child]:size-11 [&>button:last-child]:right-2 [&>button:last-child]:top-2 max-h-[calc(100dvh-2rem)] overflow-y-auto overscroll-contain border-border bg-card text-card-foreground">
      <DialogHeader><DialogTitle>Edit role</DialogTitle><DialogDescription>{selectedEmployee.user.name || 'Team member'}</DialogDescription></DialogHeader>
      <label htmlFor={id} className="space-y-2 text-sm font-medium"><span>Role</span>
        <select id={id} name="teamRole" value={role} onChange={event => setRole(event.target.value as typeof role)} disabled={pending || blocked} className="min-h-11 w-full rounded-md border border-input bg-background px-3 text-base text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          {!allowedRoles.includes(selectedEmployee.role) && <option value={selectedEmployee.role} disabled>{teamRoleLabel(selectedEmployee.role)}</option>}
          {allowedRoles.map(value => <option key={value} value={value}>{teamRoleLabel(value)}</option>)}
        </select>
      </label>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <DialogFooter className="gap-2"><Button variant="outline" className="min-h-11" disabled={pending} onClick={() => changeOpen(false)}>Cancel</Button><Button className="min-h-11" onClick={save} disabled={pending || blocked || role === selectedEmployee.role}>{pending ? 'Saving…' : 'Save role'}</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}
