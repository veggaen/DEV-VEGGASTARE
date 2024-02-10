import { PrismaClient } from '@prisma/client'

declare global {
    var prisma: PrismaClient | undefined // define prisma in global namespace to avoid circular dependency issues with nextjs hotreload in dev environments.
}

/** 
 * @internal
 * @description Prisma Database Client
 * @example
 * var prisma: PrismaClient | undefined
 * const db = new PrismaClient()
 */
export const db = globalThis.prisma || new PrismaClient(); // prevents a downwards spiral of client spawning/SPAMMING on NEXTJS HOT-Reload 

if (process.env.NODE_ENV !== 'production') globalThis.prisma = db;