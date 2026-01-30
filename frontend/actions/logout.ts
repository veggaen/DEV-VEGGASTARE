'use server';

import { signOut } from "@/auth";

type LogoutResult = { success: string } | { error: string };

const LOG_PREFIX = '[frontend/actions/logout.ts]'
export const LogoutMyAction = async (): Promise<LogoutResult> => {
    try {
        console.log(`${LOG_PREFIX} Initiating sign out...`);

        // Perform any server-side cleanup or logging before signing out
        // Example: await someServerSideCleanupFunction();

        // Sign the user out
        await signOut(); // Ensure signOut is correctly invalidating the session

        console.log(`${LOG_PREFIX} User successfully signed out`);

        // Optionally return some kind of confirmation
        return { success: 'Logged out successfully' };
    } catch (error) {
        console.error(`${LOG_PREFIX} Error during logout:`, error);
        return { error: 'Failed to log out. Please try again.' };
    }
};