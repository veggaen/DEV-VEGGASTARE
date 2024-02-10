
import { useSession } from "next-auth/react";
import { calculateSessionExpirationMyHelper } from "./helpers/vegasTimeCalculator";

const LOG_PREFIX = '[use-current-user.ts]'
/**
 * @description Takes session and return session.user
 * return session?.user ?? null;
 */
export const useCurrentUser = () => {
    const { data: session } = useSession();


    return session?.user
};