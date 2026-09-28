'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';

/** Compact recovery states shared by company settings and the internal hub. */
export function CompanyReadNotice({ companyId, status, retry, section = 'settings' }: { companyId: string; status: number | null; retry: () => void; section?: 'settings' | 'hub' }) {
  const restricted = status === 403 || status === 404;
  return <section className="mx-auto w-full max-w-xl px-4 py-8 sm:px-6" aria-labelledby="company-access-title">
    <div className="rounded-xl border border-border bg-card p-5 text-card-foreground sm:p-6">
      <h1 id="company-access-title" className="text-xl font-semibold tracking-tight">
        {status === 401 ? 'Sign in to your company' : restricted ? 'Company access unavailable' : 'Company could not load'}
      </h1>
      <p role="status" className="mt-2 text-sm text-muted-foreground">
        {status === 401 ? 'Use the account linked to this company.' : restricted ? 'This company is unavailable or you are not a current member.' : 'Check your connection and try again.'}
      </p>
      <div className="mt-5 flex flex-wrap gap-2">
        {status === 401 ? <Button asChild className="min-h-11"><Link href={`/auth/login?callbackUrl=${encodeURIComponent(`/companies/${companyId}/${section}`)}`}>Sign in</Link></Button>
          : !restricted ? <Button onClick={retry} className="min-h-11">Try again</Button> : null}
        <Button asChild variant="outline" className="min-h-11"><Link href={`/companies/${encodeURIComponent(companyId)}`}>Public profile</Link></Button>
        <Button asChild variant="ghost" className="min-h-11"><Link href="/companies">All companies</Link></Button>
      </div>
    </div>
  </section>;
}
