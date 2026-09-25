/** @fileOverview Compact, keyboard-accessible wallet sign-in feedback. @stability evolving */
'use client';
import { useId, useState } from 'react';
import type { useWalletSignIn } from '@/hooks/use-wallet-sign-in';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

export function WalletSignInProgress({ flow }: { flow: ReturnType<typeof useWalletSignIn> }) {
  const id = useId(), [code, setCode] = useState('');
  if (flow.phase === 'idle') return null;
  return <section className="min-w-0 space-y-3 rounded-xl border border-border bg-card p-4" aria-label="Wallet sign-in">
    <p role="status" className="text-sm">{flow.phase === 'two-factor' ? 'Check your email for a sign-in code.' : flow.phase === 'in-wallet' ? 'Confirm the free sign-in message in your wallet…' : flow.phase === 'preparing' ? 'Checking your wallet…' : flow.phase === 'signing-in' ? 'Signing in…' : 'Wallet sign-in'}</p>
    {flow.phase === 'two-factor' && <form className="space-y-3" onSubmit={event => { event.preventDefault(); void flow.submitCode(code); }}>
      <label htmlFor={id} className="block text-sm font-medium">Email code</label>
      <Input id={id} name="wallet-login-code" value={code} onChange={event => setCode(event.target.value)} inputMode="numeric" autoComplete="one-time-code" spellCheck={false} maxLength={6} pattern="[0-9]{6}" required className="h-12 text-base" aria-invalid={!!flow.error} aria-describedby={flow.error ? `${id}-error` : undefined} />
      <Button type="submit" className="min-h-11 w-full">Verify and sign in</Button>
    </form>}
    {flow.error && <p id={`${id}-error`} role="alert" className="text-sm text-destructive">{flow.error}</p>}
    {flow.phase === 'uncertain' ? <Button type="button" className="min-h-11" onClick={() => window.location.reload()}>Reload sign-in</Button>
      : flow.phase !== 'signing-in' && <Button type="button" variant="outline" className="min-h-11" onClick={() => { flow.cancel(); setCode(''); }}>{flow.phase === 'error' ? 'Dismiss' : 'Cancel sign-in'}</Button>}
  </section>;
}
