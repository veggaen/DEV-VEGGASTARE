'use client';
import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { submitTeamChange, TeamClientError } from '@/lib/company-team-client';
export function RemoveEmployeeButton({ userId, employeeId, expectedUpdatedAt, companyId, name, onSuccess, onError }: {
  userId: string; employeeId: string; expectedUpdatedAt: string; companyId: string; name: string;
  onSuccess: (userId: string) => void; onError: (message: string) => void;
}) {
  const lock = useRef(false), reviewed = useRef(expectedUpdatedAt);
  const [open, setOpen] = useState(false), [pending, setPending] = useState(false), [blocked, setBlocked] = useState(false), [error, setError] = useState('');
  const changeOpen = (value: boolean) => { if (lock.current) return; if (value) { reviewed.current = expectedUpdatedAt; setError(''); } setOpen(value); };
  const remove = async () => {
    if (lock.current || blocked) return; lock.current = true; setPending(true);
    try { await submitTeamChange({ kind: 'remove', companyId, employeeId, expectedUpdatedAt: reviewed.current }); onSuccess(userId); setOpen(false); }
    catch (cause) { const message = cause instanceof Error ? cause.message : 'Unable to remove member.'; setError(message); onError(message); setBlocked(cause instanceof TeamClientError && cause.refreshRequired); }
    finally { lock.current = false; setPending(false); }
  };
  return <Dialog open={open} onOpenChange={changeOpen}>
    <DialogTrigger asChild><Button variant="outline" className="min-h-11 text-destructive">Remove</Button></DialogTrigger>
    <DialogContent className="motion-reduce:animate-none! [&>button:last-child]:size-11 [&>button:last-child]:right-2 [&>button:last-child]:top-2 max-h-[calc(100dvh-2rem)] overflow-y-auto border-border bg-card text-card-foreground">
      <DialogHeader><DialogTitle>Remove team member?</DialogTitle><DialogDescription>{name} will lose company access. Their personal account stays active.</DialogDescription></DialogHeader>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <DialogFooter className="gap-2"><Button variant="outline" className="min-h-11" disabled={pending} onClick={() => changeOpen(false)}>Keep member</Button><Button variant="destructive" className="min-h-11" disabled={pending || blocked} onClick={remove}>{pending ? 'Removing…' : 'Remove member'}</Button></DialogFooter>
    </DialogContent>
  </Dialog>;
}
