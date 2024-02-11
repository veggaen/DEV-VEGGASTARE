/** 
 * PRISMA database client
 * @description Prisma Database Client
*/

import { PrismaClient } from '@prisma/client'

declare global {
    var prisma: PrismaClient | undefined // define prisma in global namespace to avoid circular dependency issues with nextjs hotreload in dev environments.
}

export const dbPrisma = globalThis.prisma || new PrismaClient(); // prevents a downwards spiral of client spawning/SPAMMING on NEXTJS HOT-Reload 

if (process.env.NODE_ENV !== 'production') globalThis.prisma = dbPrisma;
