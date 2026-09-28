/** @fileOverview Explicit Web3 confirmation and non-optimistic loading state. @stability evolving */
'use client';
import { useEffect, useId, useRef, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useQueryClient } from '@tanstack/react-query';
import { useWeb3Mode } from '@/hooks/use-web3-mode';
import { isDemoUserId } from '@/lib/demo-policy';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';

export function Web3ModeControl() {
  const query = useWeb3Mode(), cache = useQueryClient();
  const { data: session, status, update } = useSession();
  const [pending, setPending] = useState<{ enabled: boolean; expectedEnabled: boolean } | null>(null);
  const [needsCode, setNeedsCode] = useState(false), [code, setCode] = useState('');
  const [busy, setBusy] = useState(false), [uncertain, setUncertain] = useState(false);
  const [error, setError] = useState(''), [notice, setNotice] = useState('');
  const active = useRef(false), mounted = useRef(false), inputId = useId(), trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const close = () => { if (active.current || uncertain) return; setPending(null); setNeedsCode(false); setCode(''); setError(''); };
  const submit = async () => {
    if (!pending || active.current || uncertain || (needsCode && !/^\d{6}$/.test(code))) return;
    active.current = true; setBusy(true); setError('');
    const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 20_000);
    try {
      const response = await fetch('/api/settings/web3-mode', { method: 'PATCH', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...pending, ...(needsCode ? { code } : {}) }), signal: controller.signal });
      const body = await response.json();
      if (!mounted.current) return;
      if (!response.ok) {
        if (response.status >= 500 || response.status === 409) setUncertain(true);
        setError(typeof body.error === 'string' ? body.error : 'Could not confirm the change. Refresh settings.'); return;
      }
      if (body.twoFactor === true) { setNeedsCode(true); setCode(''); return; }
      if (body.success !== true || body.web3ModeEnabled !== pending.enabled) throw new Error('Unconfirmed result');
      cache.setQueryData(['web3-mode', session?.user?.id], body.web3ModeEnabled);
      try { localStorage.setItem('veggastare:web3ModeEnabled', String(body.web3ModeEnabled)); } catch { /* Optional preference cache. */ }
      setPending(null); setNeedsCode(false); setCode(''); setNotice(pending.enabled ? 'Web3 enabled.' : 'Web3 disabled.');
      // A failed JWT refresh cannot undo an acknowledged database write.
      try { await update(); } catch { if (mounted.current) setNotice('Saved. Reload to update the rest of the app.'); }
    } catch { if (mounted.current) { setUncertain(true); setError('Could not confirm the change. Reload settings before trying again.'); } }
    finally { clearTimeout(timer); active.current = false; if (mounted.current) setBusy(false); }
  };
  if (query.isError) return <div className="text-right"><p role="alert" className="text-sm text-destructive">Could not load.</p><Button type="button" variant="outline" className="min-h-11" onClick={() => void query.refetch()}>Retry Web3 settings</Button></div>;
  if (status !== 'authenticated' || query.data === undefined) return <span role="status" className="text-sm text-muted-foreground">Loading…</span>;
  return <div className="shrink-0">
    <Switch ref={trigger} aria-label="Toggle Web3 mode" aria-haspopup="dialog" checked={query.data} disabled={busy || uncertain || isDemoUserId(session?.user?.id)}
      onCheckedChange={enabled => { setPending({ enabled, expectedEnabled: query.data! }); setNotice(''); }} />
    <Dialog open={!!pending} onOpenChange={open => { if (!open) close(); }}>
      <DialogContent hideCloseButton onCloseAutoFocus={event => { event.preventDefault(); trigger.current?.focus(); }} className="max-h-[calc(100dvh-2rem)] w-[calc(100%-2rem)] max-w-md overflow-y-auto overscroll-contain rounded-xl motion-reduce:animate-none">
        <DialogTitle>{pending?.enabled ? 'Enable Web3?' : 'Disable Web3?'}</DialogTitle>
        <DialogDescription>{pending?.enabled ? 'Enable wallet sign-in and experimental tools. This does not connect a wallet or move funds.' : 'Wallet sign-in and experimental tools will turn off. Saved wallets and payout addresses stay unchanged.'}</DialogDescription>
        <form className="space-y-4" onSubmit={event => { event.preventDefault(); void submit(); }}>
          {needsCode && <div className="space-y-2">
            <p role="status" className="text-sm text-muted-foreground">Enter the code sent to your verified email.</p>
            <label htmlFor={inputId} className="block text-sm font-medium">Email code</label>
            <Input id={inputId} name="web3ModeCode" value={code} onChange={event => setCode(event.target.value)} required pattern="[0-9]{6}"
              maxLength={6} inputMode="numeric" autoComplete="one-time-code" spellCheck={false} disabled={busy || uncertain}
              aria-invalid={!!error} aria-describedby={error ? `${inputId}-error` : undefined} className="h-12 text-base" />
          </div>}
          {error && <p id={`${inputId}-error`} role="alert" className="text-sm text-destructive">{error}</p>}
          {uncertain ? <Button type="button" className="min-h-12 w-full" onClick={() => window.location.reload()}>Reload settings</Button>
            : <div className="flex flex-wrap gap-2">
              <Button type="submit" className="min-h-12 flex-1" disabled={busy}>{busy ? 'Confirming…' : pending?.enabled ? 'Confirm enable' : 'Confirm disable'}</Button>
              <Button type="button" variant="outline" className="min-h-12" disabled={busy} onClick={close}>Cancel</Button>
            </div>}
        </form>
      </DialogContent>
    </Dialog>
    {notice && <p role="status" className="mt-2 max-w-48 text-sm text-muted-foreground">{notice}</p>}
  </div>;
}
