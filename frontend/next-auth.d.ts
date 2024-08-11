import { Employee, Product, Review, User, UserRole } from "@prisma/client"
import NextAuth, { type DefaultSession } from "next-auth"

export type ExtendedUser = DefaultSession['user'] & {
    /** 
     * Types for User just Extended from default session['user']
     * You can add more custom types if needed here
     * 
    */
    role: UserRole
    referredBy: string
    isTwoFactorEnabled: boolean;
    productsListed: Product[]
    reviews: Review[]
    isOAuth: boolean;
    employee?: Employee[];
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
      referredBy?: string */
      id?: string
    }
}