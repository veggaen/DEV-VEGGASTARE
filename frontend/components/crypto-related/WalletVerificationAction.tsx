/** @fileOverview Accessible verification controls shared by Settings and the sidebar. @stability evolving */
'use client';
import { useId, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { UseWalletVerifyReturn } from '@/hooks/use-wallet-verify';

export function WalletVerificationAction({ flow, disabled = false }: { flow: UseWalletVerifyReturn; disabled?: boolean }) {
  const id = useId(), [code, setCode] = useState('');
  const busy = ['preparing', 'in-wallet', 'waiting'].includes(flow.step);
  const status = flow.step === 'preparing' ? 'Preparing request…' : flow.step === 'in-wallet' ? 'Continue in your wallet…'
    : flow.step === 'waiting' ? 'Checking signature…' : flow.step === 'success' ? 'Wallet verified' : flow.needsCode ? 'Enter the code sent to your email.' : '';
  return <div className="min-w-0 space-y-2 text-sm">
    <p role="status" className="empty:hidden text-muted-foreground">{flow.error || status}</p>
    {flow.step !== 'success' && <form className="space-y-2" onSubmit={event => { event.preventDefault(); void flow.verify(flow.needsCode ? code : undefined); }}>
      {flow.needsCode && <div className="max-w-xs space-y-1">
        <label htmlFor={id}>Email verification code</label>
        <Input id={id} name="wallet-verification-code" value={code} onChange={event => setCode(event.target.value)}
          inputMode="numeric" autoComplete="one-time-code" spellCheck={false} pattern="[0-9]{6}" maxLength={6}
          required disabled={busy || disabled} aria-invalid={Boolean(flow.error)} className="h-11 text-base tabular-nums tracking-widest" />
      </div>}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" variant="outline" disabled={busy || disabled} className="min-h-11 whitespace-normal">
          {busy ? 'Verifying…' : flow.needsCode ? 'Verify code & sign' : flow.step === 'error' ? 'Try verification again' : 'Verify ownership'}
        </Button>
        {flow.step !== 'idle' && <Button type="button" variant="ghost" className="min-h-11" onClick={() => { setCode(''); flow.reset(); }}>Cancel</Button>}
      </div>
    </form>}
  </div>;
}
