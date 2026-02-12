'use server';

import { signOut } from "@/auth";

const LOG_PREFIX = '[frontend/actions/logout.ts]'

export const LogoutMyAction = async (): Promise<void> => {
    console.log(`${LOG_PREFIX} Initiating sign out...`);
    
    // signOut() triggers a redirect internally (throws NEXT_REDIRECT)
    // Don't wrap in try-catch as the redirect needs to propagate
    await signOut({ redirectTo: '/auth/login' });
};