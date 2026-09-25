'use client';
import { useId, useRef, useState } from 'react';
import { Dialog, DialogTrigger, DialogHeader, DialogContent, DialogFooter, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { PERMISSION_GROUPS, PERMISSION_LABELS } from '@/lib/permissions';
import { TEAM_PERMISSION_KEYS } from '@/lib/company-team-policy';
import { submitTeamChange, TeamClientError } from '@/lib/company-team-client';
import type { ExtendedCompany, ExtendedEmployee } from '@/lib/types/company-management';
import type { EmployeePermissions } from '@/lib/types/company-permissions';

const extra = TEAM_PERMISSION_KEYS.filter(key => !(key in PERMISSION_LABELS));
const groups = [...Object.values(PERMISSION_GROUPS), { label: 'Tax & fulfilment', permissions: extra }];
export default function EditEmployeePermissionsModal({ company, selectedEmployee, setCompany, allowedPermissions = TEAM_PERMISSION_KEYS }: {
  company: ExtendedCompany; selectedEmployee: ExtendedEmployee; setCompany: React.Dispatch<React.SetStateAction<ExtendedCompany | null>>;
  allowedPermissions?: readonly (keyof EmployeePermissions)[];
}) {
  const id = useId(), lock = useRef(false), reviewed = useRef(selectedEmployee);
  const [open, setOpen] = useState(false), [pending, setPending] = useState(false), [blocked, setBlocked] = useState(false);
  const [draft, setDraft] = useState<EmployeePermissions>({}), [error, setError] = useState('');
  const changeOpen = (value: boolean) => {
    if (lock.current) return;
    if (!value && Object.keys(draft).length && !window.confirm('Discard these unsaved permission changes?')) return;
    if (value) { reviewed.current = selectedEmployee; setDraft({}); setError(''); }
    setOpen(value);
  };
  const save = async () => {
    if (lock.current || blocked || !Object.keys(draft).length) return;
    lock.current = true; setPending(true); setError('');
    try {
      const row = await submitTeamChange({ kind: 'permissions', companyId: company.id, employeeId: selectedEmployee.id, expectedUpdatedAt: reviewed.current.updatedAt, permissions: draft as Record<string, boolean> });
      if (row) setCompany(previous => previous ? { ...previous, employees: previous.employees.map(member => member.id === row.id ? { ...row, user: { ...member.user, ...row.user } } : member) } : previous);
      setDraft({}); setOpen(false);
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Unable to save permissions.'); setBlocked(cause instanceof TeamClientError && cause.refreshRequired); }
    finally { lock.current = false; setPending(false); }
  };
  return <Dialog open={open} onOpenChange={changeOpen}>
    <DialogTrigger asChild><Button variant="outline" className="min-h-11">Edit permissions</Button></DialogTrigger>
    <DialogContent className="motion-reduce:animate-none! [&>button:last-child]:size-11 [&>button:last-child]:right-2 [&>button:last-child]:top-2 flex max-h-[calc(100dvh-2rem)] max-w-2xl flex-col gap-0 overflow-hidden border-border bg-card p-0 text-card-foreground">
      <DialogHeader className="shrink-0 border-b border-border p-5 pr-12"><DialogTitle>Edit permissions</DialogTitle><DialogDescription>{selectedEmployee.user.name || 'Team member'}</DialogDescription></DialogHeader>
      <div className="min-h-0 space-y-4 overflow-y-auto overscroll-contain p-4 sm:p-5">
        {groups.map(group => <fieldset key={group.label} className="rounded-lg border border-border p-3"><legend className="px-1 text-sm font-semibold">{group.label}</legend>
          <div className="grid gap-1 sm:grid-cols-2">{group.permissions.map(value => {
            const key = value as keyof EmployeePermissions, allowed = allowedPermissions.includes(key);
            return <label key={key} htmlFor={id + key} className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-2 text-sm has-disabled:cursor-default has-disabled:opacity-50 hover:bg-accent/50">
              <Checkbox id={id + key} disabled={!allowed || pending || blocked} checked={draft[key] ?? (reviewed.current.permissions[key] === true)} onCheckedChange={checked => setDraft(previous => {
                const next = { ...previous }; if ((reviewed.current.permissions[key] === true) === (checked === true)) delete next[key]; else next[key] = checked === true; return next;
              })} />
              <span>{PERMISSION_LABELS[key as keyof typeof PERMISSION_LABELS] || key.replace(/^CAN_/, '').toLowerCase().replaceAll('_', ' ')}</span>
            </label>;
          })}</div>
        </fieldset>)}
      </div>
      <DialogFooter className="shrink-0 gap-2 border-t border-border bg-card p-4">
        {error && <p role="alert" className="mr-auto max-w-sm text-sm text-destructive">{error}</p>}
        <Button variant="outline" className="min-h-11" disabled={pending} onClick={() => changeOpen(false)}>Cancel</Button>
        <Button className="min-h-11" disabled={pending || blocked || !Object.keys(draft).length} onClick={save}>{pending ? 'Saving…' : 'Save changes'}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>;
}
