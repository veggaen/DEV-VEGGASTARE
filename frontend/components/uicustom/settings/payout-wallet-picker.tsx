/** @fileOverview Shared explicit receiving-wallet choices for a person or company. @stability evolving */
'use client';
import { useEffect, useId, useRef, useState } from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { setDefaultReceivingWallet, removeDefaultReceivingWallet } from '@/actions/seller-payment';
import type { PayoutChoice, PayoutTarget } from '@/lib/payout-wallet';

type Wallet = { id: string; label: string; address: string; verifiedAt: string | null; family?: string; scope?: 'personal' | 'company' };
type Props = {
  target: PayoutTarget; wallets: Wallet[]; selectedId: string | null; selectedAddress: string | null;
  loading?: boolean; disabled?: boolean; onChanged: () => Promise<void>;
  loadError?: boolean; onRetry?: () => void;
  web3Disabled?: boolean;
};
export function PayoutWalletPicker({ target, wallets, selectedId, selectedAddress, loading, disabled, onChanged, loadError, onRetry, web3Disabled }: Props) {
  const [pending, setPending] = useState<PayoutChoice | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [uncertain, setUncertain] = useState(false);
  const active = useRef(false), mounted = useRef(false);
  const inputId = useId();
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const run = async (choice: PayoutChoice, approvalCode?: string) => {
    if (active.current || disabled || uncertain || web3Disabled || loading || loadError) return;
    active.current = true; setBusy(true); setError(null); setMessage('');
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      const request = choice.action === 'set'
        ? setDefaultReceivingWallet({ ...target, walletId: choice.walletId, expectedWalletId: choice.expectedWalletId, code: approvalCode })
        : removeDefaultReceivingWallet({ ...target, expectedWalletId: choice.expectedWalletId, code: approvalCode });
      const result = await Promise.race([request, new Promise<never>((_, reject) => {
        timeout = setTimeout(() => reject(new Error('timeout')), 20_000);
      })]);
      if (!mounted.current) return;
      if ('error' in result) { setError(result.error); return; }
      if ('twoFactor' in result) { setPending(choice); setConfirmClear(false); setCode(''); setMessage('Code sent to your email.'); return; }
      setPending(null); setConfirmClear(false); setCode(''); setMessage(result.success);
      try { await onChanged(); } catch { if (mounted.current) setError('Saved. Refresh payment settings to see the latest choice.'); }
    } catch { if (mounted.current) { setUncertain(true); setError('We could not confirm the change. Refresh payment settings before trying again.'); } }
    finally { if (timeout) clearTimeout(timeout); active.current = false; if (mounted.current) setBusy(false); }
  };
  const blocked = !!disabled || busy || !!pending || confirmClear || uncertain || !!loadError || !!loading || !!web3Disabled;
  const verified = wallets.filter(wallet => wallet.verifiedAt);
  return <section aria-label="Receiving wallet" className="min-w-0 space-y-3 rounded-xl border border-border p-4">
    <div className="flex flex-wrap items-start justify-between gap-2">
      <div className="min-w-0">
        <h3 className="text-sm font-semibold">Receiving wallet</h3>
        <p className="mt-1 text-sm text-muted-foreground">{selectedAddress ? `${selectedAddress.slice(0,6)}…${selectedAddress.slice(-4)}` : 'No receiving wallet selected.'}</p>
      </div>
      {selectedId && <Button variant="outline" className="min-h-11" disabled={blocked} onClick={() => { setConfirmClear(true); setError(null); setMessage(''); }}>Clear selection</Button>}
    </div>
    {web3Disabled ? <p className="text-sm text-muted-foreground"><Link href="/settings?section=wallet" className="underline underline-offset-4">Enable Web3 mode</Link> to change the receiving wallet.</p>
      : loading ? <p role="status" className="text-sm text-muted-foreground">Loading verified wallets…</p>
      : loadError ? <div className="space-y-2"><p role="alert" className="text-sm text-destructive">Verified wallets could not load.</p><Button variant="outline" className="min-h-11" onClick={onRetry}>Retry wallets</Button></div>
      : verified.length ? <div className="grid gap-2">
        {verified.map(wallet => <button key={wallet.id} type="button" aria-label={`Use ${wallet.label} for receiving payments`}
          aria-pressed={wallet.id === selectedId} disabled={blocked || wallet.id === selectedId}
          onClick={() => void run({ action: 'set', walletId: wallet.id, expectedWalletId: selectedId })}
          className={`flex min-h-11 min-w-0 items-center gap-3 rounded-lg border p-3 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring ${wallet.id === selectedId ? 'border-brand-accent/50 bg-brand-accent/10' : 'border-border hover:bg-muted/60'} disabled:cursor-default`}>
          <span className="min-w-0 flex-1"><span className="block break-words text-sm font-medium">{wallet.label}</span>
            {wallet.scope && <span className="block text-xs text-muted-foreground">{wallet.scope === 'company' ? 'Company wallet' : 'Your wallet'}{wallet.family ? ` · ${wallet.family}` : ''}</span>}
            <span className="block break-all font-mono text-xs text-muted-foreground">{wallet.address}</span></span>
          {wallet.id === selectedId && <span className="shrink-0 text-xs font-medium text-brand-accent-hover dark:text-brand-accent-light">Selected</span>}
        </button>)}
      </div> : <p className="text-sm text-muted-foreground">No verified wallets available. <Link href="/settings?section=wallet" className="underline underline-offset-4">Connect and verify a wallet</Link>.</p>}
    {!uncertain && confirmClear && selectedId && <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-3">
      <p className="text-sm">Clear this receiving choice? Your wallet stays linked. No replacement is selected.</p>
      <div className="flex flex-wrap gap-2">
        <Button className="min-h-11" disabled={busy} onClick={() => void run({ action: 'clear', expectedWalletId: selectedId })}>{busy ? 'Confirming…' : 'Confirm clear selection'}</Button>
        <Button variant="outline" className="min-h-11" disabled={busy} onClick={() => { setConfirmClear(false); setError(null); }}>Keep selection</Button>
      </div>
    </div>}
    {!uncertain && pending && <form className="max-w-sm space-y-2" onSubmit={event => { event.preventDefault(); if (/^\d{6}$/.test(code)) void run(pending, code); }}>
      <label htmlFor={inputId} className="block text-sm font-medium">Email verification code</label>
      <Input id={inputId} name="payoutWalletCode" value={code} onChange={event => setCode(event.target.value)} required pattern="[0-9]{6}"
        inputMode="numeric" autoComplete="one-time-code" maxLength={6} spellCheck={false} disabled={busy} className="min-h-11 text-base"
        aria-invalid={!!error} aria-describedby={error ? `${inputId}-error` : undefined} />
      <div className="flex flex-wrap gap-2">
        <Button type="submit" disabled={busy} className="min-h-11">{busy ? 'Confirming…' : pending.action === 'clear' ? 'Confirm clear selection' : 'Confirm receiving wallet'}</Button>
        <Button type="button" variant="outline" disabled={busy} className="min-h-11" onClick={() => { setPending(null); setCode(''); setError(null); setMessage(''); }}>Cancel</Button>
      </div>
    </form>}
    {error && <p id={`${inputId}-error`} role="alert" className="text-sm text-destructive">{error}</p>}
    {uncertain && <Button variant="outline" className="min-h-11" onClick={() => window.location.reload()}>Refresh payment settings</Button>}
    <p role="status" className="text-sm text-muted-foreground">{message || (busy ? 'Confirming your choice…' : '')}</p>
  </section>;
}
