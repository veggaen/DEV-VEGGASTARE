'use client';

import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { FiAlertTriangle, FiX, FiUser } from 'react-icons/fi';
import { toast } from 'sonner';

/**
 * Persistent top banner that shows when an OWNER is impersonating another user.
 * Provides a one-click "End" button to restore the original session.
 * 
 * Place this in the root layout so it's visible on every page.
 */
export default function ImpersonationBanner() {
  const { data: session, update } = useSession();
  const router = useRouter();
  const [ending, setEnding] = useState(false);

  if (!session?.user?.isImpersonating) return null;

  const handleEnd = async () => {
    setEnding(true);
    try {
      const res = await fetch('/api/admin/impersonate/end', { method: 'POST' });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'Failed to end impersonation');
        return;
      }

      toast.success('Returning to your account…');

      // Force session refresh to pick up cleared cookies
      await update();

      // Navigate to admin hub
      router.push('/admin');
      router.refresh();
    } catch (error) {
      toast.error('Failed to end impersonation');
      console.error(error);
    } finally {
      setEnding(false);
    }
  };

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] bg-amber-500 text-black px-4 py-2 flex items-center justify-center gap-3 text-sm font-medium shadow-lg">
      <FiAlertTriangle className="h-4 w-4 shrink-0" />
      <div className="flex items-center gap-1.5">
        <FiUser className="h-3.5 w-3.5" />
        <span>
          Viewing as <strong>{session.user.name || session.user.email}</strong>
        </span>
        <span className="text-amber-800">
          — {session.user.impersonatingFromName}&apos;s swap session
        </span>
      </div>
      <button
        onClick={handleEnd}
        disabled={ending}
        className="ml-3 px-3 py-1 bg-black/20 hover:bg-black/30 rounded-md transition-colors disabled:opacity-50 flex items-center gap-1.5"
      >
        {ending ? (
          <span className="animate-spin h-3.5 w-3.5 border-2 border-current border-t-transparent rounded-full" />
        ) : (
          <FiX className="h-3.5 w-3.5" />
        )}
        End Swap
      </button>
    </div>
  );
}
