import { auth } from "@/auth";

/**
 * @description Takes session async and return session.user
 * @return session?.user
 */
const LOG_PREFIX = '[user-auth.ts]'
export const MyLibUserAuth = async () => {
    const session = await auth();
    console.log(LOG_PREFIX, 'MyLibUserAuth(session.user)')
    return session?.user;
    
}

/**
 * @description Takes session async and return session.user.role
 * @return session?.user.role
 */
export const MyLibRoleAuth = async () => {
    const session = await auth();
    console.log(LOG_PREFIX, 'MyRoleAuth(session.user.role)')
    return session?.user.role;
    
}