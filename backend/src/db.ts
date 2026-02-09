import dotenv from 'dotenv';
import { Prisma, PrismaClient } from '@prisma/client';

dotenv.config();

function isTruthy(value: string | undefined): boolean {
	if (!value) return false;
	return value === '1' || value.toLowerCase() === 'true' || value.toLowerCase() === 'yes';
}

function buildPrismaUrlWithPoolTuning(originalUrl: string | undefined): string | undefined {
	if (!originalUrl) return undefined;

	try {
		const url = new URL(originalUrl);
		const usesPgBouncer = url.searchParams.get('pgbouncer') === 'true';

		const connectionLimitEnv = process.env.PRISMA_CONNECTION_LIMIT;
		const poolTimeoutEnv = process.env.PRISMA_POOL_TIMEOUT;
		const connectTimeoutEnv = process.env.PRISMA_CONNECT_TIMEOUT;

		if (connectionLimitEnv) {
			url.searchParams.set('connection_limit', connectionLimitEnv);
		} else if (usesPgBouncer && !url.searchParams.has('connection_limit')) {
			url.searchParams.set('connection_limit', '1');
		}

		if (poolTimeoutEnv) url.searchParams.set('pool_timeout', poolTimeoutEnv);
		if (connectTimeoutEnv) url.searchParams.set('connect_timeout', connectTimeoutEnv);

		return url.toString();
	} catch {
		return originalUrl;
	}
}

declare global {
	// eslint-disable-next-line no-var
	var prismaBackend: PrismaClient | undefined;
}

const tunedDatabaseUrl = buildPrismaUrlWithPoolTuning(process.env.DATABASE_URL_MAINLIVE);
const shouldLogQueries = isTruthy(process.env.PRISMA_LOG_QUERIES);

export const isDbConfigured = Boolean(tunedDatabaseUrl);

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
	if (!tunedDatabaseUrl) {
		return createMissingDbClient();
	}

	if (shouldLogQueries) {
		const prisma = new PrismaClient({
			datasources: tunedDatabaseUrl ? { db: { url: tunedDatabaseUrl } } : undefined,
			log: [{ emit: 'event', level: 'query' }],
		}) as unknown as PrismaClient<Prisma.PrismaClientOptions, 'query'>;

		prisma.$on('query', (event) => {
			console.log('[prisma]', `${event.duration}ms`, event.query);
		});

		return prisma as unknown as PrismaClient;
	}

	return new PrismaClient({
		datasources: tunedDatabaseUrl ? { db: { url: tunedDatabaseUrl } } : undefined,
	});
}

export const dbbPrisma = globalThis.prismaBackend ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') {
	globalThis.prismaBackend = dbbPrisma;
}
