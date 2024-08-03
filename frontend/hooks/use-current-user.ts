import { Product, Review, User, UserRole } from "@prisma/client";
import { useSession } from "next-auth/react";

type ExtendedUser = User & {
  role: UserRole;
  referredBy?: String;
  isTwoFactorEnabled?: boolean;
  productsListed?: Product[];
  reviews?: Review[];
  isOAuth?: boolean;
};

const LOG_PREFIX = '[use-current-user.ts]'

export const useCurrentUser = (): ExtendedUser | null => {

  const { data: session } = useSession();
  return session?.user as ExtendedUser ?? null;
};