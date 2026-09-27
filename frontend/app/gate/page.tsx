'use client';

/**
 * @fileOverview  Access gate — the first thing a visitor sees while the site is
 *                in private preview. Same DNA as the landing: quiet star field,
 *                the Veggat™ mark as the only focal point, one glass card, one
 *                job (the password). Tokens only; outside the app shell.
 * @stability     stable
 */

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { FiArrowRight, FiLock } from 'react-icons/fi';
import { BrandMark } from '@/components/uicustom/chrome/brand-mark';
import { Atmosphere } from '@/components/uicustom/chrome/atmosphere';

export default function GatePage() {
  const searchParams = useSearchParams();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [shake, setShake] = useState(false);

  // Only same-origin paths may be used as the post-gate destination.
  const rawRedirectTo = searchParams.get('redirect') || '/';
  const redirectTo = rawRedirectTo.startsWith('/') && !rawRedirectTo.startsWith('//') && !rawRedirectTo.includes('\\')
    ? rawRedirectTo : '/';

  // Already through the gate? Go straight to the destination.
  useEffect(() => {
    const checkAuth = async () => {
      if (redirectTo.startsWith('/auth')) return;
      try {
        const res = await fetch('/api/access-gate');
        if (res.ok) window.location.href = redirectTo;
      } catch {
        // Not authenticated, stay on the gate.
      }
    };
    checkAuth();
  }, [redirectTo]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const res = await fetch('/api/access-gate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        window.location.href = redirectTo;
      } else {
        const data = await res.json();
        setError(data.error || 'That password is not right. Try again.');
        setShake(true);
        setTimeout(() => setShake(false), 500);
        setPassword('');
      }
    } catch {
      setError('Something went wrong on our side. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [password, redirectTo]);

  return (
    <div className="relative flex min-h-dvh flex-col bg-background text-foreground">
      <Atmosphere variant="quiet" />

      <main id="main-content" className="relative z-10 flex flex-1 items-center justify-center px-4 py-12">
        <section
          aria-labelledby="gate-title"
          className={`auth-card-enter w-full max-w-md rounded-3xl border border-border/70 bg-surface-1/85 p-8 shadow-e3 backdrop-blur-xl sm:p-10 ${
            shake ? 'motion-safe:animate-[gateShake_0.5s_ease-in-out]' : ''
          }`}
        >
          <div className="mb-8 flex flex-col items-center text-center">
            <p className="mb-4 text-[11px] font-semibold uppercase tracking-[0.24em] text-brand-accent-hover dark:text-brand-accent-light">
              Private preview
            </p>
            <h1 id="gate-title" className="m-0 leading-none">
              <BrandMark size="hero" as="span" entrance className="text-4xl sm:text-5xl" />
            </h1>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted-foreground">
              Veggat is being tested with a closed group. Enter the access password to continue.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="access-password" className="mb-2 block text-sm font-medium text-foreground/85">
                Access password
              </label>
              <div className="relative">
                <FiLock aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
                <input
                  id="access-password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  aria-invalid={error ? true : undefined}
                  aria-describedby={error ? 'gate-error' : undefined}
                  className="h-12 w-full rounded-xl border border-border/70 bg-input pl-11 pr-4 text-foreground placeholder:text-muted-foreground/70 transition-[border-color,box-shadow] duration-200 focus-visible:border-brand-accent/60 focus-visible:outline-none focus-visible:shadow-[0_0_0_3px_hsl(var(--brand-accent)/0.14)] aria-[invalid=true]:border-destructive/60"
                  autoComplete="off"
                  autoFocus
                  disabled={isLoading}
                />
              </div>
            </div>

            {error && (
              <p id="gate-error" role="alert" className="rounded-xl border border-destructive/25 bg-destructive/10 px-4 py-3 text-center text-sm text-destructive">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={isLoading || !password.trim()}
              className="group inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-brand-accent px-6 text-[15px] font-semibold text-brand-accent-foreground shadow-e2 transition-[background-color,box-shadow,transform] duration-200 hover:bg-brand-accent-hover hover:shadow-[0_8px_30px_-12px_hsl(var(--brand-accent)/0.6)] motion-safe:hover:-translate-y-px motion-safe:active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50"
            >
              {isLoading ? (
                <>
                  <span aria-hidden="true" className="size-4 rounded-full border-2 border-brand-accent-foreground/40 border-t-brand-accent-foreground motion-safe:animate-spin" />
                  Checking…
                </>
              ) : (
                <>
                  Enter site
                  <FiArrowRight aria-hidden="true" className="size-4 transition-transform duration-300 motion-safe:group-hover:translate-x-1" />
                </>
              )}
            </button>
          </form>

          <p className="mt-6 text-center text-xs text-muted-foreground">
            Need access? Ask the administrator for the preview password.
          </p>
        </section>
      </main>

      <footer className="relative z-10 border-t border-border/60 py-6">
        <div className="mx-auto max-w-md px-4">
          <nav aria-label="Legal" className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
            <Link href="/privacy" className="min-h-11 inline-flex items-center rounded-sm transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4">Personvern</Link>
            <Link href="/terms" className="min-h-11 inline-flex items-center rounded-sm transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4">Salgsvilkår</Link>
            <Link href="/info" className="min-h-11 inline-flex items-center rounded-sm transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-4">Om oss</Link>
          </nav>
          <p className="mt-2 text-center text-xs text-muted-foreground/80">
            © {new Date().getFullYear()} THORSEN SOFTWARE · Org.nr 937 051 107
          </p>
        </div>
      </footer>

      <style jsx global>{`
        @keyframes gateShake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-6px); }
          20%, 40%, 60%, 80% { transform: translateX(6px); }
        }
      `}</style>
    </div>
  );
}
