import { useSession } from "next-auth/react";
import { ExtendedUser } from "@/next-auth";

const LOG_PREFIX = '[use-current-user.ts]'

export const useCurrentUser = (): ExtendedUser | null => {
  const { data: session, status } = useSession();
  if (status === 'authenticated') {
    return session?.user ?? null;
  }
  return null;
};

/**
 * Extended hook that also returns the session loading status
 * Use this when you need to differentiate between "not logged in" and "still loading"
 */
export const useCurrentUserWithStatus = (): { 
  user: ExtendedUser | null; 
  status: 'loading' | 'authenticated' | 'unauthenticated';
  isLoading: boolean;
} => {
  const { data: session, status } = useSession();
  const user = status === 'authenticated' ? (session?.user ?? null) : null;

  return { 
    user, 
    status, 
    isLoading: status === 'loading' 
  };
};