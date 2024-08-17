import { Employee, Product, Review, User, UserRole } from "@prisma/client";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";

type ExtendedUser = User & {
  role: UserRole;
  referredBy?: String;
  isTwoFactorEnabled?: boolean;
  productsListed?: Product[];
  reviews?: Review[];
  isOAuth?: boolean;
  employee?: Employee[];
};

const LOG_PREFIX = '[use-current-user.ts]'

export const useCurrentUser = () => {
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