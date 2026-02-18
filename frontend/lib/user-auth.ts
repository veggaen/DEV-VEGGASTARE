import { auth } from "@/auth";
import { ExtendedUser } from "@/next-auth";
import { UserRole } from "@/generated/prisma/browser";

/**
 * @description Takes session async and return session.user
 * @return session?.user
 */
export const MyLibUserAuth = async (): Promise<ExtendedUser | undefined> => {
    const session = await auth();
    return session?.user;
    
}

/**
 * @description Takes session async and return session.user
 * @return session?.user
 */
export const MyLibUserIDAuth = async (): Promise<string | undefined> => {
    const session = await auth();
    return session?.user?.id;
    
}

/**
 * @description Takes session async and return session.user.role
 * @return session?.user.role
 */
export const MyLibRoleAuth = async (): Promise<UserRole | undefined> => {
    const session = await auth();
    return session?.user?.role;
    
}

/**
 * @description Takes session async and return session.user.role
 * @return session?.user.role
 */
export const MyLibEmailAuth = async (): Promise<string | null | undefined> => {
    const session = await auth();
    return session?.user?.email;
    
}