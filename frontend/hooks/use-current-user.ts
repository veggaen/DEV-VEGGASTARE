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