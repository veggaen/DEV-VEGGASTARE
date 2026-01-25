import { auth } from "@/auth";

/**
 * @description Takes session async and return session.user
 * @return session?.user
 */
export const MyLibUserAuth = async () => {
    const session = await auth();
    return session?.user;
    
}

/**
 * @description Takes session async and return session.user
 * @return session?.user
 */
export const MyLibUserIDAuth = async () => {
    const session = await auth();
    return session?.user.id;
    
}

/**
 * @description Takes session async and return session.user.role
 * @return session?.user.role
 */
export const MyLibRoleAuth = async () => {
    const session = await auth();
    return session?.user.role;
    
}

/**
 * @description Takes session async and return session.user.role
 * @return session?.user.role
 */
export const MyLibEmailAuth = async () => {
    const session = await auth();
    return session?.user.email;
    
}