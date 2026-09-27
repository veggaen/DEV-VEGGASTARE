/** @fileOverview Accessible verification controls shared by Settings and the sidebar: one compact accent pill, not a block button. @stability evolving */
'use client';
import { useId, useState } from 'react';
import { FiShield } from 'react-icons/fi';
import { Input } from '@/components/ui/input';
import Spinner from '@/components/uicustom/spinner';
import type { UseWalletVerifyReturn } from '@/hooks/use-wallet-verify';

export function WalletVerificationAction({ flow, disabled = false }: { flow: UseWalletVerifyReturn; disabled?: boolean }) {
  const id = useId(), [code, setCode] = useState('');
  const busy = ['preparing', 'in-wallet', 'waiting'].includes(flow.step);
  const status = flow.step === 'preparing' ? 'Preparing request…' : flow.step === 'in-wallet' ? 'Continue in your wallet…'
    : flow.step === 'waiting' ? 'Checking signature…' : flow.step === 'success' ? 'Wallet verified' : flow.needsCode ? 'Enter the code sent to your email.' : '';
  return <div className="min-w-0 space-y-1.5 text-sm">
    <p role="status" className="text-xs text-muted-foreground empty:hidden">{flow.error || status}</p>
    {flow.step !== 'success' && <form className="space-y-2" onSubmit={event => { event.preventDefault(); void flow.verify(flow.needsCode ? code : undefined); }}>
      {flow.needsCode && <div className="max-w-xs space-y-1">
        <label htmlFor={id} className="text-xs text-muted-foreground">Email verification code</label>
        <Input id={id} name="wallet-verification-code" value={code} onChange={event => setCode(event.target.value)}
          inputMode="numeric" autoComplete="one-time-code" spellCheck={false} pattern="[0-9]{6}" maxLength={6}
          required disabled={busy || disabled} aria-invalid={Boolean(flow.error)} className="h-11 text-base tabular-nums tracking-widest" />
      </div>}
      <div className="flex flex-wrap items-center gap-1.5">
        <button type="submit" disabled={busy || disabled}
          className="inline-flex min-h-9 items-center gap-1.5 rounded-full border border-brand-accent/40 bg-brand-accent/10 px-3 text-xs font-semibold text-brand-accent-hover transition-[background-color,border-color] duration-200 hover:border-brand-accent/60 hover:bg-brand-accent/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 dark:text-brand-accent-light">
          {busy ? <Spinner className="size-3.5" /> : <FiShield className="size-3.5" aria-hidden="true" />}
          {busy ? 'Verifying…' : flow.needsCode ? 'Verify code & sign' : flow.step === 'error' ? 'Try again' : 'Verify ownership'}
        </button>
        {flow.step !== 'idle' && <button type="button" onClick={() => { setCode(''); flow.reset(); }}
          className="min-h-9 rounded-full px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-foreground/[0.05] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
          Cancel
        </button>}
      </div>
    </form>}
  </div>;
}
