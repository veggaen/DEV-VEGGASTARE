'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCurrentUserWithStatus } from '@/hooks/use-current-user';
import Spinner from '@/components/uicustom/spinner';

// Redirect /profile to the current user's own profile page
export default function ProfileRedirect() {
  const router = useRouter();
  // useCurrentUser returns null for both "loading" and "unauthenticated" — use the
  // status-aware variant so we don't redirect to login before the session resolves.
  const { user, isLoading } = useCurrentUserWithStatus();

  useEffect(() => {
    if (isLoading) return;
    if (user?.id) {
      router.replace(`/profile/${user.id}`);
    } else {
      router.replace('/auth/login?callbackUrl=/profile');
    }
  }, [user, isLoading, router]);

  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Spinner />
    </div>
  );
}
