/**
 * @fileOverview  Accessible verification controls shared by Settings, the
 *                sidebar and the listing form: a quiet chip in the wallet card,
 *                a regular pill in Settings. Not a <form>: it is rendered inside
 *                other forms (the listing funnel), and nested forms are invalid
 *                HTML that breaks hydration. Enter in the code field submits.
 * @stability     evolving
 */
'use client';
import { useId, useState } from 'react';
import { FiShield } from 'react-icons/fi';
import { Input } from '@/components/ui/input';
import Spinner from '@/components/uicustom/spinner';
import type { UseWalletVerifyReturn } from '@/hooks/use-wallet-verify';
import { cn } from '@/lib/utils';

export function WalletVerificationAction({ flow, disabled = false, size = 'md' }: { flow: UseWalletVerifyReturn; disabled?: boolean; size?: 'sm' | 'md' }) {
  const id = useId(), [code, setCode] = useState('');
  const busy = ['preparing', 'in-wallet', 'waiting'].includes(flow.step);
  const status = flow.step === 'preparing' ? 'Preparing request…' : flow.step === 'in-wallet' ? 'Continue in your wallet…'
    : flow.step === 'waiting' ? 'Checking signature…' : flow.step === 'success' ? 'Wallet verified' : flow.needsCode ? 'Enter the code sent to your email.' : '';
  const small = size === 'sm';
  const submit = () => {
    if (busy || disabled) return;
    if (flow.needsCode && !/^[0-9]{6}$/.test(code)) return;
    void flow.verify(flow.needsCode ? code : undefined);
  };
  return <div className={cn('min-w-0 space-y-1.5', small ? 'text-xs' : 'text-sm')}>
    <p role="status" className={cn('text-muted-foreground empty:hidden', small ? 'text-[10px]' : 'text-xs')}>{flow.error || status}</p>
    {flow.step !== 'success' && <div role="group" aria-label="Verify wallet ownership" className="space-y-2">
      {flow.needsCode && <div className="max-w-xs space-y-1">
        <label htmlFor={id} className="text-xs text-muted-foreground">Email verification code</label>
        <Input id={id} name="wallet-verification-code" value={code} onChange={event => setCode(event.target.value)}
          onKeyDown={event => { if (event.key === 'Enter') { event.preventDefault(); submit(); } }}
          inputMode="numeric" autoComplete="one-time-code" spellCheck={false} pattern="[0-9]{6}" maxLength={6}
          required disabled={busy || disabled} aria-invalid={Boolean(flow.error)} className="h-11 text-base tabular-nums tracking-widest" />
      </div>}
      <div className="flex flex-wrap items-center gap-1.5">
        {/* Small: a quiet text chip that reads as an action without competing with the balance line. */}
        <button type="button" onClick={submit} disabled={busy || disabled}
          className={cn(
            'inline-flex items-center gap-1 rounded-full font-semibold text-brand-accent-hover transition-[background-color,border-color] duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50 dark:text-brand-accent-light',
            small
              ? 'min-h-7 px-2 text-[10px] hover:bg-brand-accent/10'
              : 'min-h-9 border border-brand-accent/40 bg-brand-accent/10 px-3 text-xs hover:border-brand-accent/60 hover:bg-brand-accent/15',
          )}>
          {busy ? <Spinner className={small ? 'size-3' : 'size-3.5'} /> : <FiShield className={small ? 'size-3' : 'size-3.5'} aria-hidden="true" />}
          {busy ? 'Verifying…' : flow.needsCode ? 'Verify code & sign' : flow.step === 'error' ? 'Try again' : 'Verify ownership'}
        </button>
        {flow.step !== 'idle' && <button type="button" onClick={() => { setCode(''); flow.reset(); }}
          className={cn('rounded-full px-2.5 font-medium text-muted-foreground transition-colors hover:bg-foreground/[0.05] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring', small ? 'min-h-7 text-[10px]' : 'min-h-9 text-xs')}>
          Cancel
        </button>}
      </div>
    </div>}
  </div>;
}
