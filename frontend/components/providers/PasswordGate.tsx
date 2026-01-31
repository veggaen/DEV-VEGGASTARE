'use client';

/**
 * PasswordGate - Client-side fallback for access gate
 * 
 * The main protection is handled by middleware.ts which redirects
 * unauthenticated users to /gate before the page even loads.
 * 
 * This component is kept as a fallback/visual indicator but the
 * real security is server-side via HTTP-only cookies checked in middleware.
 */

import { useEffect, useState } from 'react';

export function PasswordGate({ children }: { children: React.ReactNode }) {
  const [isChecking, setIsChecking] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    // Quick client-side check - middleware already handles the real auth
    const checkAuth = async () => {
      try {
        const res = await fetch('/api/access-gate');
        setIsAuthenticated(res.ok);
      } catch {
        setIsAuthenticated(false);
      } finally {
        setIsChecking(false);
      }
    };
    checkAuth();
  }, []);

  // Show loading while checking
  if (isChecking) {
    return (
      <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-white/20 border-t-white" />
      </div>
    );
  }

  // If not authenticated, middleware should have redirected
  // But as a fallback, show nothing (prevents flash of content)
  if (!isAuthenticated) {
    return (
      <div className="fixed inset-0 z-[99999] flex items-center justify-center bg-black">
        <div className="text-white/60 text-sm">Redirecting to access gate...</div>
      </div>
    );
  }

  // Authenticated - render children
  return <>{children}</>;
}
