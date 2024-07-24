import { Product, Review, User } from "@prisma/client";
import { useSession } from "next-auth/react";

type ExtendedUser = User & {
  productsListed?: Product[];
  reviews?: Review[];
  isOAuth?: boolean;
};

const LOG_PREFIX = '[use-current-user.ts]'

export const useCurrentUser = (): ExtendedUser | null => {

  const { data: session } = useSession();
  return session?.user as ExtendedUser ?? null;
};