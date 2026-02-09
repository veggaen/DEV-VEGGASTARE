/**
 * Shared Prisma client for standalone scripts.
 * Scripts must be run with: npx tsx scripts/<script-name>.ts
 * 
 * Supports --dev flag to connect to the DEV database.
 */
import 'dotenv/config'
import { PrismaClient } from '@/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const DEV_DB_URL = process.env.DATABASE_URL_MAINDEV!

const useDevDb = process.argv.includes('--dev')
const connectionString = useDevDb ? DEV_DB_URL : process.env.DATABASE_URL_MAINLIVE!

if (useDevDb) {
    console.log("🔧 Using DEV database (ep-wild-boat)\n")
}

const adapter = new PrismaPg({
    connectionString,
    ssl: { rejectUnauthorized: false },
})

export const prisma = new PrismaClient({ adapter })
