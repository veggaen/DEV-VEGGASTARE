'use server';

import { signOut } from "@/auth";

const LOG_PREFIX = '[[USE SERVER] logout.ts]'
export const LogoutMyAction = async () => {
    console.log(`${LOG_PREFIX} LogoutMyAction( signOut() )`)
    // TODO: can more some server stuff before logout here...
    await signOut();
}