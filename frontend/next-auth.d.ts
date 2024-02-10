import { User, UserRole } from "@prisma/client"
import NextAuth, { type DefaultSession } from "next-auth"

export type ExtendedUser = DefaultSession['user'] & {
    /** 
     * Types for User just Extended from desault session['user']
     * You can add more custom types if needed here
     * 
    */
    role: UserRole
    referredby: String
    isTwoFactorEnabled: boolean;
    isOAuth: boolean;
}

declare module "next-auth" {
    /** 
     * Types for Session
     * You can add more custom types if needed here
    */
    interface Session {
      user: ExtendedUser
    }
}

 declare module "next-auth/jwt" {
    /** Returned by the `jwt` callback and `auth`, when using JWT sessions */
    interface JWT {
      /** OpenID ID Token */
      /* role?: 'ADMIN' | 'USER'
      referredby?: String */
      id?: String
    }
}