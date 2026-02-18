import dotenv from 'dotenv';
import { PrismaClient } from './generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

dotenv.config();

function isTruthy(value: string | undefined): boolean {
	if (!value) return false;
	return value === '1' || value.toLowerCase() === 'true' || value.toLowerCase() === 'yes';
}

/**
 * Build a connection string with pool tuning params from env vars.
 * Strips Prisma-specific params (pgbouncer, connection_limit, pool_timeout)
 * that are not understood by the native pg driver.
 */
function buildPgConnectionString(originalUrl: string | undefined): string | undefined {
	if (!originalUrl) return undefined;

	try {
		const url = new URL(originalUrl);

		// Remove Prisma-specific params that the native pg driver doesn't understand
		url.searchParams.delete('pgbouncer');
		url.searchParams.delete('connection_limit');
		url.searchParams.delete('pool_timeout');
		url.searchParams.delete('connect_timeout');

		return url.toString();
	} catch {
		return originalUrl;
	}
}

declare global {
	// eslint-disable-next-line no-var
	var prismaBackend: PrismaClient | undefined;
}

const databaseUrl = buildPgConnectionString(process.env.DATABASE_URL_MAINLIVE);
const shouldLogQueries = isTruthy(process.env.PRISMA_LOG_QUERIES);

// Pool tuning via env vars (pg driver native options)
const poolMax = process.env.PRISMA_CONNECTION_LIMIT
	? parseInt(process.env.PRISMA_CONNECTION_LIMIT, 10) : undefined;
const idleTimeoutMs = process.env.PRISMA_POOL_TIMEOUT
	? parseInt(process.env.PRISMA_POOL_TIMEOUT, 10) * 1000 : undefined;
const connectTimeoutMs = process.env.PRISMA_CONNECT_TIMEOUT
	? parseInt(process.env.PRISMA_CONNECT_TIMEOUT, 10) * 1000 : 5000;

export const isDbConfigured = Boolean(databaseUrl);

function createMissingDbClient(): PrismaClient {
	const error = new Error(
		"DATABASE_URL_MAINLIVE is not set. Backend is running in shipping-demo mode (no DB)."
	);
	const proxy = new Proxy(
		{},
		{
			get() {
				throw error;
			},
		}
	);
	return proxy as unknown as PrismaClient;
}

function createPrismaClient(): PrismaClient {
	if (!databaseUrl) {
		return createMissingDbClient();
	}

	const adapter = new PrismaPg({
		connectionString: databaseUrl,
		ssl: { rejectUnauthorized: false },
		...(poolMax !== undefined && { max: poolMax }),
		...(idleTimeoutMs !== undefined && { idleTimeoutMillis: idleTimeoutMs }),
		connectionTimeoutMillis: connectTimeoutMs,
	});

	if (shouldLogQueries) {
		// Use client extensions for query logging (replaces removed $on('query') API in Prisma 7)
		return new PrismaClient({ adapter }).$extends({
			query: {
				$allModels: {
					async $allOperations({ operation, model, args, query }) {
						const start = performance.now();
						const result = await query(args);
						const duration = Math.round(performance.now() - start);
						console.log(`[prisma] ${duration}ms ${model}.${operation}`);
						return result;
					},
				},
			},
		}) as unknown as PrismaClient;
	}

	return new PrismaClient({ adapter });
}

export const dbbPrisma = globalThis.prismaBackend ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
	globalThis.prismaBackend = dbbPrisma;
}
