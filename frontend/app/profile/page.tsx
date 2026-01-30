'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCurrentUser } from '@/hooks/use-current-user';
import Spinner from '@/components/uicustom/spinner';

// Redirect /profile to the current user's profile
export default function ProfileRedirect() {
  const router = useRouter();
  const currentUser = useCurrentUser();

  useEffect(() => {
    if (currentUser?.id) {
      router.replace(`/profile/${currentUser.id}`);
    } else if (currentUser === null) {
      // Not logged in, redirect to login
      router.replace('/auth/login?callbackUrl=/profile');
    }
  }, [currentUser, router]);

  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <Spinner />
    </div>
  );
}
