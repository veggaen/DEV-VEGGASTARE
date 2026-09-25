'use client';

import { signOut, useSession } from 'next-auth/react';
import { useState } from 'react';
import { FiEye } from 'react-icons/fi';
import { Button } from '@/components/ui/button';

/** In the app-shell flow, so it cannot cover navigation or keyboard focus. */
export default function ImpersonationBanner() {
  const { data: session } = useSession();
  const [ending, setEnding] = useState(false), [error, setError] = useState('');
  if (!session?.user?.isImpersonating) return null;
  const handleEnd = async () => {
    setEnding(true); setError('');
    try {
      const response = await fetch('/api/admin/impersonate/end', { method: 'POST', signal: AbortSignal.timeout(15_000) });
      const data = await response.json();
      if (!response.ok || data.success !== true) throw new Error(typeof data.error === 'string' ? data.error : 'Could not end the preview. Try again.');
      // A full navigation drops cached member data after the cookie is replaced.
      // eslint-disable-next-line @next/next/no-location-assign-relative-destination -- identity switch must discard the old member's client cache
      window.location.assign('/admin/users');
    } catch (failure) {
      setError(failure instanceof Error && failure.name !== 'TimeoutError' ? failure.message : 'The switch could not be confirmed. Refresh or sign out before retrying.');
      setEnding(false);
    }
  };
  return (
    <section aria-label="Read-only account preview" className="shrink-0 border-b border-amber-500/30 bg-amber-500/10 px-4 py-2 text-sm text-foreground sm:px-6">
      <div className="mx-auto flex max-w-7xl min-w-0 flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          <FiEye aria-hidden="true" className="shrink-0 text-amber-600 dark:text-amber-400" />
          <p className="min-w-0 break-words"><span className="font-semibold">Read-only preview</span><span className="block break-all text-muted-foreground sm:inline"> · {session.user.name || 'Member'}</span></p>
        </div>
        <Button type="button" variant="outline" className="min-h-11 shrink-0" onClick={handleEnd} disabled={ending}>{ending ? 'Returning…' : 'End Preview'}</Button>
        {error && <div className="w-full min-w-0"><p role="alert" className="break-words text-destructive">{error}</p><Button type="button" variant="link" className="min-h-11 px-0" onClick={() => void signOut({ callbackUrl: '/auth/login?callbackUrl=%2Fadmin%2Fusers' })}>Sign Out Safely</Button></div>}
      </div>
    </section>
  );
}
