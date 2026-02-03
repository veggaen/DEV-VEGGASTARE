'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';

/**
 * /auth route handler
 * 
 * Redirects to:
 * - / (home) if user is logged in
 * - /auth/login if user is not logged in
 * 
 * This prevents users from landing on a 404 when visiting /auth directly.
 */
export default function AuthPage() {
  const router = useRouter();
  const { status } = useSession();

  useEffect(() => {
    if (status === 'loading') return; // Wait for session check
    
    if (status === 'authenticated') {
      router.replace('/'); // Logged in → go home
    } else {
      router.replace('/auth/login'); // Not logged in → go to login
    }
  }, [status, router]);

  // Simple loading state while checking session
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground">Redirecting...</p>
      </div>
    </div>
  );
}
