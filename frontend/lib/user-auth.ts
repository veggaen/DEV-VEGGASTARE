import { auth } from "@/auth";
const LOG_PREFIX = '[user-auth.ts]'

/**
 * @description Takes session async and return session.user
 * @return session?.user
 */
export const MyLibUserAuth = async () => {
    const session = await auth();
    console.log(LOG_PREFIX, 'MyLibUserAuth(session.user)')
    return session?.user;
    
}

/**
 * @description Takes session async and return session.user
 * @return session?.user
 */
export const MyLibUserIDAuth = async () => {
    const session = await auth();
    console.log(LOG_PREFIX, 'MyLibUserAuth(session.user.id)')
    return session?.user.id;
    
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

/**
 * @description Takes session async and return session.user.role
 * @return session?.user.role
 */
export const MyLibEmailAuth = async () => {
    const session = await auth();
    console.log(LOG_PREFIX, 'MyRoleAuth(session.user.role)')
    return session?.user.email;
    
}