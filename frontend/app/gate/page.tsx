'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

export default function GatePage() {
  const searchParams = useSearchParams();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [shake, setShake] = useState(false);

  // Get redirect URL from query params
  const rawRedirectTo = searchParams.get('redirect') || '/';
  const redirectTo = rawRedirectTo.startsWith('/') ? rawRedirectTo : '/';

  // Check if already authenticated on mount
  useEffect(() => {
    const checkAuth = async () => {
      if (redirectTo.startsWith('/auth')) return;
      try {
        const res = await fetch('/api/access-gate');
        if (res.ok) window.location.href = redirectTo;
      } catch {
        // Not authenticated, stay on gate
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
        setError(data.error || 'Incorrect password');
        setShake(true);
        setTimeout(() => setShake(false), 500);
        setPassword('');
      }
    } catch {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  }, [password]);

  return (
    <div className="min-h-screen flex flex-col bg-neutral-950">
      {/* Clean solid background */}
      <div 
        className="fixed inset-0 pointer-events-none bg-neutral-950"
      />

      {/* Main content - centered */}
      <main className="flex-1 flex items-center justify-center relative z-10 px-4 py-12">
        <div 
          className={`w-full max-w-md p-8 rounded-2xl bg-neutral-900 border border-neutral-800 shadow-2xl ${
            shake ? 'animate-shake' : ''
          }`}
        >
          {/* Logo/Brand */}
          <div className="text-center mb-8">
            <div className="text-5xl mb-4">🔐</div>
            <h1 className="text-2xl font-bold text-white tracking-tight">VeggaStare</h1>
            <p className="text-sm text-neutral-400 mt-3">
              This site is currently in private testing mode.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="access-password" className="block text-sm font-medium text-neutral-300 mb-2">
                Access Password
              </label>
              <input
                id="access-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full px-4 py-3 rounded-xl bg-neutral-800 border border-neutral-700 text-white placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-white/20 focus:border-neutral-600 transition-all"
                autoComplete="off"
                autoFocus
                disabled={isLoading}
              />
            </div>

            {error && (
              <div className="px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20">
                <p className="text-red-400 text-sm text-center">{error}</p>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading || !password.trim()}
              className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-700 disabled:cursor-not-allowed text-white font-medium transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Verifying...
                </span>
              ) : (
                'Enter Site'
              )}
            </button>
          </form>

          <p className="mt-6 text-xs text-zinc-500 text-center">
            Contact administrator for access credentials.
          </p>
        </div>
      </main>

      {/* Minimal footer with legal links */}
      <footer className="relative z-10 py-6 border-t border-zinc-800/50">
        <div className="max-w-md mx-auto px-4">
          <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-zinc-500">
            <Link href="/privacy" className="hover:text-zinc-300 transition-colors">
              Personvern
            </Link>
            <span className="text-zinc-700">•</span>
            <Link href="/terms" className="hover:text-zinc-300 transition-colors">
              Salgsvilkår
            </Link>
            <span className="text-zinc-700">•</span>
            <Link href="/info" className="hover:text-zinc-300 transition-colors">
              Om oss
            </Link>
          </div>
          <p className="mt-3 text-center text-xs text-zinc-600">
            © {new Date().getFullYear()} THORSEN SOFTWARE · Org.nr 937 051 107
          </p>
        </div>
      </footer>

      {/* Shake animation */}
      <style jsx global>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-6px); }
          20%, 40%, 60%, 80% { transform: translateX(6px); }
        }
        .animate-shake { animation: shake 0.5s ease-in-out; }
      `}</style>
    </div>
  );
}
