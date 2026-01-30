/** 
 * PRISMA database client
 * @description Prisma Database Client
*/

import 'server-only'

import { Prisma, PrismaClient } from '@prisma/client'

function isTruthy(value: string | undefined): boolean {
    if (!value) return false
    return value === '1' || value.toLowerCase() === 'true' || value.toLowerCase() === 'yes'
}

function buildPrismaUrlWithPoolTuning(originalUrl: string | undefined): string | undefined {
    if (!originalUrl) return undefined

    try {
        const url = new URL(originalUrl)
        const usesPgBouncer = url.searchParams.get('pgbouncer') === 'true'

        const connectionLimitEnv = process.env.PRISMA_CONNECTION_LIMIT
        const poolTimeoutEnv = process.env.PRISMA_POOL_TIMEOUT
        const connectTimeoutEnv = process.env.PRISMA_CONNECT_TIMEOUT

        if (connectionLimitEnv) {
            url.searchParams.set('connection_limit', connectionLimitEnv)
        } else if (usesPgBouncer && !url.searchParams.has('connection_limit')) {
            url.searchParams.set('connection_limit', '1')
        }

        if (poolTimeoutEnv) url.searchParams.set('pool_timeout', poolTimeoutEnv)
        if (connectTimeoutEnv) url.searchParams.set('connect_timeout', connectTimeoutEnv)

        return url.toString()
    } catch {
        return originalUrl
    }
}

declare global {
    var prisma: PrismaClient | undefined // define prisma in global namespace to avoid circular dependency issues with nextjs hotreload in dev environments.
}

// Optional: tune Prisma connection pool via env vars (without editing DATABASE_URL)
// - PRISMA_CONNECTION_LIMIT=1 (recommended when using Neon pooler/pgbouncer)
// - PRISMA_POOL_TIMEOUT=10
// - PRISMA_CONNECT_TIMEOUT=10
// Optional: enable query logging PRISMA_LOG_QUERIES=1
const tunedDatabaseUrl = buildPrismaUrlWithPoolTuning(process.env.DATABASE_URL)
const shouldLogQueries = isTruthy(process.env.PRISMA_LOG_QUERIES)

function createPrismaClient(): PrismaClient {
    if (shouldLogQueries) {
        // When query logging is enabled, we need to create a client that can emit events
        const prisma = new PrismaClient({
            datasources: tunedDatabaseUrl ? { db: { url: tunedDatabaseUrl } } : undefined,
            log: [{ emit: 'event', level: 'query' }],
        })

        // Use type assertion since Prisma's types don't always match at build time
        ;(prisma as any).$on('query', (event: Prisma.QueryEvent) => {
            // Avoid logging params; keep logs lightweight
            console.log('[prisma]', `${event.duration}ms`, event.query)
        })

        return prisma
    }

    return new PrismaClient({
        datasources: tunedDatabaseUrl ? { db: { url: tunedDatabaseUrl } } : undefined,
    })
}

export const dbPrisma = globalThis.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') {
    globalThis.prisma = dbPrisma
}
