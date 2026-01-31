'use client';

import { useEffect } from 'react';
import { reportClientError } from '@/lib/report-client-error';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[app/global-error.tsx]', error);
    reportClientError(error, { boundary: 'app/global-error.tsx' });
  }, [error]);

  return (
    <html lang="en">
      <body>
        <div className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-3 px-6 text-center">
          <h1 className="text-2xl font-semibold">App error</h1>
          <p className="text-sm text-muted-foreground">
            A fatal error occurred. Try again or refresh.
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={reset}
              className="inline-flex h-10 items-center justify-center whitespace-nowrap rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground ring-offset-background transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
            >
              Try again
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex h-10 items-center justify-center whitespace-nowrap rounded-md border border-input bg-background px-4 py-2 text-sm font-medium ring-offset-background transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50"
            >
              Refresh
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
