'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** The return URL is only a hint: the server independently verifies capture. */
export default function PaymentVerification({ orderId }: { orderId: string }) {
  const started = useRef<string | null>(null);
  const [error, setError] = useState('');
  const verify = useCallback(async (): Promise<string> => {
    try {
      const response = await fetch('/api/checkout/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId }),
      });
      if (!response.ok) {
        return 'Payment could not be verified yet. You can safely retry without placing another order.';
      }
      window.location.replace(`/checkout/receipt/${encodeURIComponent(orderId)}`);
      return '';
    } catch {
      return 'Verification was interrupted. You can safely retry.';
    }
  }, [orderId]);

  useEffect(() => {
    if (started.current !== orderId) {
      started.current = orderId;
      void verify().then(setError);
    }
  }, [orderId, verify]);

  return (
    <section className="mx-auto w-full min-w-0 max-w-6xl px-4 py-6 sm:px-6 sm:py-8 lg:px-8">
      <header className="mb-6"><p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">PayPal checkout</p><h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">Verifying your payment</h1></header>
      <div className="rounded-xl border border-border bg-card p-5" role="status" aria-live="polite">
        {error ? <p className="text-sm text-destructive">{error}</p> : (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" />
            Confirming payment with PayPal…
          </p>
        )}
      </div>
      {!error && <div aria-hidden="true" className="mt-5 grid min-w-0 items-start gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(20rem,1fr)] lg:gap-6">
        <div className="space-y-5"><div className="h-44 rounded-2xl border border-border bg-foreground/[0.04] p-6"><div className="h-5 w-44 max-w-full rounded bg-muted motion-safe:animate-pulse" /><div className="mt-4 h-3 w-56 max-w-full rounded bg-muted motion-safe:animate-pulse" /><div className="mt-5 h-11 w-44 max-w-full rounded-lg bg-muted motion-safe:animate-pulse" /></div><div className="h-28 rounded-2xl border border-border bg-foreground/[0.04]" /></div>
        <div className="h-72 space-y-6 rounded-2xl border border-border bg-card p-6">{[0, 1, 2, 3].map(row => <div key={row} className="h-4 rounded bg-muted motion-safe:animate-pulse" />)}</div>
      </div>}
      {error && <Button className="mt-6 min-h-11" onClick={() => {
        setError('');
        void verify().then(setError);
      }}>Retry verification</Button>}
      <Link href={`/my-orders?order=${encodeURIComponent(orderId)}`} className="mt-3 inline-flex min-h-11 items-center rounded text-sm underline underline-offset-4 focus-visible:outline focus-visible:outline-2">View this order</Link>
    </section>
  );
}
