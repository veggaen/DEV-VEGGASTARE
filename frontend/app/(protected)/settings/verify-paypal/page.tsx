/** @fileOverview Explicit, owner-bound approval of a receiving email; opening a link never changes it. @stability evolving */
'use client';
import { useEffect, useState, useTransition } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { reviewPaypalEmail, verifyPaypalEmail } from '@/actions/seller-payment';
import { Button } from '@/components/ui/button';
import { FiCheckCircle, FiMail } from 'react-icons/fi';

export default function VerifyPaypalPage() {
  const params = useSearchParams();
  const token = params.get('token') ?? '', type = params.get('type') ?? '', id = params.get('id') ?? '';
  const valid = /^[0-9a-f]{64}$/.test(token) && (type === 'user' || type === 'company') && (type !== 'company' || /^c[a-z0-9]{24,29}$/.test(id));
  const [review, setReview] = useState<{ email?: string; error?: string; success?: string } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [pending, startTransition] = useTransition();
  const settings = type === 'company' && /^c[a-z0-9]{24,29}$/.test(id) ? `/companies/${id}/settings` : '/settings?section=payments';
  useEffect(() => {
    if (!valid) return;
    let disposed = false;
    const timer = setTimeout(() => {
      if (!disposed) { disposed = true; setReview({ error: 'Verification could not load. Try again.' }); }
    }, 12_000);
    const target = type === 'company' ? { target: 'company' as const, companyId: id } : { target: 'user' as const };
    void reviewPaypalEmail({ ...target, token }).then(result => {
      if (!disposed) { clearTimeout(timer); setReview('data' in result ? result.data : result); }
    }).catch(() => { if (!disposed) { clearTimeout(timer); setReview({ error: 'Verification could not load. Try again.' }); } });
    return () => { disposed = true; clearTimeout(timer); };
  }, [valid, type, id, token, attempt]);
  const verify = () => startTransition(async () => {
    const target = type === 'company' ? { target: 'company' as const, companyId: id } : { target: 'user' as const };
    try { setReview(await verifyPaypalEmail({ ...target, token })); }
    catch { setReview({ error: 'Verification could not complete. Request a new link in payment settings.' }); }
  });
  return <section className="mx-auto w-full max-w-xl px-4 py-8 sm:px-6 sm:py-12">
    <div className="space-y-5 rounded-2xl border border-border bg-card p-5 sm:p-8">
      {review?.success ? <FiCheckCircle aria-hidden="true" className="size-8 text-brand-accent" /> : <FiMail aria-hidden="true" className="size-8 text-muted-foreground" />}
      <h1 className="text-balance text-2xl font-semibold">{review?.success ? 'Receiving email verified' : 'Verify receiving email'}</h1>
      {!valid ? <p role="alert" className="text-sm text-destructive">Invalid link. Request a new one in payment settings.</p>
        : review?.error ? <p role="alert" className="text-sm text-destructive">{review.error}</p>
        : review?.email ? <><p className="break-all font-medium">{review.email}</p><p className="text-sm text-muted-foreground">Confirm this as your receiving email. This verifies inbox access only.</p></>
        : !review?.success ? <p role="status" className="text-sm text-muted-foreground">Checking verification link…</p> : null}
      <div className="flex flex-wrap gap-3">
        {review?.email && <Button className="min-h-11" disabled={pending} onClick={verify}>{pending ? 'Verifying…' : 'Verify this email'}</Button>}
        {valid && review?.error && <Button className="min-h-11" variant="outline" onClick={() => { setReview(null); setAttempt(value => value + 1); }}>Retry verification</Button>}
        <Button asChild variant={review?.success ? 'default' : 'outline'} className="min-h-11"><Link href={settings}>Payment settings</Link></Button>
      </div>
    </div>
  </section>;
}
