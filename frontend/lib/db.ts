/** 
 * PRISMA database client (Prisma 7 + PrismaPg driver adapter)
 * @description Prisma Database Client with native pg driver
*/

import 'server-only'

import { PrismaClient } from '@/generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

function isTruthy(value: string | undefined): boolean {
    if (!value) return false
    return value === '1' || value.toLowerCase() === 'true' || value.toLowerCase() === 'yes'
}

declare global {
    var prisma: PrismaClient | undefined
}

// Select database URL based on environment:
// - Vercel production  → MAINLIVE
// - Vercel preview     → MAINPREVIEW (falls back to MAINDEV)
// - Local development  → MAINDEV (falls back to MAINLIVE)
const vercelEnv = process.env.VERCEL_ENV; // 'production' | 'preview' | 'development' (set by Vercel)

const selectedDatabaseUrl =
    vercelEnv === 'production'
        ? process.env.DATABASE_URL_MAINLIVE
        : vercelEnv === 'preview'
            ? process.env.DATABASE_URL_MAINPREVIEW ?? process.env.DATABASE_URL_MAINDEV
            : process.env.NODE_ENV === 'production'
                ? process.env.DATABASE_URL_MAINLIVE                    // standalone prod build (non-Vercel)
                : process.env.DATABASE_URL_MAINDEV ?? process.env.DATABASE_URL_MAINLIVE

function withLibpqCompat(url: string | undefined): string | undefined {
    if (!url) return url
    if (!url.includes('sslmode=')) return url
    if (url.includes('uselibpqcompat=')) return url
    return `${url}${url.includes('?') ? '&' : '?'}uselibpqcompat=true`
}

const normalizedDatabaseUrl = withLibpqCompat(selectedDatabaseUrl)

const shouldLogQueries = isTruthy(process.env.PRISMA_LOG_QUERIES)

// Pool tuning via env vars (pg driver native options)
// - PRISMA_CONNECTION_LIMIT  → pg Pool `max` (default: pg default of 10)
// - PRISMA_POOL_TIMEOUT      → pg Pool `idleTimeoutMillis` in seconds
// - PRISMA_CONNECT_TIMEOUT   → pg Pool `connectionTimeoutMillis` in seconds (default: 5s)
const poolMax = process.env.PRISMA_CONNECTION_LIMIT
    ? parseInt(process.env.PRISMA_CONNECTION_LIMIT, 10)
    : undefined
const idleTimeoutMs = process.env.PRISMA_POOL_TIMEOUT
    ? parseInt(process.env.PRISMA_POOL_TIMEOUT, 10) * 1000
    : undefined
const connectTimeoutMs = process.env.PRISMA_CONNECT_TIMEOUT
    ? parseInt(process.env.PRISMA_CONNECT_TIMEOUT, 10) * 1000
    : 5000 // Match Prisma v6 default (pg v7 default is 0 = no timeout)

function createPrismaClient(): PrismaClient {
    const adapter = new PrismaPg({
        connectionString: normalizedDatabaseUrl,
        // Neon requires SSL; rejectUnauthorized: false matches sslmode=require
        ssl: { rejectUnauthorized: false },
        ...(poolMax !== undefined && { max: poolMax }),
        ...(idleTimeoutMs !== undefined && { idleTimeoutMillis: idleTimeoutMs }),
        connectionTimeoutMillis: connectTimeoutMs,
    })

    if (shouldLogQueries) {
        // Use client extensions for query logging (replaces removed $on('query') API)
        return new PrismaClient({ adapter }).$extends({
            query: {
                $allModels: {
                    async $allOperations({ operation, model, args, query }) {
                        const start = performance.now()
                        const result = await query(args)
                        const duration = Math.round(performance.now() - start)
                        console.log(`[prisma] ${duration}ms ${model}.${operation}`)
                        return result
                    },
                },
            },
        }) as unknown as PrismaClient
    }

    return new PrismaClient({ adapter })
}

export const dbPrisma = globalThis.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') {
    globalThis.prisma = dbPrisma
}
