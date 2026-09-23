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
    <section className="mx-auto w-full max-w-xl px-4 py-12 sm:px-6">
      <h1 className="text-2xl font-semibold">Verifying your payment</h1>
      <div className="mt-4" role="status" aria-live="polite">
        {error ? <p className="text-sm text-destructive">{error}</p> : (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 aria-hidden="true" className="size-4 animate-spin motion-reduce:animate-none" />
            Confirming payment with PayPal…
          </p>
        )}
      </div>
      {error && <Button className="mt-6 min-h-11" onClick={() => {
        setError('');
        void verify().then(setError);
      }}>Retry verification</Button>}
      <Link href="/cart" className="mt-6 block w-fit rounded text-sm underline underline-offset-4 focus-visible:outline focus-visible:outline-2">Back to cart</Link>
    </section>
  );
}
