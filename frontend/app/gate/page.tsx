'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

export default function GatePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [shake, setShake] = useState(false);

  // Get redirect URL from query params
  const redirectTo = searchParams.get('redirect') || '/';

  // Check if already authenticated on mount
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const res = await fetch('/api/access-gate');
        if (res.ok) {
          // Already authenticated, redirect
          router.replace(redirectTo);
        }
      } catch {
        // Not authenticated, stay on gate
      }
    };
    checkAuth();
  }, [router, redirectTo]);

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
        // Success - redirect to original page
        router.replace(redirectTo);
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
  }, [password, router, redirectTo]);

  return (
    <div 
      className="min-h-screen flex items-center justify-center bg-black"
      style={{
        background: 'radial-gradient(ellipse at center, #1a1a2e 0%, #0a0a0f 100%)',
      }}
    >
      {/* Animated background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-1/2 -left-1/2 w-full h-full bg-gradient-to-br from-emerald-500/5 to-transparent rounded-full blur-3xl animate-pulse" />
        <div className="absolute -bottom-1/2 -right-1/2 w-full h-full bg-gradient-to-tl from-cyan-500/5 to-transparent rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      <div 
        className={`relative z-10 w-full max-w-md mx-4 p-8 rounded-2xl bg-zinc-900/80 border border-zinc-700/50 shadow-2xl backdrop-blur-xl ${
          shake ? 'animate-shake' : ''
        }`}
      >
        <div className="text-center mb-8">
          <div className="text-5xl mb-4">🔐</div>
          <h1 className="text-2xl font-bold text-white">VeggaStare</h1>
          <p className="text-sm text-zinc-400 mt-3">
            This site is currently in private testing mode.
          </p>
          <p className="text-xs text-zinc-500 mt-1">
            Enter the access password to continue.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label htmlFor="access-password" className="block text-sm font-medium text-zinc-300 mb-2">
              Access Password
            </label>
            <input
              id="access-password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Enter password (case-sensitive)"
              className="w-full px-4 py-3 rounded-xl bg-zinc-800/80 border border-zinc-600/50 text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500/50 transition-all"
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
            className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-zinc-700 disabled:cursor-not-allowed text-white font-medium transition-all focus:outline-none focus:ring-2 focus:ring-emerald-500/50 focus:ring-offset-2 focus:ring-offset-zinc-900"
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

        <div className="mt-8 pt-6 border-t border-zinc-700/50">
          <p className="text-xs text-zinc-500 text-center">
            If you don&apos;t have access credentials, please contact the administrator.
          </p>
        </div>
      </div>

      {/* CSS for shake animation */}
      <style jsx global>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          10%, 30%, 50%, 70%, 90% { transform: translateX(-6px); }
          20%, 40%, 60%, 80% { transform: translateX(6px); }
        }
        .animate-shake {
          animation: shake 0.5s ease-in-out;
        }
      `}</style>
    </div>
  );
}
