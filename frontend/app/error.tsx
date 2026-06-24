'use client';

import { useEffect } from 'react';
import { FiAlertTriangle, FiRefreshCw } from 'react-icons/fi';
import { reportClientError } from '@/lib/report-client-error';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[app/error.tsx]', error);
    reportClientError(error, { boundary: 'app/error.tsx' });
  }, [error]);

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-xl flex-col items-center justify-center px-6 text-center">
      <div className="mb-6 grid h-16 w-16 place-items-center rounded-2xl bg-amber-500/10 ring-1 ring-amber-500/20">
        <FiAlertTriangle className="h-7 w-7 text-amber-500" />
      </div>

      <h1 className="text-2xl font-semibold tracking-tight text-foreground">
        Something went wrong
      </h1>
      <p className="mt-1.5 max-w-sm text-sm text-muted-foreground">
        An unexpected error interrupted this page. Try again — if it keeps
        happening, a refresh usually clears it.
      </p>

      {error.digest && (
        <p className="mt-3 font-mono text-[11px] text-muted-foreground/60">
          Reference: {error.digest}
        </p>
      )}

      <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="group inline-flex items-center gap-2 rounded-md bg-foreground px-5 py-2.5 text-sm font-medium text-background transition-[gap] duration-200 hover:gap-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <FiRefreshCw className="h-4 w-4 transition-transform duration-300 group-hover:rotate-180" />
          Try again
        </button>
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="inline-flex items-center gap-2 rounded-md border border-border px-5 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          Refresh
        </button>
      </div>
    </div>
  );
}
