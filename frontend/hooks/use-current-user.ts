import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { ExtendedUser } from "@/next-auth";

const LOG_PREFIX = '[use-current-user.ts]'

export const useCurrentUser = (): ExtendedUser | null => {
  const { data: session, status } = useSession();
  const [user, setUser] = useState(session?.user || null);

  useEffect(() => {
      if (status === 'authenticated') {
          setUser(session?.user);
      } else if (status === 'unauthenticated') {
          setUser(null);
      }
  }, [session, status]);

  return user;
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
  const [user, setUser] = useState<ExtendedUser | null>(session?.user || null);

  useEffect(() => {
    if (status === 'authenticated') {
      setUser(session?.user ?? null);
    } else if (status === 'unauthenticated') {
      setUser(null);
    }
  }, [session, status]);

  return { 
    user, 
    status, 
    isLoading: status === 'loading' 
  };
};